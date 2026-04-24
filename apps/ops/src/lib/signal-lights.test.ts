import { describe, it, expect } from 'vitest';
import {
  contentRunwayState,
  escalatedTasksState,
  failedSyncsState,
  quarantinedAccountsState,
  incompleteOnboardingState,
  reviewQueueState,
  rowSeverity,
  compareRosterRows,
  severityOf,
  type SignalLightState,
} from './signal-lights';

describe('content runway', () => {
  it('returns STUB when data source not yet shipped', () => {
    expect(contentRunwayState(null)).toBe('STUB');
  });
  it('boundary: <3 days red', () => {
    expect(contentRunwayState(0)).toBe('RED');
    expect(contentRunwayState(2.99)).toBe('RED');
  });
  it('boundary: 3..7 days yellow', () => {
    expect(contentRunwayState(3)).toBe('YELLOW');
    expect(contentRunwayState(5)).toBe('YELLOW');
    expect(contentRunwayState(7)).toBe('YELLOW');
  });
  it('boundary: >7 days green', () => {
    expect(contentRunwayState(7.01)).toBe('GREEN');
    expect(contentRunwayState(14)).toBe('GREEN');
  });
});

describe('escalated tasks', () => {
  it('STUB when null', () => {
    expect(escalatedTasksState(null)).toBe('STUB');
  });
  it('0 → GREEN, 1..2 → YELLOW, 3+ → RED', () => {
    expect(escalatedTasksState(0)).toBe('GREEN');
    expect(escalatedTasksState(1)).toBe('YELLOW');
    expect(escalatedTasksState(2)).toBe('YELLOW');
    expect(escalatedTasksState(3)).toBe('RED');
    expect(escalatedTasksState(17)).toBe('RED');
  });
});

describe('failed syncs', () => {
  it('0 in 24h → GREEN', () => {
    expect(
      failedSyncsState({ failedInLast24h: 0, consecutiveFailuresMostRecent: 0 }),
    ).toBe('GREEN');
  });
  it('1..2 in 24h → YELLOW (regardless of consecutive below 3)', () => {
    expect(
      failedSyncsState({ failedInLast24h: 1, consecutiveFailuresMostRecent: 1 }),
    ).toBe('YELLOW');
    expect(
      failedSyncsState({ failedInLast24h: 2, consecutiveFailuresMostRecent: 2 }),
    ).toBe('YELLOW');
  });
  it('3+ consecutive → RED even if last-24h count is small', () => {
    // Consecutive failures win: the chain of 3 is over days, the 24h
    // count could be 1 if the others were >24h ago.
    expect(
      failedSyncsState({ failedInLast24h: 1, consecutiveFailuresMostRecent: 3 }),
    ).toBe('RED');
    expect(
      failedSyncsState({ failedInLast24h: 5, consecutiveFailuresMostRecent: 5 }),
    ).toBe('RED');
  });
});

describe('quarantined accounts', () => {
  it('0 → GREEN', () => {
    expect(quarantinedAccountsState(0)).toBe('GREEN');
  });
  it('any → RED', () => {
    expect(quarantinedAccountsState(1)).toBe('RED');
    expect(quarantinedAccountsState(9)).toBe('RED');
  });
});

describe('incomplete onboarding', () => {
  it('null → YELLOW pill', () => {
    expect(incompleteOnboardingState(null)).toBe('YELLOW');
  });
  it('not-null → no pill (null return = hidden)', () => {
    expect(incompleteOnboardingState(new Date('2026-04-22'))).toBeNull();
  });
});

describe('review queue depth', () => {
  it('null → STUB (pre-Build E)', () => {
    expect(reviewQueueState(null)).toBe('STUB');
  });
  it('non-null → NEUTRAL (count-only, no color)', () => {
    expect(reviewQueueState(0)).toBe('NEUTRAL');
    expect(reviewQueueState(12)).toBe('NEUTRAL');
  });
});

describe('row severity (worst-wins)', () => {
  it('empty states → 0', () => {
    expect(rowSeverity([])).toBe(0);
  });
  it('all-stub/neutral → 0 (no color group)', () => {
    expect(rowSeverity(['STUB', 'NEUTRAL', 'STUB'])).toBe(0);
  });
  it('all-green → 1', () => {
    expect(rowSeverity(['GREEN', 'GREEN'])).toBe(1);
  });
  it('yellow beats green', () => {
    expect(rowSeverity(['GREEN', 'YELLOW', 'GREEN'])).toBe(2);
  });
  it('red beats yellow + green — the red+yellow bug', () => {
    // This is the explicit clarification case: a row with both red and
    // yellow lands in the red group, not the yellow group.
    expect(rowSeverity(['RED', 'YELLOW', 'GREEN', 'STUB'])).toBe(3);
  });
  it('red + all-stub → 3', () => {
    expect(rowSeverity(['RED', 'STUB', 'STUB'])).toBe(3);
  });
});

describe('compareRosterRows — group then alphabetical', () => {
  const make = (displayName: string, states: SignalLightState[]) => ({
    displayName,
    severity: rowSeverity(states),
  });

  it('sorts red group first, alphabetical within', () => {
    const input = [
      make('Zara', ['RED']),
      make('Alex', ['RED', 'YELLOW']),
      make('Mae', ['RED']),
    ];
    const sorted = [...input].sort(compareRosterRows);
    expect(sorted.map((r) => r.displayName)).toEqual(['Alex', 'Mae', 'Zara']);
  });

  it('full spread: red → yellow → green, alphabetical within each', () => {
    const input = [
      make('Gamma', ['GREEN']),
      make('Beta', ['YELLOW']),
      make('Alpha', ['RED']),
      make('Delta', ['GREEN']),
      make('Echo', ['YELLOW']),
      make('Fox', ['RED', 'YELLOW']), // mixed red+yellow → red group
    ];
    const sorted = [...input].sort(compareRosterRows);
    expect(sorted.map((r) => r.displayName)).toEqual([
      'Alpha',
      'Fox',
      'Beta',
      'Echo',
      'Delta',
      'Gamma',
    ]);
  });

  it('all-stub rows sort alphabetically within the no-severity bucket', () => {
    const input = [
      make('Charlie', ['STUB', 'STUB']),
      make('Bravo', ['STUB', 'STUB']),
      make('Alpha', ['STUB', 'STUB']),
    ];
    const sorted = [...input].sort(compareRosterRows);
    expect(sorted.map((r) => r.displayName)).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });
});

describe('severityOf', () => {
  it('handles every state', () => {
    expect(severityOf('RED')).toBe(3);
    expect(severityOf('YELLOW')).toBe(2);
    expect(severityOf('GREEN')).toBe(1);
    expect(severityOf('NEUTRAL')).toBe(0);
    expect(severityOf('STUB')).toBe(0);
  });
});
