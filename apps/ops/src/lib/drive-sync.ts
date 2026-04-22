import { prisma, AssetTagStatus, DriveSyncStatus } from '@xcrm/db';
import { listFiles, mapMimeToAssetType, type DriveFile } from '@xcrm/drive-adapter';
import { tagAssetInline } from './asset-tagger';

/**
 * Inline Drive sync. Ports packages/jobs/src/handlers/drive-sync.ts to run
 * in-process in the ops app — no Redis, no BullMQ, no worker service.
 *
 * Two phases:
 *   1. INGEST (awaited, 60s timeout) — list folder, upsert ContentAsset rows
 *      as PENDING. Fast, DB-only. This is what the HTTP caller waits on.
 *   2. TAG (fire-and-forget) — spawn tagAssetInline() for each new/changed
 *      asset. Not awaited so the HTTP response returns in 1-2s; tags land
 *      asynchronously over the next 30s-5min depending on folder size.
 *
 * A DriveSync row is opened RUNNING, transitions to SUCCEEDED or FAILED, and
 * drives the last-sync badge in the UI. On timeout the row is FAILED with
 * a clear error message so the operator can retry.
 */

const INGEST_TIMEOUT_MS = 60_000;

export type DriveSyncResult = {
  ok: boolean;
  filesSeen: number;
  filesIngested: number;
  filesSkipped: number;
  taggingQueued: number;
  error?: string;
};

