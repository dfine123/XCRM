import sharp from 'sharp';

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
 * sharp v0.33+ ships pre-built libvips with libheif, so HEIC/HEIF
 * decoding works on Linux x86_64 / arm64 / Apple Silicon out of the
 * box — no system libs needed on the Railway base image.
 *
 * Quality 85 + progressive — same defaults Twitter/X / Instagram
 * effectively use, balances file size against the watermark-y feel
 * of low-quality JPEG.
 *
 * Throws on decode failure; the caller (`/api/drive/file/[id]`)
 * catches and falls back to 415.
 */
export async function convertToBrowserJpeg(bytes: Buffer): Promise<Converted> {
  const out = await sharp(bytes, { failOn: 'truncated' })
    .rotate() // honour EXIF orientation so iPhone portraits land upright
    .jpeg({ quality: 85, progressive: true, mozjpeg: false })
    .toBuffer();
  return { bytes: out, mime: 'image/jpeg' };
}
