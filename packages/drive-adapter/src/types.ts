export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  md5Checksum: string | null;
  modifiedTime: string;
  webContentLink: string | null;
  thumbnailLink: string | null;
  size: number | null;
};

export type AssetTypeLike = 'PHOTO' | 'VIDEO' | 'GIF';

export function mapMimeToAssetType(mime: string): AssetTypeLike | null {
  if (mime === 'image/gif') return 'GIF';
  if (mime.startsWith('image/')) return 'PHOTO';
  if (mime.startsWith('video/')) return 'VIDEO';
  return null;
}

/**
 * Mimes Anthropic vision accepts. Drive delivers these as JPEG/PNG/GIF/WEBP
 * directly; video tagging is not supported in this feature.
 */
export function isTaggableImageMime(
  mime: string,
): mime is 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp' {
  return (
    mime === 'image/png' ||
    mime === 'image/jpeg' ||
    mime === 'image/gif' ||
    mime === 'image/webp'
  );
}
