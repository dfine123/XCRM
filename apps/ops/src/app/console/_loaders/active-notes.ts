import { prisma, ContextNoteStatus, type Archetype } from '@xcrm/db';
import { noteAppliesTo, parseScope, type Scope } from '@/lib/context-notes';

export type ActiveNote = {
  id: string;
  title: string;
  body: string;
  weight: number;
  effectiveFrom: Date;
  effectiveUntil: Date | null;
  scope: Scope;
  authorName: string;
};

/**
 * All ACTIVE notes currently in effect (effectiveFrom <= now,
 * effectiveUntil in the future or null). Ordered by weight desc so
 * the loudest notes surface first in the roster strip.
 *
 * Expected count at steady state: single digits. No pagination.
 */
export async function getActiveNotes(): Promise<ActiveNote[]> {
  const now = new Date();
  const rows = await prisma.contextNote.findMany({
    where: {
      status: ContextNoteStatus.ACTIVE,
      effectiveFrom: { lte: now },
      OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }],
    },
    orderBy: [{ weight: 'desc' }, { createdAt: 'desc' }],
    include: { author: { select: { name: true, email: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    weight: r.weight,
    effectiveFrom: r.effectiveFrom,
    effectiveUntil: r.effectiveUntil,
    scope: parseScope(r.scope),
    authorName: r.author.name || r.author.email,
  }));
}

/**
 * The subset of `allActive` that applies to the given model. In-JS
 * filter via `noteAppliesTo` — fine because active-note counts are
 * expected in the single digits per the product spec.
 */
export function filterNotesForModel(
  allActive: ActiveNote[],
  model: { archetype: Archetype; accountIds: string[] },
): ActiveNote[] {
  return allActive.filter((n) => noteAppliesTo(n.scope, model));
}
