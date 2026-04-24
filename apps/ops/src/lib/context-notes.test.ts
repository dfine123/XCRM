import { describe, it, expect } from 'vitest';
import { Archetype } from '@xcrm/db';
import {
  ScopeSchema,
  durationToEffectiveUntil,
  noteAppliesTo,
  parseScope,
  formatScope,
  formatRemainingTime,
  type Scope,
} from './context-notes';

const ALL: Scope = { kind: 'ALL' };
const ARCH_A: Scope = {
  kind: 'ARCHETYPES',
  archetypes: [Archetype.BLONDE_THIRST],
};
const ARCH_MULTI: Scope = {
  kind: 'ARCHETYPES',
  archetypes: [Archetype.BLONDE_THIRST, Archetype.GYM_GIRL],
};
const ACC_ONE: Scope = { kind: 'ACCOUNTS', accountIds: ['acct-1'] };

describe('ScopeSchema', () => {
  it('parses every discriminator shape', () => {
    expect(ScopeSchema.safeParse(ALL).success).toBe(true);
    expect(ScopeSchema.safeParse(ARCH_A).success).toBe(true);
    expect(ScopeSchema.safeParse(ACC_ONE).success).toBe(true);
  });
  it('rejects empty arrays', () => {
    expect(
      ScopeSchema.safeParse({ kind: 'ARCHETYPES', archetypes: [] }).success,
    ).toBe(false);
    expect(
      ScopeSchema.safeParse({ kind: 'ACCOUNTS', accountIds: [] }).success,
    ).toBe(false);
  });
  it('rejects unknown kind', () => {
    expect(ScopeSchema.safeParse({ kind: 'FOO' }).success).toBe(false);
  });
});

describe('noteAppliesTo', () => {
  const model = (archetype: Archetype, accountIds: string[] = []) => ({
    archetype,
    accountIds,
  });

  it('ALL always matches', () => {
    expect(noteAppliesTo(ALL, model(Archetype.BLONDE_THIRST))).toBe(true);
    expect(noteAppliesTo(ALL, model(Archetype.GYM_GIRL, ['x']))).toBe(true);
  });

  it('ARCHETYPES matches only on membership', () => {
    expect(noteAppliesTo(ARCH_A, model(Archetype.BLONDE_THIRST))).toBe(true);
    expect(noteAppliesTo(ARCH_A, model(Archetype.GYM_GIRL))).toBe(false);
    expect(noteAppliesTo(ARCH_MULTI, model(Archetype.GYM_GIRL))).toBe(true);
  });

  it('ACCOUNTS matches on any overlap', () => {
    expect(
      noteAppliesTo(ACC_ONE, model(Archetype.BLONDE_THIRST, ['acct-1'])),
    ).toBe(true);
    expect(
      noteAppliesTo(ACC_ONE, model(Archetype.BLONDE_THIRST, ['acct-2', 'acct-1'])),
    ).toBe(true);
    expect(
      noteAppliesTo(ACC_ONE, model(Archetype.BLONDE_THIRST, ['acct-2'])),
    ).toBe(false);
    expect(noteAppliesTo(ACC_ONE, model(Archetype.BLONDE_THIRST, []))).toBe(false);
  });
});

describe('durationToEffectiveUntil', () => {
  const now = new Date('2026-04-22T14:30:00Z');

  it('TODAY returns end of current day', () => {
    const d = durationToEffectiveUntil('TODAY', now);
    expect(d).not.toBeNull();
    expect(d!.getDate()).toBe(now.getDate());
    expect(d!.getHours()).toBe(23);
    expect(d!.getMinutes()).toBe(59);
  });

  it('THREE_DAYS is 72h later', () => {
    const d = durationToEffectiveUntil('THREE_DAYS', now);
    expect(d!.getTime() - now.getTime()).toBe(3 * 24 * 60 * 60 * 1000);
  });

  it('ONE_WEEK is 168h later', () => {
    const d = durationToEffectiveUntil('ONE_WEEK', now);
    expect(d!.getTime() - now.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('UNTIL_REMOVED is null', () => {
    expect(durationToEffectiveUntil('UNTIL_REMOVED', now)).toBeNull();
  });
});

describe('parseScope', () => {
  it('returns valid shapes unchanged', () => {
    expect(parseScope(ALL)).toEqual(ALL);
    expect(parseScope(ARCH_MULTI)).toEqual(ARCH_MULTI);
  });
  it('falls back to ALL on garbage', () => {
    expect(parseScope(null)).toEqual(ALL);
    expect(parseScope({ totally: 'wrong' })).toEqual(ALL);
    expect(parseScope({ kind: 'ARCHETYPES' })).toEqual(ALL); // missing archetypes
  });
});

describe('formatScope', () => {
  it('renders each case', () => {
    expect(formatScope(ALL)).toBe('all models');
    expect(formatScope(ARCH_A)).toMatch(/archetype/);
    expect(formatScope(ARCH_MULTI)).toBe('2 archetypes');
    expect(formatScope(ACC_ONE)).toBe('1 account');
    expect(
      formatScope({ kind: 'ACCOUNTS', accountIds: ['a', 'b', 'c'] }),
    ).toBe('3 accounts');
  });
});

describe('formatRemainingTime', () => {
  const now = new Date('2026-04-22T14:30:00Z');

  it('null → until removed', () => {
    expect(formatRemainingTime(null, now)).toBe('until removed');
  });
  it('past → expired', () => {
    expect(
      formatRemainingTime(new Date(now.getTime() - 1000), now),
    ).toBe('expired');
  });
  it('days + hours', () => {
    expect(
      formatRemainingTime(new Date(now.getTime() + (2 * 24 + 3) * 3_600_000), now),
    ).toBe('expires in 2d 3h');
  });
  it('hours + mins', () => {
    expect(
      formatRemainingTime(new Date(now.getTime() + 2 * 3_600_000 + 15 * 60_000), now),
    ).toBe('expires in 2h 15m');
  });
  it('mins only', () => {
    expect(
      formatRemainingTime(new Date(now.getTime() + 8 * 60_000), now),
    ).toBe('expires in 8m');
  });
  it('sub-minute', () => {
    expect(
      formatRemainingTime(new Date(now.getTime() + 30_000), now),
    ).toBe('expires in <1m');
  });
});
