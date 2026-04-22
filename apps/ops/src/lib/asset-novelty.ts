/**
 * Novelty score — a 0..1 metric combining "how often has this asset
 * been posted" with "how recently was it last used". The generation
 * picker should prefer higher-novelty assets so the feed doesn't
 * repeat itself.
 *
 *   useCount=0, never used                   → 1.00
 *   useCount=0, used 1 day ago (impossible)  → 1.00   (clamped)
 *   useCount=1, used 14+ days ago            → 0.50
 *   useCount=3, used yesterday               → ~0.018
 *
 * Derived purely from ContentAsset.useCount + .lastUsedAt so there's
 * no schema change — callers just pass the two fields.
 */
export function computeNoveltyScore(a: {
  useCount: number;
  lastUsedAt: Date | null;
}): number {
  const useTerm = 1 / (1 + Math.max(0, a.useCount));
  const days = a.lastUsedAt
    ? (Date.now() - a.lastUsedAt.getTime()) / 86_400_000
    : Infinity;
  // Recovery window: 14 days back to full recency-weight. Linear before that.
  const recencyTerm = days >= 14 ? 1 : Math.max(0, days / 14);
  const score = useTerm * recencyTerm;
  return Math.max(0, Math.min(1, score));
}
