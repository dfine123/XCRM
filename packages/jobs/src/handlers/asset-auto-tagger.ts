import { Job } from 'bullmq';
import { prisma, AssetTagStatus } from '@xcrm/db';
import { fetchFileBytes, isTaggableImageMime } from '@xcrm/drive-adapter';
import { tagAsset } from '@xcrm/ai';

type TagAssetPayload = { assetId: string };

/**
 * Per-asset auto-tag handler.
 *   - Loads the asset (must have a driveFileId — we only auto-tag Drive-sourced assets)
 *   - Downloads bytes via drive-adapter
 *   - Calls @xcrm/ai tagAsset
 *   - Persists autoTags + flips tagStatus TAGGED
 * Final-attempt failure flips tagStatus FAILED.
 */
export async function assetAutoTaggerHandler(job: Job): Promise<unknown> {
  const { assetId } = job.data as TagAssetPayload;

  const asset = await prisma.contentAsset.findUnique({
    where: { id: assetId },
    select: { id: true, driveFileId: true, tagStatus: true, deletedAt: true },
  });
  if (!asset || asset.deletedAt) {
    return { skipped: 'asset-not-found-or-deleted' };
  }
  if (!asset.driveFileId) {
    // Non-drive assets (portal uploads) don't use this handler today.
    return { skipped: 'no-drive-file-id' };
  }

  try {
    const { bytes, mime } = await fetchFileBytes(asset.driveFileId);
    if (!isTaggableImageMime(mime)) {
      // Video tagging not supported in this feature — mark as TAGGED with empty tags
      // so it still appears in the library; manual tags remain editable.
      await prisma.contentAsset.update({
        where: { id: assetId },
        data: { tagStatus: AssetTagStatus.TAGGED, autoTags: {} },
      });
      return { skipped: 'not-a-taggable-image-mime', mime };
    }

    const tags = await tagAsset({ bytes, mime });
    await prisma.contentAsset.update({
      where: { id: assetId },
      data: { tagStatus: AssetTagStatus.TAGGED, autoTags: tags },
    });
    return { tagged: true };
  } catch (err) {
    const isFinal = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
    if (isFinal) {
      await prisma.contentAsset.update({
        where: { id: assetId },
        data: { tagStatus: AssetTagStatus.FAILED },
      });
    }
    throw err;
  }
}
