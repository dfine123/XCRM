import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@xcrm/db';
import { fetchFileBytes } from '@xcrm/drive-adapter';

/**
 * Image MIME types the browser can render in an <img>. Everything else
 * (HEIC, HEIF, TIFF, RAW, …) returns 415 with a helpful payload — we'd
 * rather surface "this format isn't browser-renderable" than ship bytes
 * Chrome will refuse to draw and silently break the preview.
 *
 * iPhones default to HEIC. If an operator drops phone photos straight
 * into Drive, this is the most common reason a preview fails.
 */
const BROWSER_RENDERABLE_IMAGE_MIMES = new Set([
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

/**
 * GET /api/drive/file/[id]
 *
 * Streams a ContentAsset's file bytes, fetched server-side through the
 * service-account JWT.
 *
 * Auth: requires an ops session (FOUNDER | PARTNER).
 *
 * Caching: private, 1-day max-age, ETag tied to Drive's md5 checksum.
 *
 * Diagnostic mode: ?probe=1 returns JSON `{ok, mime, size, ...}` instead
 * of bytes. The `<AssetImage>` UI fallback fetches this on render error
 * to surface the actual cause to the operator.
 */
export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  const url = new URL(req.url);
  const probe = url.searchParams.get('probe') === '1';

  const session = await auth();
  if (!session?.user?.id) {
    return jsonOrText(probe, { error: 'unauthorized' }, 401);
  }
  const role = session.user.role;
  if (role !== 'FOUNDER' && role !== 'PARTNER') {
    return jsonOrText(probe, { error: 'forbidden' }, 403);
  }

  const asset = await prisma.contentAsset.findFirst({
    where: { id: params.id, deletedAt: null },
    select: { driveFileId: true, driveChecksum: true, type: true },
  });
  if (!asset) {
    return jsonOrText(probe, { error: 'asset not found' }, 404);
  }
  if (!asset.driveFileId) {
    return jsonOrText(
      probe,
      {
        error: 'asset has no drive file',
        detail: 'Asset is not Drive-sourced (e.g. portal upload).',
      },
      404,
    );
  }

  // Conditional GET — only meaningful for the bytes path; probe always
  // returns fresh.
  const etag = asset.driveChecksum ? `"${asset.driveChecksum}"` : null;
  if (!probe) {
    const ifNoneMatch = req.headers.get('if-none-match');
    if (etag && ifNoneMatch && ifNoneMatch === etag) {
      return new Response(null, { status: 304, headers: { etag } });
    }
  }

  let bytes: Buffer;
  let mime: string;
  try {
    const res = await fetchFileBytes(asset.driveFileId);
    bytes = res.bytes;
    mime = res.mime;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[drive:file] assetId=${params.id} driveFileId=${asset.driveFileId} fetch failed:`,
      message,
    );
    return jsonOrText(
      probe,
      { error: 'drive fetch failed', detail: message },
      502,
    );
  }

  // Diagnostic logging: every successful fetch records what we got. Cheap
  // grep target when an operator hits "image unavailable" and pings us.
  console.log(
    `[drive:file] assetId=${params.id} mime=${mime} size=${bytes.length}`,
  );

  if (probe) {
    return NextResponse.json({
      ok: true,
      assetId: params.id,
      assetType: asset.type,
      driveFileId: asset.driveFileId,
      mime,
      size: bytes.length,
      browserRenderable: BROWSER_RENDERABLE_IMAGE_MIMES.has(mime),
    });
  }

  // Hard guard against shipping bytes the browser can't draw. Without
  // this, Chrome silently 0×0s the <img> and the user sees a blank box.
  // We return 415 with a payload the AssetImage onError handler can read
  // via the probe path.
  if (mime.startsWith('image/') && !BROWSER_RENDERABLE_IMAGE_MIMES.has(mime)) {
    console.warn(
      `[drive:file] assetId=${params.id} mime=${mime} not browser-renderable — returning 415`,
    );
    return NextResponse.json(
      {
        error: 'unsupported image format',
        mime,
        detail: `${mime} can't render in <img>. Re-export the source as JPEG or PNG.`,
      },
      { status: 415 },
    );
  }

  const headers: Record<string, string> = {
    'Content-Type': mime,
    'Content-Length': String(bytes.length),
    'Cache-Control': 'private, max-age=86400, must-revalidate',
    // Greppable header — devtools Network tab surfaces this without
    // hitting the probe endpoint.
    'X-Drive-Mime': mime,
  };
  if (etag) headers['ETag'] = etag;

  return new Response(new Uint8Array(bytes), { status: 200, headers });
}

function jsonOrText(
  probe: boolean,
  body: { error: string; detail?: string; [k: string]: unknown },
  status: number,
) {
  return NextResponse.json(body, { status });
}
