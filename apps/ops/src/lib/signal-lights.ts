/**
 * Signal-light computation for the Roster (Surface 2).
 *
 * Every signal is a pure function of raw counts so we can test the
 * threshold boundaries in isolation and compose them without a DB. The
 * loader in `_loaders/roster.ts` pulls the raw counts; this module
 * turns them into a `SignalLightState`.
 *
 * Thresholds match /docs/operational-model.md Surface 2 table. The
 * rubric applies uniformly — any component that invents its own
 * thresholds should fail code review.
 */

export type SignalLightState =
  | 'GREEN'
  | 'YELLOW'
  | 'RED'
  /** Count-only signal (review queue depth) — no color. */
  | 'NEUTRAL'
  /** Data source not yet shipped (runway pre-D, escalated pre-F, review queue pre-E). */
  | 'STUB';

export type Severity = 0 | 1 | 2 | 3;
/** 0 = STUB/NEUTRAL (no severity contribution); 1 = GREEN; 2 = YELLOW; 3 = RED. */
export function severityOf(state: SignalLightState): Severity {
  if (state === 'RED') return 3;
  if (state === 'YELLOW') return 2;
  if (state === 'GREEN') return 1;
  return 0;
}

// ---------------------------------------------------------------------------
// Per-signal thresholds
// ---------------------------------------------------------------------------

/** Content runway: GREEN >7d · YELLOW 3–7d · RED <3d. STUB pre-Build D. */
export function contentRunwayState(
  daysOfScheduledPosts: number | null,
): SignalLightState {
  if (daysOfScheduledPosts === null) return 'STUB';
  if (daysOfScheduledPosts < 3) return 'RED';
  if (daysOfScheduledPosts <= 7) return 'YELLOW';
  return 'GREEN';
}

/** Escalated tasks: GREEN 0 · YELLOW 1–2 · RED 3+. STUB pre-Build F. */
export function escalatedTasksState(
  count: number | null,
): SignalLightState {
  if (count === null) return 'STUB';
  if (count === 0) return 'GREEN';
  if (count <= 2) return 'YELLOW';
  return 'RED';
}

/** Failed syncs: GREEN 0-in-24h · YELLOW 1–2 in 24h · RED 3+ consecutive. */
export function failedSyncsState(input: {
  failedInLast24h: number;
  consecutiveFailuresMostRecent: number;
}): SignalLightState {
  if (input.consecutiveFailuresMostRecent >= 3) return 'RED';
  if (input.failedInLast24h === 0) return 'GREEN';
  return 'YELLOW';
}

/** Quarantined accounts: GREEN 0 · RED any. */
export function quarantinedAccountsState(count: number): SignalLightState {
  return count > 0 ? 'RED' : 'GREEN';
}

/**
 * Incomplete onboarding: YELLOW if `onboardingCompletedAt IS NULL`.
 * Unlike the other signals this is a "show-only-when-yellow" signal —
 * a fully-onboarded model simply doesn't render the pill.
 */
export function incompleteOnboardingState(
  onboardingCompletedAt: Date | null,
): 'YELLOW' | null {
  return onboardingCompletedAt === null ? 'YELLOW' : null;
}

/** Review queue depth: NEUTRAL with a count (no color). STUB pre-Build E. */
export function reviewQueueState(count: number | null): SignalLightState {
  if (count === null) return 'STUB';
  return 'NEUTRAL';
}

// ---------------------------------------------------------------------------
// Roster sort
// ---------------------------------------------------------------------------

/**
 * Pick the row's severity group from its bundle of signal states.
 * "Worst-wins" — a row with both red and yellow lands in the red group.
 */
export function rowSeverity(states: SignalLightState[]): Severity {
  let worst: Severity = 0;
  for (const s of states) {
    const sev = severityOf(s);
    if (sev > worst) worst = sev;
  }
  return worst;
}

/**
 * Sort order for the roster: red group first, then yellow, then
 * green/unknown. Alphabetical by `displayName` within each group.
 *
 * The comparator is stable: `Array#sort` on modern Node is stable, so
 * items with equal severity + equal displayName maintain input order
 * (useful in tests and for predictable UI under load).
 */
export function compareRosterRows<T extends { severity: Severity; displayName: string }>(
  a: T,
  b: T,
): number {
  if (a.severity !== b.severity) return b.severity - a.severity; // higher severity first
  return a.displayName.localeCompare(b.displayName);
}
