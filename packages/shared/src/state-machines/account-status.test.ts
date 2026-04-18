import { describe, it, expect } from 'vitest';
import { AccountStatus } from '@xcrm/db';
import { canTransition } from './account-status';

describe('account status transitions', () => {
  it('allows PROSPECT to FRESH_BUILD', () => {
    expect(canTransition(AccountStatus.PROSPECT, AccountStatus.FRESH_BUILD)).toBe(true);
  });

  it('forbids skipping from PROSPECT to ACTIVE_MATURE', () => {
    expect(canTransition(AccountStatus.PROSPECT, AccountStatus.ACTIVE_MATURE)).toBe(false);
  });

  it('allows quarantine from any active state', () => {
    expect(canTransition(AccountStatus.ACTIVE_RAMPING, AccountStatus.QUARANTINED)).toBe(true);
    expect(canTransition(AccountStatus.ACTIVE_MATURE, AccountStatus.QUARANTINED)).toBe(true);
  });

  it('ARCHIVED is terminal', () => {
    expect(canTransition(AccountStatus.ARCHIVED, AccountStatus.ACTIVE_MATURE)).toBe(false);
  });

  it('OFFBOARDING goes only to ARCHIVED', () => {
    expect(canTransition(AccountStatus.OFFBOARDING, AccountStatus.ARCHIVED)).toBe(true);
    expect(canTransition(AccountStatus.OFFBOARDING, AccountStatus.ACTIVE_MATURE)).toBe(false);
  });
});
