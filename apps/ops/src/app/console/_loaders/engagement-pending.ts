import { prisma, PostStatus } from '@xcrm/db';

export type PendingEngagementRow = {
  postId: string;
  copy: string;
  postedAt: Date | null;
  scheduledFor: Date | null;
  accountHandle: string;
  modelId: string;
  modelDisplayName: string;
  agencySlug: string;
  assetId: string | null;
  latest: {
    likes: number;
    reposts: number;
    replies: number;
    bookmarks: number;
    impressions: number;
    profileClicks: number;
    capturedAt: Date;
  } | null;
};

const STALE_AFTER_HOURS = 6;

/**
 * Surface POSTED posts that need engagement attention:
 *   - never had a snapshot, OR
 *   - latest snapshot is older than STALE_AFTER_HOURS
 *
 * Cap 100. Newest first. Single global feed for the operator's
 * manual-entry flow; pre-real-ingestion, the volume is whatever the
 * operator typed in last.
 */
export async function getPostsNeedingEngagement(): Promise<PendingEngagementRow[]> {
  const staleCutoff = new Date(
    Date.now() - STALE_AFTER_HOURS * 60 * 60 * 1000,
  );

  const rows = await prisma.post.findMany({
    where: {
      status: PostStatus.POSTED,
      deletedAt: null,
    },
    orderBy: { postedAt: 'desc' },
    take: 100,
    include: {
      account: {
        select: {
          handle: true,
          model: {
            select: {
              id: true,
              displayName: true,
              agency: { select: { slug: true } },
            },
          },
        },
      },
      engagements: {
        orderBy: { capturedAt: 'desc' },
        take: 1,
      },
    },
  });

  return rows
    .filter(
      (r) => r.engagements.length === 0 || r.engagements[0]!.capturedAt < staleCutoff,
    )
    .map((r) => {
      const e = r.engagements[0] ?? null;
      return {
        postId: r.id,
        copy: r.copy,
        postedAt: r.postedAt,
        scheduledFor: r.scheduledFor,
        accountHandle: r.account.handle,
        modelId: r.account.model.id,
        modelDisplayName: r.account.model.displayName,
        agencySlug: r.account.model.agency.slug,
        assetId: r.assetIds[0] ?? null,
        latest: e
          ? {
              likes: e.likes,
              reposts: e.reposts,
              replies: e.replies,
              bookmarks: e.bookmarks,
              impressions: e.impressions,
              profileClicks: e.profileClicks,
              capturedAt: e.capturedAt,
            }
          : null,
      };
    });
}
