import { describe, it, expect } from 'vitest';
import { AccountStatus, PostStatus } from '@xcrm/db';
import {
  isGenerationEligible,
  needsReview,
  routePostStatus,
  GENERATION_ELIGIBLE_STATUSES,
} from './confidence-routing';

describe('isGenerationEligible', () => {
  it('includes the four active statuses', () => {
    expect(isGenerationEligible(AccountStatus.FRESH_BUILD)).toBe(true);
    expect(isGenerationEligible(AccountStatus.ACTIVE_RAMPING)).toBe(true);
    expect(isGenerationEligible(AccountStatus.ACTIVE_ESTABLISHED)).toBe(true);
    expect(isGenerationEligible(AccountStatus.ACTIVE_MATURE)).toBe(true);
  });
  it('excludes non-generating statuses', () => {
    expect(isGenerationEligible(AccountStatus.PROSPECT)).toBe(false);
    expect(isGenerationEligible(AccountStatus.ACQUIRED_IN_NICHE)).toBe(false);
    expect(isGenerationEligible(AccountStatus.TAKEOVER)).toBe(false);
    expect(isGenerationEligible(AccountStatus.PAUSED)).toBe(false);
    expect(isGenerationEligible(AccountStatus.OFFBOARDING)).toBe(false);
    expect(isGenerationEligible(AccountStatus.ARCHIVED)).toBe(false);
    expect(isGenerationEligible(AccountStatus.QUARANTINED)).toBe(false);
  });
  it('eligibility list is exactly 4', () => {
    expect(GENERATION_ELIGIBLE_STATUSES).toHaveLength(4);
  });
});

describe('needsReview', () => {
  it('FRESH_BUILD always reviews — even at confidence 1.0', () => {
    expect(needsReview(AccountStatus.FRESH_BUILD, 1)).toBe(true);
    expect(needsReview(AccountStatus.FRESH_BUILD, 0.99)).toBe(true);
    expect(needsReview(AccountStatus.FRESH_BUILD, 0)).toBe(true);
  });

  it('ACTIVE_RAMPING threshold is 0.8', () => {
    expect(needsReview(AccountStatus.ACTIVE_RAMPING, 0.79)).toBe(true);
    expect(needsReview(AccountStatus.ACTIVE_RAMPING, 0.8)).toBe(false);
    expect(needsReview(AccountStatus.ACTIVE_RAMPING, 1)).toBe(false);
  });

  it('ACTIVE_ESTABLISHED threshold is 0.7', () => {
    expect(needsReview(AccountStatus.ACTIVE_ESTABLISHED, 0.69)).toBe(true);
    expect(needsReview(AccountStatus.ACTIVE_ESTABLISHED, 0.7)).toBe(false);
  });

  it('ACTIVE_MATURE threshold is 0.6', () => {
    expect(needsReview(AccountStatus.ACTIVE_MATURE, 0.59)).toBe(true);
    expect(needsReview(AccountStatus.ACTIVE_MATURE, 0.6)).toBe(false);
  });

  it('unknown/skipped status defaults to review (safety)', () => {
    expect(needsReview(AccountStatus.PAUSED, 1)).toBe(true);
    expect(needsReview(AccountStatus.PROSPECT, 0.99)).toBe(true);
  });
});

describe('routePostStatus', () => {
  it('maps needsReview=true → PENDING_APPROVAL', () => {
    expect(routePostStatus(AccountStatus.FRESH_BUILD, 1)).toBe(
      PostStatus.PENDING_APPROVAL,
    );
    expect(routePostStatus(AccountStatus.ACTIVE_RAMPING, 0.5)).toBe(
      PostStatus.PENDING_APPROVAL,
    );
  });
  it('maps needsReview=false → SCHEDULED', () => {
    expect(routePostStatus(AccountStatus.ACTIVE_ESTABLISHED, 0.75)).toBe(
      PostStatus.SCHEDULED,
    );
    expect(routePostStatus(AccountStatus.ACTIVE_MATURE, 0.85)).toBe(
      PostStatus.SCHEDULED,
    );
  });
});
