/**
 * Pure aggregation logic for Build G — engagement learning loop.
 *
 * Inputs come from the orchestrator after a Prisma query; outputs feed
 * the generator's prompt and the per-account peak-hour recomputation.
 * Kept as pure functions so the algorithms are tunable + testable
 * without a DB.
 */

export const DEFAULT_PEAK_HOURS = [9, 12, 18, 21];

/** Weighted score for a single engagement snapshot. Tunable. */
export function engagementScore(e: {
  likes: number;
  reposts: number;
  replies: number;
  bookmarks: number;
  impressions: number;
  profileClicks: number;
}): number {
  // Likes baseline; reposts strongest signal of resonance; replies and
  // bookmarks both indicate intent. Profile clicks weighted only when
  // impressions exist to act as a denominator floor.
  const base =
    e.likes * 1 +
    e.reposts * 3 +
    e.replies * 2 +
    e.bookmarks * 2 +
    (e.impressions > 0 ? e.profileClicks * 0.5 : 0);
  return base;
}

/**
 * Engagement-per-impression — useful for comparing posts with very
 * different reach. Returns 0 when impressions are zero (or absent)
 * rather than dividing by 0.
 */
export function engagementRate(e: {
  likes: number;
  reposts: number;
  replies: number;
  bookmarks: number;
  impressions: number;
  profileClicks: number;
}): number {
  if (!e.impressions || e.impressions <= 0) return 0;
  return engagementScore(e) / e.impressions;
}

export type EngagementSample = {
  postId: string;
  scheduledFor: Date | null;
  postedAt: Date | null;
  likes: number;
  reposts: number;
  replies: number;
  bookmarks: number;
  impressions: number;
  profileClicks: number;
  // Optional facet tags pulled from the asset's autoTags JSON, used
  // for facet aggregation. Anything we don't have stays null.
  aesthetic: string | null;
  mood: string | null;
  lighting: string | null;
};

export type FacetSummary = {
  /** Facet value, e.g. "clean-girl" or "golden-hour". */
  key: string;
  /** Average engagement-per-impression across samples with this facet. */
  avgRate: number;
  /** Sample count contributing to the average. */
  count: number;
};

/**
 * Top-K facet performance across an engagement-sample set.
 *
 * Uses the engagement-rate (per-impression) so a facet that appears
 * in low-reach posts isn't unfairly buried. Filters out facets with
 * fewer than `minSamples` so the LLM doesn't over-index on a single
 * lucky post.
 */
export function topFacetsByRate(
  samples: EngagementSample[],
  facet: 'aesthetic' | 'mood' | 'lighting',
  opts: { topK?: number; minSamples?: number } = {},
): FacetSummary[] {
  const topK = opts.topK ?? 3;
  const minSamples = opts.minSamples ?? 2;

  const groups = new Map<string, { totalRate: number; count: number }>();
  for (const s of samples) {
    const v = s[facet];
    if (!v) continue;
    const rate = engagementRate(s);
    const cur = groups.get(v) ?? { totalRate: 0, count: 0 };
    cur.totalRate += rate;
    cur.count += 1;
    groups.set(v, cur);
  }

  const summaries: FacetSummary[] = [];
  for (const [key, { totalRate, count }] of groups) {
    if (count < minSamples) continue;
    summaries.push({ key, avgRate: totalRate / count, count });
  }
  summaries.sort((a, b) => b.avgRate - a.avgRate);
  return summaries.slice(0, topK);
}

/**
 * Pick the best UTC hours for an account by total weighted engagement.
 * Returns ascending integers in [0..23], capped at `k`.
 *
 * Falls back to merging `DEFAULT_PEAK_HOURS` when fewer than `k`
 * distinct hours have any signal — keeps the scheduler from collapsing
 * to a single peak when an account is new.
 */
export function derivePeakHours(
  samples: EngagementSample[],
  k = 4,
): number[] {
  const buckets = new Map<number, number>();
  for (const s of samples) {
    const ts = s.postedAt ?? s.scheduledFor;
    if (!ts) continue;
    const hour = ts.getUTCHours();
    const score = engagementScore(s);
    buckets.set(hour, (buckets.get(hour) ?? 0) + score);
  }

  const ranked = [...buckets.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .map(([h]) => h);

  // Take top-k, then top up with defaults for any shortfall.
  const chosen = new Set<number>();
  for (const h of ranked) {
    if (chosen.size >= k) break;
    chosen.add(h);
  }
  for (const h of DEFAULT_PEAK_HOURS) {
    if (chosen.size >= k) break;
    chosen.add(h);
  }
  return [...chosen].sort((a, b) => a - b).slice(0, k);
}

/**
 * Engagement-summary shape passed to the generator prompt. Optional
 * fields: render only what we have signal for.
 */
export type EngagementSummary = {
  sampleCount: number;
  topAesthetics: FacetSummary[];
  topMoods: FacetSummary[];
  topLightings: FacetSummary[];
  peakHoursUtc: number[];
};

export function summariseEngagement(
  samples: EngagementSample[],
): EngagementSummary {
  return {
    sampleCount: samples.length,
    topAesthetics: topFacetsByRate(samples, 'aesthetic'),
    topMoods: topFacetsByRate(samples, 'mood'),
    topLightings: topFacetsByRate(samples, 'lighting'),
    peakHoursUtc: derivePeakHours(samples, 4),
  };
}
