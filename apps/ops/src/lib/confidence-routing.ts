import { AccountStatus, PostStatus } from '@xcrm/db';

/**
 * Confidence-routing thresholds per account status.
 *
 * Below the threshold → PENDING_APPROVAL (operator review).
 * At or above → SCHEDULED (auto-approved, ready for the VA task queue
 * once Build F lands).
 *
 * Values are tunable but codified here so no UI component invents its
 * own. Changing them is an intentional act — update the test fixtures
 * alongside.
 *
 * Statuses not listed (PAUSED, OFFBOARDING, ARCHIVED, QUARANTINED,
 * PROSPECT, ACQUIRED_IN_NICHE, TAKEOVER) are "skip generation" — the
 * orchestrator doesn't even call the LLM for them.
 */
const REVIEW_THRESHOLDS: Partial<Record<AccountStatus, number>> = {
  [AccountStatus.FRESH_BUILD]: 1.01, // always review
  [AccountStatus.ACTIVE_RAMPING]: 0.8,
  [AccountStatus.ACTIVE_ESTABLISHED]: 0.7,
  [AccountStatus.ACTIVE_MATURE]: 0.6,
};

/**
 * Account statuses the generator runs against. Anything not in this
 * set is silently skipped by the orchestrator.
 */
export const GENERATION_ELIGIBLE_STATUSES: AccountStatus[] = [
  AccountStatus.FRESH_BUILD,
  AccountStatus.ACTIVE_RAMPING,
  AccountStatus.ACTIVE_ESTABLISHED,
  AccountStatus.ACTIVE_MATURE,
];

export function isGenerationEligible(status: AccountStatus): boolean {
  return GENERATION_ELIGIBLE_STATUSES.includes(status);
}

/**
 * Does a draft with this confidence, for an account in this status,
 * need operator review?
 */
export function needsReview(
  accountStatus: AccountStatus,
  confidence: number,
): boolean {
  const threshold = REVIEW_THRESHOLDS[accountStatus];
  // Safety default: if we somehow reach this with a non-eligible
  // status (e.g. the orchestrator missed a filter), require review.
  if (threshold === undefined) return true;
  return confidence < threshold;
}

/**
 * Decide the Post.status to persist for a new draft. Centralised so
 * the orchestrator has one choice point rather than a pair of
 * conditionals.
 */
export function routePostStatus(
  accountStatus: AccountStatus,
  confidence: number,
): typeof PostStatus.PENDING_APPROVAL | typeof PostStatus.SCHEDULED {
  return needsReview(accountStatus, confidence)
    ? PostStatus.PENDING_APPROVAL
    : PostStatus.SCHEDULED;
}
