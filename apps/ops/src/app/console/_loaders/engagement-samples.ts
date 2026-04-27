import { prisma, PostStatus } from '@xcrm/db';
import type { EngagementSample } from '@/lib/engagement-aggregation';

const DEFAULT_WINDOW_DAYS = 30;

/**
 * Pull the latest engagement snapshot per POSTED Post for an account
 * within `windowDays` and project to the `EngagementSample` shape the
 * aggregation lib consumes.
 *
 * Asset facets (aesthetic, mood, lighting) are read from
 * `ContentAsset.autoTags` JSON when the post has exactly one
 * assetId — the common case.
 */
export async function loadEngagementSamplesForAccount(
  accountId: string,
  opts: { windowDays?: number } = {},
): Promise<EngagementSample[]> {
  const since = new Date(
    Date.now() - (opts.windowDays ?? DEFAULT_WINDOW_DAYS) * 86_400_000,
  );

  const posts = await prisma.post.findMany({
    where: {
      accountId,
      status: PostStatus.POSTED,
      deletedAt: null,
      postedAt: { gte: since },
    },
    select: {
      id: true,
      scheduledFor: true,
      postedAt: true,
      assetIds: true,
      engagements: {
        orderBy: { capturedAt: 'desc' },
        take: 1,
        select: {
          likes: true,
          reposts: true,
          replies: true,
          bookmarks: true,
          impressions: true,
          profileClicks: true,
        },
      },
    },
  });

  // Resolve all referenced asset IDs in one query so we can pull
  // facets without N+1 lookups.
  const assetIds = Array.from(
    new Set(posts.flatMap((p) => p.assetIds.slice(0, 1))),
  );
  const assets = assetIds.length
    ? await prisma.contentAsset.findMany({
        where: { id: { in: assetIds } },
        select: { id: true, autoTags: true },
      })
    : [];
  const tagsById = new Map(assets.map((a) => [a.id, a.autoTags] as const));

  const out: EngagementSample[] = [];
  for (const p of posts) {
    if (p.engagements.length === 0) continue;
    const e = p.engagements[0]!;
    const assetId = p.assetIds[0];
    const tags = (assetId
      ? (tagsById.get(assetId) as Record<string, unknown> | undefined)
      : undefined) ?? {};
    out.push({
      postId: p.id,
      scheduledFor: p.scheduledFor,
      postedAt: p.postedAt,
      likes: e.likes,
      reposts: e.reposts,
      replies: e.replies,
      bookmarks: e.bookmarks,
      impressions: e.impressions,
      profileClicks: e.profileClicks,
      aesthetic: typeof tags.aesthetic === 'string' ? tags.aesthetic : null,
      mood: typeof tags.mood === 'string' ? tags.mood : null,
      lighting: typeof tags.lighting === 'string' ? tags.lighting : null,
    });
  }
  return out;
}
