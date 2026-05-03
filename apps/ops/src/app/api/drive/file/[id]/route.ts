import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@xcrm/db';
import { fetchFileBytes, fetchDriveThumbnail } from '@xcrm/drive-adapter';
import {
  isBrowserRenderable,
  convertToBrowserJpeg,
} from '@/lib/image-convert';

/**
 * GET /api/drive/file/[id]
 *
 * Streams a ContentAsset's file bytes, fetched server-side through the
 * service-account JWT. iPhone HEIC/HEIF and other browser-incompatible
 * formats are transparently re-encoded to JPEG via sharp so the
 * operator never has to think about source format.
 *
 * Auth: requires an ops session (FOUNDER | PARTNER).
 *
 * Caching: private, 1-day max-age. ETag derived from Drive's md5 +
 * a "-jpg" suffix when we re-encoded — keeps converted output cached
 * separately from the original.
 *
 * Diagnostic mode: ?probe=1 returns JSON `{ok, mime, ...}` instead of
 * bytes. The `<AssetImage>` UI fallback fetches this on render error
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
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const role = session.user.role;
  if (role !== 'FOUNDER' && role !== 'PARTNER') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const asset = await prisma.contentAsset.findFirst({
    where: { id: params.id, deletedAt: null },
    select: { driveFileId: true, driveChecksum: true, type: true },
  });
  if (!asset) {
    return NextResponse.json({ error: 'asset not found' }, { status: 404 });
  }
  if (!asset.driveFileId) {
    return NextResponse.json(
      {
        error: 'asset has no drive file',
        detail: 'Asset is not Drive-sourced (e.g. portal upload).',
      },
      { status: 404 },
    );
  }

  // Fetch original bytes.
  let originalBytes: Buffer;
  let originalMime: string;
  try {
    const res = await fetchFileBytes(asset.driveFileId);
    originalBytes = res.bytes;
    originalMime = res.mime;
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

  // Decide: ship as-is, or re-encode? Only image/* outside the
  // browser-renderable set go through sharp. Videos pass through as
  // their original mime so the <video> tag works.
  let outBytes: Buffer = originalBytes;
  let outMime: string = originalMime;
  let converted = false;
  let convertedVia: 'sharp' | 'drive-thumbnail' | null = null;
  if (
    originalMime.startsWith('image/') &&
    !isBrowserRenderable(originalMime)
  ) {
    try {
      const out = await convertToBrowserJpeg(originalBytes);
      outBytes = out.bytes;
      outMime = out.mime;
      converted = true;
      convertedVia = 'sharp';
      console.log(
        `[drive:file] assetId=${params.id} sharp ${originalMime} → image/jpeg (${originalBytes.length} → ${outBytes.length} bytes)`,
      );
    } catch (sharpErr) {
      // Sharp's bundled libheif covers HEVC-HEIC but not every HEIF
      // compression variant (newer iPhones encode AV1-HEIF, etc.).
      // Drive transcodes every uploaded image to a JPEG thumbnail
      // server-side regardless of source codec — universal fallback.
      const sharpMessage =
        sharpErr instanceof Error ? sharpErr.message : String(sharpErr);
      console.warn(
        `[drive:file] assetId=${params.id} mime=${originalMime} sharp failed; falling back to Drive thumbnail. sharp said: ${sharpMessage}`,
      );
      try {
        const thumb = await fetchDriveThumbnail(asset.driveFileId, {
          sizePx: 1600,
        });
        outBytes = thumb.bytes;
        outMime = thumb.mime;
        converted = true;
        convertedVia = 'drive-thumbnail';
        console.log(
          `[drive:file] assetId=${params.id} drive-thumbnail ${originalMime} → ${outMime} (${outBytes.length} bytes)`,
        );
      } catch (thumbErr) {
        const thumbMessage =
          thumbErr instanceof Error ? thumbErr.message : String(thumbErr);
        console.error(
          `[drive:file] assetId=${params.id} mime=${originalMime} drive-thumbnail also failed:`,
          thumbMessage,
        );
        return NextResponse.json(
          {
            error: 'unsupported image format',
            mime: originalMime,
            detail: `Sharp couldn't decode it (${sharpMessage}); Drive thumbnail fallback also failed (${thumbMessage}).`,
          },
          { status: 415 },
        );
      }
    }
  } else {
    console.log(
      `[drive:file] assetId=${params.id} mime=${originalMime} size=${originalBytes.length}`,
    );
  }

  if (probe) {
    return NextResponse.json({
      ok: true,
      assetId: params.id,
      assetType: asset.type,
      driveFileId: asset.driveFileId,
      mime: outMime,
      originalMime,
      converted,
      convertedVia,
      size: outBytes.length,
      originalSize: originalBytes.length,
      browserRenderable: true,
    });
  }

  // ETag distinguishes converted output so a converted-then-re-fetched
  // request gets the cached JPEG, not the raw HEIC bytes. Suffix
  // includes the conversion path so a sharp result can't pollute
  // the cache for a thumbnail-fallback result and vice-versa.
  const etag = asset.driveChecksum
    ? `"${asset.driveChecksum}${converted ? `-${convertedVia ?? 'jpg'}` : ''}"`
    : null;
  const ifNoneMatch = req.headers.get('if-none-match');
  if (etag && ifNoneMatch && ifNoneMatch === etag) {
    return new Response(null, { status: 304, headers: { etag } });
  }

  const headers: Record<string, string> = {
    'Content-Type': outMime,
    'Content-Length': String(outBytes.length),
    'Cache-Control': 'private, max-age=86400, must-revalidate',
    'X-Drive-Mime': originalMime,
    ...(converted
      ? {
          'X-Drive-Converted': '1',
          'X-Drive-Converted-Via': convertedVia ?? 'unknown',
        }
      : {}),
  };
  if (etag) headers['ETag'] = etag;

  return new Response(new Uint8Array(outBytes), { status: 200, headers });
}
