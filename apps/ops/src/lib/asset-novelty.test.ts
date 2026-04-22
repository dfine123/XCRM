import { describe, it, expect } from 'vitest';
import { computeNoveltyScore } from './asset-novelty';

describe('computeNoveltyScore', () => {
  it('returns 1 for never-used assets', () => {
    expect(computeNoveltyScore({ useCount: 0, lastUsedAt: null })).toBe(1);
  });

  it('decays with useCount', () => {
    const old = new Date(Date.now() - 30 * 86_400_000); // 30 days ago
    expect(computeNoveltyScore({ useCount: 0, lastUsedAt: null })).toBe(1);
    expect(computeNoveltyScore({ useCount: 1, lastUsedAt: old })).toBe(0.5);
    expect(computeNoveltyScore({ useCount: 3, lastUsedAt: old })).toBeCloseTo(0.25);
  });

  it('decays with recency regardless of count', () => {
    const justNow = new Date();
    const s = computeNoveltyScore({ useCount: 1, lastUsedAt: justNow });
    expect(s).toBeLessThan(0.1); // half-life basically 0 within minutes
  });

  it('clamps between 0 and 1', () => {
    const s = computeNoveltyScore({ useCount: 1000, lastUsedAt: new Date() });
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(1);
  });

  it('recovers to full weight after 14 days', () => {
    const old = new Date(Date.now() - 14 * 86_400_000);
    // useCount=1 + full recency weight → 0.5
    expect(computeNoveltyScore({ useCount: 1, lastUsedAt: old })).toBe(0.5);
  });
});