export async function runDriveSync(
  driveSourceId: string,
  opts: { triggeredByUserId?: string } = {},
): Promise<DriveSyncResult> {
  const source = await prisma.driveSource.findUnique({
    where: { id: driveSourceId },
    select: {
      id: true,
      modelId: true,
      folderId: true,
      folderName: true,
      cursor: true,
      isActive: true,
      deletedAt: true,
    },
  });
  if (!source || !source.isActive || source.deletedAt) {
    return {
      ok: false,
      filesSeen: 0,
      filesIngested: 0,
      filesSkipped: 0,
      taggingQueued: 0,
      error: 'Source not found, inactive, or deleted.',
    };
  }

  console.log(
    `[drive-sync] start sourceId=${driveSourceId} folderName="${source.folderName}" folderId=${source.folderId}`,
  );

  const sync = await prisma.driveSync.create({
    data: {
      driveSourceId,
      status: DriveSyncStatus.RUNNING,
      triggeredByUserId: opts.triggeredByUserId ?? null,
    },
  });

  const pendingTagIds: string[] = [];
  let filesSeen = 0;
  let filesIngested = 0;
  let filesSkipped = 0;

  try {
    await withTimeout(
      ingestFolder({
        folderId: source.folderId,
        modelId: source.modelId,
        driveSourceId,
        initialPageToken: source.cursor ?? undefined,
        onSeen: () => filesSeen++,
        onIngested: (assetId) => {
          filesIngested++;
          pendingTagIds.push(assetId);
        },
        onSkipped: () => filesSkipped++,
      }),
      INGEST_TIMEOUT_MS,
      `Drive sync exceeded ${INGEST_TIMEOUT_MS / 1000}s — folder may be too large to sync inline.`,
    );

    await prisma.$transaction([
      prisma.driveSync.update({
        where: { id: sync.id },
        data: {
          status: DriveSyncStatus.SUCCEEDED,
          finishedAt: new Date(),
          filesSeen,
          filesIngested,
          filesSkipped,
        },
      }),
      prisma.driveSource.update({
        where: { id: driveSourceId },
        data: {
          lastSyncedAt: new Date(),
          lastSyncStatus: DriveSyncStatus.SUCCEEDED,
          cursor: null,
        },
      }),
    ]);

    console.log(
      `[drive-sync] done sourceId=${driveSourceId} seen=${filesSeen} ingested=${filesIngested} skipped=${filesSkipped} tagging=${pendingTagIds.length}`,
    );

    // Fire-and-forget tagging. Runs in the same Node process, not awaited —
    // the HTTP response returns immediately after ingest completes.
    if (pendingTagIds.length > 0) {
      void tagInBackground(pendingTagIds);
    }

    return {
      ok: true,
      filesSeen,
      filesIngested,
      filesSkipped,
      taggingQueued: pendingTagIds.length,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[drive-sync] FAILED sourceId=${driveSourceId}:`, message);

    await prisma.$transaction([
      prisma.driveSync.update({
        where: { id: sync.id },
        data: {
          status: DriveSyncStatus.FAILED,
          finishedAt: new Date(),
          filesSeen,
          filesIngested,
          filesSkipped,
          error: message,
        },
      }),
      prisma.driveSource.update({
        where: { id: driveSourceId },
        data: { lastSyncStatus: DriveSyncStatus.FAILED },
      }),
    ]);

    return {
      ok: false,
      filesSeen,
      filesIngested,
      filesSkipped,
      taggingQueued: 0,
      error: message,
    };
  }
}

/**
 * Fan-out for scheduled syncs: call {@link runDriveSync} for every active,
 * non-deleted DriveSource. Each runs sequentially to avoid thundering-herd
 * against Drive + Anthropic. Errors are logged per-source; one failure does
 * not abort the rest.
 */
export async function runScheduledDriveSyncs(): Promise<{ sourcesRun: number }> {
  const sources = await prisma.driveSource.findMany({
    where: { isActive: true, deletedAt: null },
    select: { id: true },
  });
  console.log(`[drive-sync:cron] fan-out for ${sources.length} active sources`);
  for (const s of sources) {
    try {
      await runDriveSync(s.id);
    } catch (err) {
      console.error(
        `[drive-sync:cron] sourceId=${s.id} unhandled error:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }
  return { sourcesRun: sources.length };
}

// --- internals ------------------------------------------------------------

type IngestParams = {
  folderId: string;
  modelId: string;
  driveSourceId: string;
  initialPageToken: string | undefined;
  onSeen: () => void;
  onIngested: (assetId: string) => void;
  onSkipped: () => void;
};

async function ingestFolder(p: IngestParams): Promise<void> {
  let pageToken: string | undefined = p.initialPageToken;
  do {
    const page = await listFiles(p.folderId, { pageToken });
    pageToken = page.nextPageToken ?? undefined;
    for (const file of page.files) {
      p.onSeen();
      const outcome = await upsertAsset(p.modelId, p.driveSourceId, file);
      if (outcome.kind === 'INGESTED' || outcome.kind === 'UPDATED') {
        p.onIngested(outcome.assetId);
      } else {
        p.onSkipped();
      }
    }
  } while (pageToken);
}

type UpsertOutcome =
  | { kind: 'INGESTED'; assetId: string }
  | { kind: 'UPDATED'; assetId: string }
  | { kind: 'SKIPPED' };

async function upsertAsset(
  modelId: string,
  driveSourceId: string,
  file: DriveFile,
): Promise<UpsertOutcome> {
  const assetType = mapMimeToAssetType(file.mimeType);
  if (assetType === null) return { kind: 'SKIPPED' };

  const existing = await prisma.contentAsset.findUnique({
    where: { drive_file_dedupe: { driveSourceId, driveFileId: file.id } },
    select: { id: true, driveChecksum: true },
  });

  if (!existing) {
    const created = await prisma.contentAsset.create({
      data: {
        modelId,
        driveSourceId,
        driveFileId: file.id,
        driveChecksum: file.md5Checksum,
        type: assetType,
        storageUrl: file.webContentLink ?? '',
        thumbnailUrl: file.thumbnailLink,
        tagStatus: AssetTagStatus.PENDING,
      },
      select: { id: true },
    });
    return { kind: 'INGESTED', assetId: created.id };
  }

  const checksumChanged =
    file.md5Checksum && existing.driveChecksum !== file.md5Checksum;
  if (checksumChanged) {
    await prisma.contentAsset.update({
      where: { id: existing.id },
      data: {
        driveChecksum: file.md5Checksum,
        storageUrl: file.webContentLink ?? '',
        thumbnailUrl: file.thumbnailLink,
        tagStatus: AssetTagStatus.PENDING,
      },
    });
    return { kind: 'UPDATED', assetId: existing.id };
  }

  return { kind: 'SKIPPED' };
}

async function tagInBackground(assetIds: string[]): Promise<void> {
  for (const id of assetIds) {
    try {
      await tagAssetInline(id);
    } catch (err) {
      console.error(
        `[drive-sync:bg-tag] assetId=${id} unhandled:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
