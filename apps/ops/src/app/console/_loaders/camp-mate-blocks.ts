import { prisma, CampStatus, PostStatus } from '@xcrm/db';
import {
  assetsBlockedByCampMates,
  CAMP_ASSET_SPACING_HOURS,
} from '@/lib/camp-spacing';

/**
 * Returns the set of asset IDs blocked by Build H's camp-spacing
 * rule for the given account. Read-only; called from
 * `loadCandidateAssets`.
 *
 * Algorithm:
 *   1. Find ACTIVE camps the target account belongs to.
 *   2. Gather all OTHER accounts in those camps (the "camp-mates").
 *   3. Pull live Posts (PENDING_APPROVAL / APPROVED / SCHEDULED /
 *      POSTED) on those camp-mates with a timestamp within the
 *      spacing window.
 *   4. Reduce to a Set<assetId> via the pure spacing helper.
 *
 * Returns an empty Set when the account is in no ACTIVE camps —
 * cheap fast path for the common case.
 */
export async function loadCampMateBlocks(
  accountId: string,
  now: Date = new Date(),
): Promise<Set<string>> {
  const memberships = await prisma.campMembership.findMany({
    where: {
      accountId,
      camp: { status: CampStatus.ACTIVE },
    },
    select: { campId: true },
  });
  if (memberships.length === 0) return new Set();

  const campIds = memberships.map((m) => m.campId);
  const mateMemberships = await prisma.campMembership.findMany({
    where: {
      campId: { in: campIds },
      accountId: { not: accountId },
    },
    select: { accountId: true },
  });
  const mateAccountIds = Array.from(
    new Set(mateMemberships.map((m) => m.accountId)),
  );
  if (mateAccountIds.length === 0) return new Set();

  const spacingMs = CAMP_ASSET_SPACING_HOURS * 60 * 60 * 1000;
  const windowStart = new Date(now.getTime() - spacingMs);
  const windowEnd = new Date(now.getTime() + spacingMs);

  const livePosts = await prisma.post.findMany({
    where: {
      accountId: { in: mateAccountIds },
      deletedAt: null,
      status: {
        in: [
          PostStatus.PENDING_APPROVAL,
          PostStatus.APPROVED,
          PostStatus.SCHEDULED,
          PostStatus.POSTED,
        ],
      },
      OR: [
        { scheduledFor: { gte: windowStart, lte: windowEnd } },
        { postedAt: { gte: windowStart, lte: windowEnd } },
      ],
    },
    select: {
      assetIds: true,
      scheduledFor: true,
      postedAt: true,
    },
  });

  const rows = livePosts.flatMap((p) =>
    p.assetIds.map((assetId) => ({
      assetId,
      scheduledFor: p.scheduledFor,
      postedAt: p.postedAt,
    })),
  );
  return assetsBlockedByCampMates(rows, now);
}
