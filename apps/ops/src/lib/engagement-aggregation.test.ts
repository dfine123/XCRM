import { describe, it, expect } from 'vitest';
import {
  engagementScore,
  engagementRate,
  topFacetsByRate,
  derivePeakHours,
  summariseEngagement,
  DEFAULT_PEAK_HOURS,
  type EngagementSample,
} from './engagement-aggregation';

const ZERO = {
  likes: 0,
  reposts: 0,
  replies: 0,
  bookmarks: 0,
  impressions: 0,
  profileClicks: 0,
};

function s(over: Partial<EngagementSample> & { id?: string }): EngagementSample {
  return {
    postId: over.id ?? 'p',
    scheduledFor: null,
    postedAt: null,
    likes: 0,
    reposts: 0,
    replies: 0,
    bookmarks: 0,
    impressions: 0,
    profileClicks: 0,
    aesthetic: null,
    mood: null,
    lighting: null,
    ...over,
  };
}

describe('engagementScore', () => {
  it('zero metrics → 0', () => {
    expect(engagementScore(ZERO)).toBe(0);
  });
  it('weights reposts highest, then replies/bookmarks, then likes', () => {
    const repostHeavy = engagementScore({
      ...ZERO,
      reposts: 10,
      impressions: 100,
    });
    const likeHeavy = engagementScore({ ...ZERO, likes: 10, impressions: 100 });
    expect(repostHeavy).toBeGreaterThan(likeHeavy);
  });
  it('profileClicks only count when impressions > 0', () => {
    const noImps = engagementScore({ ...ZERO, profileClicks: 100 });
    const withImps = engagementScore({
      ...ZERO,
      profileClicks: 100,
      impressions: 1,
    });
    expect(noImps).toBe(0);
    expect(withImps).toBeGreaterThan(0);
  });
});

describe('engagementRate', () => {
  it('returns 0 when impressions is 0', () => {
    expect(engagementRate({ ...ZERO, likes: 100 })).toBe(0);
  });
  it('divides score by impressions', () => {
    const e = { ...ZERO, likes: 50, impressions: 1000 };
    expect(engagementRate(e)).toBeCloseTo(0.05);
  });
});

describe('topFacetsByRate', () => {
  it('groups by facet and ranks by avg rate desc', () => {
    const samples: EngagementSample[] = [
      s({ id: '1', aesthetic: 'clean-girl', likes: 100, impressions: 1000 }),
      s({ id: '2', aesthetic: 'clean-girl', likes: 80, impressions: 1000 }),
      s({ id: '3', aesthetic: 'cottagecore', likes: 30, impressions: 1000 }),
      s({ id: '4', aesthetic: 'cottagecore', likes: 30, impressions: 1000 }),
      s({ id: '5', aesthetic: 'streetwear', likes: 5, impressions: 1000 }),
      s({ id: '6', aesthetic: 'streetwear', likes: 5, impressions: 1000 }),
    ];
    const top = topFacetsByRate(samples, 'aesthetic', { topK: 3, minSamples: 2 });
    expect(top.map((f) => f.key)).toEqual(['clean-girl', 'cottagecore', 'streetwear']);
    expect(top[0]!.count).toBe(2);
  });

  it('skips facets below minSamples (avoids one-lucky-post bias)', () => {
    const samples: EngagementSample[] = [
      s({ id: '1', aesthetic: 'fluke', likes: 10000, impressions: 1000 }),
      s({ id: '2', aesthetic: 'sustained', likes: 50, impressions: 1000 }),
      s({ id: '3', aesthetic: 'sustained', likes: 60, impressions: 1000 }),
    ];
    const top = topFacetsByRate(samples, 'aesthetic', { minSamples: 2 });
    expect(top.map((f) => f.key)).toEqual(['sustained']);
  });

  it('ignores samples with null facet', () => {
    const samples: EngagementSample[] = [
      s({ id: '1', aesthetic: null, likes: 100, impressions: 100 }),
      s({ id: '2', aesthetic: 'x', likes: 100, impressions: 100 }),
      s({ id: '3', aesthetic: 'x', likes: 100, impressions: 100 }),
    ];
    const top = topFacetsByRate(samples, 'aesthetic', { minSamples: 2 });
    expect(top).toHaveLength(1);
    expect(top[0]!.count).toBe(2);
  });

  it('respects topK', () => {
    const samples: EngagementSample[] = Array.from({ length: 6 }, (_, i) =>
      s({
        id: `${i}`,
        aesthetic: `a${i}`,
        likes: i * 10,
        impressions: 100,
      }),
    );
    samples.push(...samples.map((x) => ({ ...x, id: `${x.postId}b` })));
    const top = topFacetsByRate(samples, 'aesthetic', { topK: 2, minSamples: 2 });
    expect(top).toHaveLength(2);
  });
});

