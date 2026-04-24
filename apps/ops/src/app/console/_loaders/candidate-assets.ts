import {
  prisma,
  AssetTagStatus,
  AssetType,
  PostStatus,
} from '@xcrm/db';
import { computeNoveltyScore } from '@/lib/asset-novelty';
import type { Prompts } from '@xcrm/shared';

const POOL_CAP = 30;

/**
 * Pool for generation: ContentAssets this account can use next.
 *
 * Predicate:
 *   - asset belongs to the account's model
 *   - not soft-deleted
 *   - tagStatus=TAGGED (the orchestrator needs the autoTags JSON)
 *   - type ∈ {PHOTO, GIF}  — v1 skips VIDEO (VA flow + upload UX deferred)
 *   - never used on THIS account (AssetUsage.none)
 *   - not already committed to a PENDING_APPROVAL | APPROVED | SCHEDULED
 *     Post on this account (avoid the generator double-booking an asset)
 *
 * After the predicate, rank by `computeNoveltyScore` desc and take the
 * top POOL_CAP. Novelty is a tiebreaker — Claude is told to favour tone
 * fit over novelty, so the pool doesn't need to be massive.
 *
 * Returns the already-mapped `Prompts.DraftPromptAsset` shape so the
 * orchestrator can feed the output straight into the prompt builder.
 */
export async function loadCandidateAssets(
  accountId: string,
): Promise<Prompts.DraftPromptAsset[]> {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { modelId: true, deletedAt: true },
  });
  if (!account || account.deletedAt) return [];

  // Assets already committed to live/pending Posts — we flatten their
  // assetIds and exclude them from the pool.
  const committedPosts = await prisma.post.findMany({
    where: {
      accountId,
      deletedAt: null,
      status: {
        in: [
          PostStatus.PENDING_APPROVAL,
          PostStatus.APPROVED,
          PostStatus.SCHEDULED,
        ],
      },
    },
    select: { assetIds: true },
  });
  const committed = new Set<string>();
  for (const p of committedPosts) {
    for (const id of p.assetIds) committed.add(id);
  }

  const rows = await prisma.contentAsset.findMany({
    where: {
      modelId: account.modelId,
      deletedAt: null,
      tagStatus: AssetTagStatus.TAGGED,
      type: { in: [AssetType.PHOTO, AssetType.GIF] },
      usages: { none: { accountId } },
      ...(committed.size > 0
        ? { id: { notIn: Array.from(committed) } }
        : {}),
    },
    select: {
      id: true,
      autoTags: true,
      useCount: true,
      lastUsedAt: true,
    },
    // Ask for a few extra so the novelty sort has room — take() here
    // is generous; we trim to POOL_CAP in JS after scoring.
    take: POOL_CAP * 4,
  });

  type RankedAsset = Prompts.DraftPromptAsset & { _novelty: number };
  const ranked: RankedAsset[] = rows
    .map((a) => {
      const tags = (a.autoTags ?? {}) as Record<string, unknown>;
      const novelty = computeNoveltyScore({
        useCount: a.useCount,
        lastUsedAt: a.lastUsedAt,
      });
      return {
        id: a.id,
        caption: typeof tags.caption === 'string' ? tags.caption : null,
        mood: typeof tags.mood === 'string' ? tags.mood : null,
        lighting: typeof tags.lighting === 'string' ? tags.lighting : null,
        aesthetic:
          typeof tags.aesthetic === 'string' ? tags.aesthetic : null,
        nsfwRating:
          typeof tags.nsfwRating === 'string' ? tags.nsfwRating : null,
        novelty,
        _novelty: novelty,
      };
    })
    .sort((a, b) => b._novelty - a._novelty)
    .slice(0, POOL_CAP);

  return ranked.map(({ _novelty, ...rest }) => {
    void _novelty;
    return rest;
  });
}
