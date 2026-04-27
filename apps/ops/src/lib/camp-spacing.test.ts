import { describe, it, expect } from 'vitest';
import {
  assetsBlockedByCampMates,
  CAMP_ASSET_SPACING_HOURS,
  type CampMatePostRow,
} from './camp-spacing';

const NOW = new Date('2026-04-23T12:00:00Z');

function row(over: Partial<CampMatePostRow> & { id: string }): CampMatePostRow {
  return {
    assetId: over.id,
    scheduledFor: over.scheduledFor ?? null,
    postedAt: over.postedAt ?? null,
  };
}

const hours = (h: number) =>
  new Date(NOW.getTime() + h * 60 * 60 * 1000);

describe('assetsBlockedByCampMates', () => {
  it('empty input → empty set', () => {
    expect(assetsBlockedByCampMates([], NOW).size).toBe(0);
  });

  it('blocks assets with scheduledFor inside the window', () => {
    const rows = [
      row({ id: 'in-soon', scheduledFor: hours(2) }),
      row({ id: 'in-recent-past', scheduledFor: hours(-12) }),
      row({ id: 'far-future', scheduledFor: hours(96) }),
    ];
    const out = assetsBlockedByCampMates(rows, NOW);
    expect(out.has('in-soon')).toBe(true);
    expect(out.has('in-recent-past')).toBe(true);
    expect(out.has('far-future')).toBe(false);
  });

  it('uses postedAt when scheduledFor is null', () => {
    const rows = [row({ id: 'posted-2h-ago', postedAt: hours(-2) })];
    const out = assetsBlockedByCampMates(rows, NOW);
    expect(out.has('posted-2h-ago')).toBe(true);
  });

  it('postedAt takes precedence over scheduledFor when both present', () => {
    const rows = [
      row({
        id: 'mixed',
        scheduledFor: hours(96), // outside
        postedAt: hours(-1), // inside
      }),
    ];
    const out = assetsBlockedByCampMates(rows, NOW);
    expect(out.has('mixed')).toBe(true);
  });

  it('skips rows where both timestamps are null', () => {
    const rows = [row({ id: 'no-ts' })];
    expect(assetsBlockedByCampMates(rows, NOW).size).toBe(0);
  });

  it('boundary: exactly at the window edge counts as blocked', () => {
    const rows = [
      row({ id: 'boundary', scheduledFor: hours(CAMP_ASSET_SPACING_HOURS) }),
    ];
    expect(assetsBlockedByCampMates(rows, NOW).has('boundary')).toBe(true);
  });

  it('respects a custom spacingHours override', () => {
    const rows = [row({ id: 'in-24h', scheduledFor: hours(24) })];
    expect(assetsBlockedByCampMates(rows, NOW, 12).has('in-24h')).toBe(false);
    expect(assetsBlockedByCampMates(rows, NOW, 48).has('in-24h')).toBe(true);
  });

  it('dedupes when the same assetId appears in multiple rows', () => {
    const rows = [
      row({ id: 'dup', scheduledFor: hours(2) }),
      row({ id: 'dup', postedAt: hours(-2) }),
    ];
    const out = assetsBlockedByCampMates(rows, NOW);
    expect(out.size).toBe(1);
    expect(out.has('dup')).toBe(true);
  });

  it('CAMP_ASSET_SPACING_HOURS constant pinned at 72', () => {
    expect(CAMP_ASSET_SPACING_HOURS).toBe(72);
  });
});