describe('derivePeakHours', () => {
  it('returns defaults when no samples', () => {
    expect(derivePeakHours([])).toEqual(DEFAULT_PEAK_HOURS);
  });

  it('picks the top-k hours by weighted engagement', () => {
    const at = (h: number) => new Date(Date.UTC(2026, 3, 22, h, 0, 0));
    const samples: EngagementSample[] = [
      // hour 12 — heavy
      s({ id: '1', postedAt: at(12), likes: 100, impressions: 1000 }),
      s({ id: '2', postedAt: at(12), likes: 90, impressions: 1000 }),
      // hour 18 — moderate
      s({ id: '3', postedAt: at(18), likes: 50, impressions: 1000 }),
      // hour 6 — light
      s({ id: '4', postedAt: at(6), likes: 5, impressions: 1000 }),
    ];
    const peaks = derivePeakHours(samples, 4);
    expect(peaks[0]).toBe(6); // ascending output
    // Top hour by score should be 12; should be in the result set
    expect(peaks).toContain(12);
    expect(peaks).toContain(18);
    expect(peaks).toHaveLength(4);
    // Output is sorted ascending
    for (let i = 1; i < peaks.length; i++) {
      expect(peaks[i]).toBeGreaterThan(peaks[i - 1]!);
    }
  });

  it('falls back to defaults when fewer than k hours have signal', () => {
    const at = (h: number) => new Date(Date.UTC(2026, 3, 22, h, 0, 0));
    const samples: EngagementSample[] = [
      s({ id: '1', postedAt: at(15), likes: 100, impressions: 1000 }),
      s({ id: '2', postedAt: at(15), likes: 90, impressions: 1000 }),
    ];
    const peaks = derivePeakHours(samples, 4);
    expect(peaks).toContain(15);
    expect(peaks).toHaveLength(4);
    // Defaults should fill in
    const defaultsCount = peaks.filter((h) =>
      DEFAULT_PEAK_HOURS.includes(h),
    ).length;
    expect(defaultsCount).toBeGreaterThan(0);
  });

  it('uses scheduledFor when postedAt is null', () => {
    const at = (h: number) => new Date(Date.UTC(2026, 3, 22, h, 0, 0));
    const samples: EngagementSample[] = [
      s({
        id: '1',
        postedAt: null,
        scheduledFor: at(20),
        likes: 100,
        impressions: 1000,
      }),
    ];
    const peaks = derivePeakHours(samples, 4);
    expect(peaks).toContain(20);
  });

  it('skips samples with no timestamp', () => {
    const samples: EngagementSample[] = [
      s({ id: '1', likes: 100, impressions: 1000 }),
    ];
    const peaks = derivePeakHours(samples, 4);
    expect(peaks).toEqual(DEFAULT_PEAK_HOURS);
  });
});

describe('summariseEngagement', () => {
  it('returns the full summary shape', () => {
    const at = (h: number) => new Date(Date.UTC(2026, 3, 22, h, 0, 0));
    const samples: EngagementSample[] = [
      s({
        id: '1',
        postedAt: at(12),
        aesthetic: 'a1',
        mood: 'm1',
        lighting: 'l1',
        likes: 100,
        impressions: 1000,
      }),
      s({
        id: '2',
        postedAt: at(12),
        aesthetic: 'a1',
        mood: 'm1',
        lighting: 'l1',
        likes: 80,
        impressions: 1000,
      }),
    ];
    const sum = summariseEngagement(samples);
    expect(sum.sampleCount).toBe(2);
    expect(sum.peakHoursUtc).toContain(12);
    expect(sum.topAesthetics[0]?.key).toBe('a1');
    expect(sum.topMoods[0]?.key).toBe('m1');
    expect(sum.topLightings[0]?.key).toBe('l1');
  });
});
