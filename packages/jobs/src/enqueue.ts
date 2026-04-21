import { QUEUE_NAMES, queues } from './queues';

/**
 * Enqueue a one-off sync for a specific DriveSource. Called by ops
 * server actions on "Connect folder" and "Sync now".
 */
export async function enqueueDriveSync(
  driveSourceId: string,
  opts: { triggeredByUserId?: string } = {},
): Promise<void> {
  await queues[QUEUE_NAMES.driveSync].add(
    'sync-source',
    { driveSourceId, triggeredByUserId: opts.triggeredByUserId },
    { jobId: `sync-source:${driveSourceId}:${Date.now()}` },
  );
}

/**
 * Enqueue a per-asset auto-tag. Called by the drive-sync handler after
 * upserting a new / changed ContentAsset row.
 */
export async function enqueueAssetAutoTag(assetId: string): Promise<void> {
  await queues[QUEUE_NAMES.assetAutoTagger].add(
    'tag-asset',
    { assetId },
    { jobId: `tag-asset:${assetId}` },
  );
}
