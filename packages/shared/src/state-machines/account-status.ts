import { AccountStatus } from '@xcrm/db';

/**
 * Enforced account status transitions (spec §1.3).
 * Can't jump PROSPECT → ACTIVE_MATURE — must walk the states.
 * Any transition not listed here must be rejected by the service layer.
 */
export const ACCOUNT_STATUS_TRANSITIONS: Record<AccountStatus, AccountStatus[]> = {
  PROSPECT: [AccountStatus.FRESH_BUILD, AccountStatus.ACQUIRED_AGED, AccountStatus.ACQUIRED_IN_NICHE, AccountStatus.TAKEOVER, AccountStatus.ARCHIVED],
  FRESH_BUILD: [AccountStatus.ACTIVE_RAMPING, AccountStatus.QUARANTINED, AccountStatus.ARCHIVED, AccountStatus.PAUSED],
  ACQUIRED_AGED: [AccountStatus.ACTIVE_RAMPING, AccountStatus.QUARANTINED, AccountStatus.ARCHIVED, AccountStatus.PAUSED],
  ACQUIRED_IN_NICHE: [AccountStatus.ACTIVE_RAMPING, AccountStatus.QUARANTINED, AccountStatus.ARCHIVED, AccountStatus.PAUSED],
  TAKEOVER: [AccountStatus.ACTIVE_RAMPING, AccountStatus.ACTIVE_ESTABLISHED, AccountStatus.QUARANTINED, AccountStatus.ARCHIVED, AccountStatus.PAUSED],
  ACTIVE_RAMPING: [AccountStatus.ACTIVE_ESTABLISHED, AccountStatus.QUARANTINED, AccountStatus.PAUSED, AccountStatus.OFFBOARDING],
  ACTIVE_ESTABLISHED: [AccountStatus.ACTIVE_MATURE, AccountStatus.ACTIVE_RAMPING, AccountStatus.QUARANTINED, AccountStatus.PAUSED, AccountStatus.OFFBOARDING],
  ACTIVE_MATURE: [AccountStatus.ACTIVE_ESTABLISHED, AccountStatus.QUARANTINED, AccountStatus.PAUSED, AccountStatus.OFFBOARDING],
  PAUSED: [AccountStatus.ACTIVE_RAMPING, AccountStatus.ACTIVE_ESTABLISHED, AccountStatus.ACTIVE_MATURE, AccountStatus.OFFBOARDING, AccountStatus.ARCHIVED],
  QUARANTINED: [AccountStatus.FRESH_BUILD, AccountStatus.PAUSED, AccountStatus.ARCHIVED],
  OFFBOARDING: [AccountStatus.ARCHIVED],
  ARCHIVED: [],
};

export function canTransition(from: AccountStatus, to: AccountStatus): boolean {
  return ACCOUNT_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export class InvalidStatusTransitionError extends Error {
  constructor(from: AccountStatus, to: AccountStatus) {
    super(`Invalid account status transition: ${from} → ${to}`);
    this.name = 'InvalidStatusTransitionError';
  }
}
