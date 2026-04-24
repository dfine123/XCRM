import { prisma, PostStatus } from '@xcrm/db';

export type ScheduledPostRow = {
  id: string;
  accountId: string;
  accountHandle: string;
  status: PostStatus;
  copy: string;
  assetId: string | null;
  scheduledFor: Date | null;
  confidenceScore: number | null;
  reasoning: string | null;
  createdAt: Date;
};

/**
 * Load the model's upcoming + pending-review posts for the Surface 3
 * #scheduled block. Capped at 20 most-recent across all accounts on
 * the model — mirrors the audit-block cap.
 *
 * Sort: scheduled-future first (nearest first), then pending-approval
 * without a scheduledFor (createdAt desc). Newly-created
 * PENDING_APPROVAL rows always surface at the top so the operator
 * can triage them.
 */
export async function getScheduledPostsForModel(
  modelId: string,
  limit = 20,
): Promise<ScheduledPostRow[]> {
  const rows = await prisma.post.findMany({
    where: {
      account: { modelId, deletedAt: null },
      deletedAt: null,
      status: {
        in: [
          PostStatus.PENDING_APPROVAL,
          PostStatus.APPROVED,
          PostStatus.SCHEDULED,
        ],
      },
    },
    include: {
      account: { select: { id: true, handle: true } },
    },
    orderBy: [{ scheduledFor: 'asc' }, { createdAt: 'desc' }],
    take: limit,
  });

  return rows.map((r) => {
    const meta = (r.generationMeta ?? {}) as Record<string, unknown>;
    return {
      id: r.id,
      accountId: r.account.id,
      accountHandle: r.account.handle,
      status: r.status,
      copy: r.copy,
      assetId: r.assetIds[0] ?? null,
      scheduledFor: r.scheduledFor,
      confidenceScore: r.confidenceScore,
      reasoning:
        typeof meta.reasoning === 'string' ? (meta.reasoning as string) : null,
      createdAt: r.createdAt,
    };
  });
}
