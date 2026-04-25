import { prisma, PostStatus } from '@xcrm/db';

export type ReviewQueueItem = {
  id: string;
  copy: string;
  assetId: string | null;
  scheduledFor: Date | null;
  confidenceScore: number | null;
  reasoning: string | null;
  createdAt: Date;
  account: {
    id: string;
    handle: string;
    status: string;
  };
  model: {
    id: string;
    displayName: string;
    archetype: string;
    agencySlug: string;
    hardRules: string[];
    softPreferences: string[];
  };
};

/**
 * All `PENDING_APPROVAL` posts across every model, FIFO by createdAt.
 * Build E v1 keeps it as one global list — no per-model filtering and
 * no pagination. Filtering belongs in a follow-up if N gets large.
 *
 * Capped at 100 to keep the page render bounded; if a queue ever
 * actually overflows that, the operator probably has bigger problems.
 */
export async function getReviewQueue(): Promise<ReviewQueueItem[]> {
  const rows = await prisma.post.findMany({
    where: {
      status: PostStatus.PENDING_APPROVAL,
      deletedAt: null,
    },
    orderBy: { createdAt: 'asc' },
    take: 100,
    include: {
      account: {
        select: {
          id: true,
          handle: true,
          status: true,
          model: {
            select: {
              id: true,
              displayName: true,
              archetype: true,
              hardRules: true,
              softPreferences: true,
              agency: { select: { slug: true } },
            },
          },
        },
      },
    },
  });

  return rows.map((r) => {
    const meta = (r.generationMeta ?? {}) as Record<string, unknown>;
    return {
      id: r.id,
      copy: r.copy,
      assetId: r.assetIds[0] ?? null,
      scheduledFor: r.scheduledFor,
      confidenceScore: r.confidenceScore,
      reasoning:
        typeof meta.reasoning === 'string' ? (meta.reasoning as string) : null,
      createdAt: r.createdAt,
      account: {
        id: r.account.id,
        handle: r.account.handle,
        status: r.account.status,
      },
      model: {
        id: r.account.model.id,
        displayName: r.account.model.displayName,
        archetype: r.account.model.archetype,
        agencySlug: r.account.model.agency.slug,
        hardRules: arrayOfStrings(r.account.model.hardRules),
        softPreferences: arrayOfStrings(r.account.model.softPreferences),
      },
    };
  });
}

function arrayOfStrings(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === 'string');
}
