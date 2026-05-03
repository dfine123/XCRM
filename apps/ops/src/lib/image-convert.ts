import sharp from 'sharp';
import heicConvert from 'heic-convert';

/**
 * Set of MIME types `<img>` can render directly. Anything else needs
 * conversion before we hand bytes to the browser.
 *
 * Source: MDN intersected with what Drive realistically returns.
 */
export const BROWSER_RENDERABLE_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/svg+xml',
  'image/bmp',
  'image/x-icon',
  'image/vnd.microsoft.icon',
]);

export function isBrowserRenderable(mime: string): boolean {
  return BROWSER_RENDERABLE_IMAGE_MIMES.has(mime);
}

export type Converted = {
  bytes: Buffer;
  mime: 'image/jpeg';
};

/**
 * Decode `bytes` (HEIC, HEIF, TIFF, etc.) and re-encode as JPEG.
 *
 * Tries sharp's bundled libvips+libheif first (fast, native).
 * iPhone files using compressions sharp's bundle doesn't ship a
 * decoder for (e.g. AV1-HEIF on newer iOS) fail there — we then
 * try `heic-convert` (pure-JS WASM libheif build, slower but
 * decodes a wider set). Throws if both fail; caller falls back to
 * the Drive-thumbnail path.
 *
 * Quality 85 + progressive — balances file size against the
 * watermark-y feel of low-quality JPEG. EXIF orientation is
 * honoured so iPhone portraits land upright (sharp does this
 * inline; for the heic-convert path we run a sharp pass after to
 * rotate + re-encode).
 */
export async function convertToBrowserJpeg(bytes: Buffer): Promise<Converted> {
  // Tier 1: sharp.
  try {
    const out = await sharp(bytes, { failOn: 'truncated' })
      .rotate()
      .jpeg({ quality: 85, progressive: true, mozjpeg: false })
      .toBuffer();
    return { bytes: out, mime: 'image/jpeg' };
  } catch (sharpErr) {
    // Tier 2: heic-convert (WASM).
    try {
      // heic-convert ships its own libheif build that covers more
      // compression variants than sharp's bundle.
      const arrayBuffer = await heicConvert({
        buffer: new Uint8Array(bytes),
        format: 'JPEG',
        quality: 0.85,
      });
      // Re-pipe through sharp to honour EXIF orientation + match the
      // progressive JPEG profile we use elsewhere. If this second
      // sharp call also fails, surface it.
      const re = await sharp(Buffer.from(arrayBuffer))
        .rotate()
        .jpeg({ quality: 85, progressive: true })
        .toBuffer();
      return { bytes: re, mime: 'image/jpeg' };
    } catch (heicErr) {
      const sharpMsg =
        sharpErr instanceof Error ? sharpErr.message : String(sharpErr);
      const heicMsg =
        heicErr instanceof Error ? heicErr.message : String(heicErr);
      throw new Error(
        `sharp: ${sharpMsg} | heic-convert: ${heicMsg}`,
      );
    }
  }
}
