import { getDriveClient, getDriveJwt } from './auth';

export type DriveThumbnailResult = {
  bytes: Buffer;
  mime: string;
};

/**
 * Fetch Drive's auto-generated JPEG thumbnail for a file.
 *
 * Why this exists: sharp's bundled libheif covers HEVC-HEIC but not
 * every HEIF compression variant — newer iPhones encode some HEIF
 * with codecs (e.g. AV1) that the bundled plugin can't decode.
 * Drive transcodes every uploaded image to a JPEG thumbnail server-
 * side, so this is the universal fallback when our own decoder
 * can't handle the bytes.
 *
 * Default size is 1600px on the long edge — plenty for previews and
 * for the vision-tagger Claude call. Drive caps thumbnail sizes
 * around 2048; requesting larger silently returns the cap.
 */
export async function fetchDriveThumbnail(
  fileId: string,
  opts: { sizePx?: number } = {},
): Promise<DriveThumbnailResult> {
  const sizePx = opts.sizePx ?? 1600;
  const drive = getDriveClient();

  const meta = await drive.files.get({
    fileId,
    fields: 'thumbnailLink',
    supportsAllDrives: true,
  });
  const link = meta.data.thumbnailLink;
  if (!link) {
    throw new Error(`Drive file ${fileId} has no thumbnailLink`);
  }

  // Default thumbnailLink ends with =sNNN; bump it to our requested
  // size. If Drive returned a different shape, leave it alone.
  const sizedLink = link.replace(/=s\d+(-[a-z]+)?$/i, `=s${sizePx}`);

  const auth = getDriveJwt();
  const tokenRes = await auth.getAccessToken();
  const token = typeof tokenRes === 'string' ? tokenRes : tokenRes?.token;
  if (!token) {
    throw new Error('Could not obtain a Drive access token');
  }

  const res = await fetch(sizedLink, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '(no body)');
    throw new Error(
      `Drive thumbnail fetch failed: ${res.status} ${res.statusText} — ${detail.slice(0, 120)}`,
    );
  }

  const arrayBuf = await res.arrayBuffer();
  const mime = res.headers.get('content-type') ?? 'image/jpeg';
  return { bytes: Buffer.from(arrayBuf), mime };
}
