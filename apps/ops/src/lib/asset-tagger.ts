import { prisma, AssetTagStatus } from '@xcrm/db';
import {
  fetchFileBytes,
  fetchDriveThumbnail,
  isTaggableImageMime,
} from '@xcrm/drive-adapter';
import { tagAsset } from '@xcrm/ai';
import { convertToBrowserJpeg } from './image-convert';

/**
 * Inline asset auto-tagger. Ports the logic from
 * packages/jobs/src/handlers/asset-auto-tagger.ts to run in-process in ops.
 *
 * Idempotent and safe to call repeatedly. Designed to be called fire-and-
 * forget from {@link runDriveSync} so the HTTP handler isn't blocked waiting
 * for Claude. Catches its own errors and flips tagStatus → FAILED so the UI
 * can surface a retry affordance later.
 *
 * iPhone HEIC/HEIF and other non-Anthropic-vision-supported image formats
 * are transparently re-encoded to JPEG via sharp before the tagging call —
 * same path the proxy uses for browser previews. Without this, iPhone
 * photos shipped straight from Drive would land as TAGGED-with-empty-tags
 * and the generator would fly blind on them.
 */
export async function tagAssetInline(assetId: string): Promise<void> {
  const asset = await prisma.contentAsset.findUnique({
    where: { id: assetId },
    select: { id: true, driveFileId: true, deletedAt: true },
  });
  if (!asset || asset.deletedAt || !asset.driveFileId) return;

  try {
    let { bytes, mime } = await fetchFileBytes(asset.driveFileId);

    if (!isTaggableImageMime(mime)) {
      if (mime.startsWith('image/')) {
        // HEIC, HEIF, TIFF, etc. → try sharp first; if its bundled
        // libheif can't decode (newer iPhone AV1-HEIF, etc.), fall
        // back to Drive's pre-generated JPEG thumbnail.
        let converted = false;
        try {
          const out = await convertToBrowserJpeg(bytes);
          bytes = out.bytes;
          mime = out.mime;
          converted = true;
          console.log(
            `[tag-asset] assetId=${assetId} sharp-converted source for tagging`,
          );
        } catch (sharpErr) {
          console.warn(
            `[tag-asset] assetId=${assetId} sharp couldn't decode ${mime}; trying Drive thumbnail fallback. sharp: ${sharpErr instanceof Error ? sharpErr.message : String(sharpErr)}`,
          );
          try {
            const thumb = await fetchDriveThumbnail(asset.driveFileId, {
              sizePx: 1600,
            });
            bytes = thumb.bytes;
            mime = thumb.mime;
            converted = true;
            console.log(
              `[tag-asset] assetId=${assetId} drive-thumbnail fallback succeeded for tagging`,
            );
          } catch (thumbErr) {
            console.warn(
              `[tag-asset] assetId=${assetId} both sharp and Drive thumbnail failed; skipping vision call.`,
              thumbErr instanceof Error ? thumbErr.message : String(thumbErr),
            );
            await prisma.contentAsset.update({
              where: { id: assetId },
              data: { tagStatus: AssetTagStatus.TAGGED, autoTags: {} },
            });
            return;
          }
        }
        // After conversion the mime should be image/jpeg; if it
        // somehow isn't taggable, bail safely.
        if (!converted || !isTaggableImageMime(mime)) {
          await prisma.contentAsset.update({
            where: { id: assetId },
            data: { tagStatus: AssetTagStatus.TAGGED, autoTags: {} },
          });
          return;
        }
      } else {
        // Video / other non-image (vision can't read videos in v1).
        await prisma.contentAsset.update({
          where: { id: assetId },
          data: { tagStatus: AssetTagStatus.TAGGED, autoTags: {} },
        });
        return;
      }
    }

    const tags = await tagAsset({
      bytes,
      mime: mime as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp',
    });
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
