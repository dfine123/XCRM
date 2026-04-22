import { Job } from 'bullmq';
import { prisma, AssetTagStatus, DriveSyncStatus, DriveSourceStatus } from '@xcrm/db';
import { listFiles, mapMimeToAssetType, type DriveFile } from '@xcrm/drive-adapter';
import { enqueueAssetAutoTag, enqueueDriveSync } from '../enqueue';

type SyncSourcePayload = { driveSourceId: string; triggeredByUserId?: string };

/**
 * drive-sync is dual-purpose:
 *   - job.name === 'recurring:driveSync' → fan-out: read active sources, enqueue one sync-source per
 *   - job.name === 'sync-source'         → per-source: actually pull from Drive
 */
export async function driveSyncHandler(job: Job): Promise<unknown> {
  if (job.name === 'recurring:driveSync') {
    return fanOutActiveSources();
  }
  if (job.name === 'sync-source') {
    const payload = job.data as SyncSourcePayload;
    return syncOneSource(payload.driveSourceId, payload.triggeredByUserId);
  }
  throw new Error(`drive-sync received unknown job name: ${job.name}`);
}

async function fanOutActiveSources(): Promise<{ enqueued: number }> {
  const active = await prisma.driveSource.findMany({
    where: { status: DriveSourceStatus.ACTIVE },
    select: { id: true },
  });
  for (const s of active) {
    await enqueueDriveSync(s.id);
  }
  return { enqueued: active.length };
}

async function syncOneSource(
  driveSourceId: string,
  triggeredByUserId: string | undefined,
): Promise<{ filesSeen: number; filesIngested: number; filesSkipped: number }> {
  const source = await prisma.driveSource.findUnique({
    where: { id: driveSourceId },
    select: {
      id: true,
      modelId: true,
      folderId: true,
      cursor: true,
      status: true,
    },
  });
  if (!source || source.status !== DriveSourceStatus.ACTIVE) {
    return { filesSeen: 0, filesIngested: 0, filesSkipped: 0 };
  }

  const sync = await prisma.driveSync.create({
    data: {
      driveSourceId,
      status: DriveSyncStatus.RUNNING,
      triggeredByUserId: triggeredByUserId ?? null,
    },
  });

  let filesSeen = 0;
  let filesIngested = 0;
  let filesSkipped = 0;
  let pageToken: string | undefined = source.cursor ?? undefined;

  try {
    do {
      const page = await listFiles(source.folderId, { pageToken });
      pageToken = page.nextPageToken ?? undefined;
      for (const file of page.files) {
        filesSeen++;
        const outcome = await upsertAsset(source.modelId, driveSourceId, file);
        if (outcome === 'INGESTED' || outcome === 'UPDATED') {
          filesIngested++;
        } else {
          filesSkipped++;
        }
      }
    } while (pageToken);

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
  } catch (err) {
    await prisma.$transaction([
      prisma.driveSync.update({
        where: { id: sync.id },
        data: {
          status: DriveSyncStatus.FAILED,
          finishedAt: new Date(),
          filesSeen,
          filesIngested,
          filesSkipped,
          error: err instanceof Error ? err.message : String(err),
        },
      }),
      prisma.driveSource.update({
        where: { id: driveSourceId },
        data: { lastSyncStatus: DriveSyncStatus.FAILED },
      }),
    ]);
    throw err;
  }

  return { filesSeen, filesIngested, filesSkipped };
}

type UpsertOutcome = 'INGESTED' | 'UPDATED' | 'SKIPPED';

async function upsertAsset(
  modelId: string,
  driveSourceId: string,
  file: DriveFile,
): Promise<UpsertOutcome> {
  const assetType = mapMimeToAssetType(file.mimeType);
  if (assetType === null) return 'SKIPPED';

  const existing = await prisma.contentAsset.findUnique({
    where: {
      drive_file_dedupe: { driveSourceId, driveFileId: file.id },
    },
    select: { id: true, driveChecksum: true, tagStatus: true },
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
    await enqueueAssetAutoTag(created.id);
    return 'INGESTED';
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
    await enqueueAssetAutoTag(existing.id);
    return 'UPDATED';
  }

  return 'SKIPPED';
}
