import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@xcrm/db';

/**
 * POST /api/engagement/ingest
 *
 * Source-agnostic engagement ingest. Manual entry posts to this from
 * the operator UI; a future X-API or scraping ingestor hits the same
 * endpoint with the same body shape. Auth: shared `CRON_SECRET`.
 *
 * Body accepts EITHER `postId` (xcrm Post id) OR `platformPostId` (the
 * X-side id). When platformPostId is provided we resolve it to the
 * Post via the unique-but-partial `Post_platformPostId_active_key`
 * index (live posts only).
 *
 * Each call inserts a fresh `PostEngagement` snapshot — engagement
 * grows over time and we keep history. The recompute cron reads the
 * latest snapshot per post.
 */
const bodySchema = z
  .object({
    postId: z.string().min(1).optional(),
    platformPostId: z.string().min(1).optional(),
    likes: z.number().int().min(0).default(0),
    reposts: z.number().int().min(0).default(0),
    replies: z.number().int().min(0).default(0),
    bookmarks: z.number().int().min(0).default(0),
    impressions: z.number().int().min(0).default(0),
    profileClicks: z.number().int().min(0).default(0),
    capturedAt: z.string().datetime().optional(),
  })
  .refine((v) => v.postId || v.platformPostId, {
    message: 'postId or platformPostId is required',
  });

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'CRON_SECRET not configured on this service' },
      { status: 500 },
    );
  }
  const provided = req.headers.get('x-cron-secret');
  if (provided !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'validation failed',
        detail: parsed.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; '),
      },
      { status: 400 },
    );
  }

  // Resolve to a real Post.
  let postId: string | null = parsed.data.postId ?? null;
  if (!postId && parsed.data.platformPostId) {
    const found = await prisma.post.findFirst({
      where: {
        platformPostId: parsed.data.platformPostId,
        deletedAt: null,
      },
      select: { id: true },
    });
    postId = found?.id ?? null;
  }
  if (!postId) {
    return NextResponse.json({ error: 'post not found' }, { status: 404 });
  }

  const created = await prisma.postEngagement.create({
    data: {
      postId,
      likes: parsed.data.likes,
      reposts: parsed.data.reposts,
      replies: parsed.data.replies,
      bookmarks: parsed.data.bookmarks,
      impressions: parsed.data.impressions,
      profileClicks: parsed.data.profileClicks,
      capturedAt: parsed.data.capturedAt
        ? new Date(parsed.data.capturedAt)
        : new Date(),
    },
    select: { id: true, capturedAt: true },
  });

  return NextResponse.json({
    ok: true,
    engagementId: created.id,
    postId,
    capturedAt: created.capturedAt,
  });
}
