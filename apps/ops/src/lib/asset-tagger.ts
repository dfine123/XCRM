import { prisma, AssetTagStatus } from '@xcrm/db';
import { fetchFileBytes, isTaggableImageMime } from '@xcrm/drive-adapter';
import { tagAsset } from '@xcrm/ai';

/**
 * Inline asset auto-tagger. Ports the logic from
 * packages/jobs/src/handlers/asset-auto-tagger.ts to run in-process in ops.
 *
 * Idempotent and safe to call repeatedly. Designed to be called fire-and-
 * forget from {@link runDriveSync} so the HTTP handler isn't blocked waiting
 * for Claude. Catches its own errors and flips tagStatus → FAILED so the UI
 * can surface a retry affordance later.
 */
export async function tagAssetInline(assetId: string): Promise<void> {
  const asset = await prisma.contentAsset.findUnique({
    where: { id: assetId },
    select: { id: true, driveFileId: true, deletedAt: true },
  });
  if (!asset || asset.deletedAt || !asset.driveFileId) return;

  try {
    const { bytes, mime } = await fetchFileBytes(asset.driveFileId);
    if (!isTaggableImageMime(mime)) {
      await prisma.contentAsset.update({
        where: { id: assetId },
        data: { tagStatus: AssetTagStatus.TAGGED, autoTags: {} },
      });
      return;
    }

    const tags = await tagAsset({ bytes, mime });
    await prisma.contentAsset.update({
      where: { id: assetId },
      data: { tagStatus: AssetTagStatus.TAGGED, autoTags: tags },
    });
  } catch (err) {
    console.error(
      `[tag-asset] failed assetId=${assetId}:`,
      err instanceof Error ? err.message : String(err),
    );
    await prisma.contentAsset.update({
      where: { id: assetId },
      data: { tagStatus: AssetTagStatus.FAILED },
    });
  }
}
