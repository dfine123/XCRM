import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@xcrm/db';
import { fetchFileBytes } from '@xcrm/drive-adapter';

/**
 * GET /api/drive/file/[id]
 *
 * Streams a ContentAsset's file bytes, fetched server-side through the
 * service-account JWT. The Drive `webContentLink` / `thumbnailLink` we
 * originally stored on ContentAsset are only accessible to browsers with
 * a Google session that has read access to the file — our folders are
 * shared with the service account only, so those URLs 403/redirect-to-
 * login in the operator's browser. This route is what the UI renders
 * via `<img>` / `<video>` tags instead.
 *
 * Auth: requires an ops session (FOUNDER | PARTNER). Same role gate as
 * the rest of /console and /api/drive/*.
 *
 * Caching: private (session-gated content) with a 1-day max-age and an
 * ETag tied to Drive's md5 checksum so repeat loads after the first go
 * through If-None-Match and skip the re-download.
 */
export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const role = session.user.role;
  if (role !== 'FOUNDER' && role !== 'PARTNER') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const asset = await prisma.contentAsset.findFirst({
    where: { id: params.id, deletedAt: null },
    select: { driveFileId: true, driveChecksum: true },
  });
  if (!asset) {
    return NextResponse.json({ error: 'asset not found' }, { status: 404 });
  }
  if (!asset.driveFileId) {
    return NextResponse.json(
      { error: 'asset has no drive file (not a Drive-sourced asset)' },
      { status: 404 },
    );
  }

  // Conditional GET: if the caller still has the bytes cached under the
  // same checksum, tell them to reuse them.
  const etag = asset.driveChecksum ? `"${asset.driveChecksum}"` : null;
  const ifNoneMatch = req.headers.get('if-none-match');
  if (etag && ifNoneMatch && ifNoneMatch === etag) {
    return new Response(null, { status: 304, headers: { etag } });
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
    return NextResponse.json(
      { error: 'drive fetch failed', detail: message },
      { status: 502 },
    );
  }

  const headers: Record<string, string> = {
    'Content-Type': mime,
    'Content-Length': String(bytes.length),
    // Private — this is operator-session-gated content, must not be
    // stored by shared CDNs. 1-day TTL is conservative for asset bytes
    // that only change when Drive checksum changes (which also changes
    // the ETag, so a stale entry is still cheaply revalidated).
    'Cache-Control': 'private, max-age=86400, must-revalidate',
  };
  if (etag) headers['ETag'] = etag;

  // Convert Node Buffer to Uint8Array for the Web Response body.
  return new Response(new Uint8Array(bytes), { status: 200, headers });
}
