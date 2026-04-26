import { describe, it, expect } from 'vitest';
import { composeBatch, type Pickable } from './va-queue';

function p(overrides: Partial<Pickable> & { id: string; device?: string | null; sched?: string }): Pickable {
  return {
    postId: `post-${overrides.id}`,
    accountId: `acct-${overrides.id}`,
    phoneDeviceId: overrides.device === undefined ? 'd-1' : overrides.device,
    scheduledFor: new Date(overrides.sched ?? '2026-04-23T12:00:00Z'),
  };
}

describe('composeBatch', () => {
  it('empty input → empty batch', () => {
    expect(composeBatch([])).toEqual({ deviceId: null, tasks: [] });
  });

  it('single device → all tasks (up to cap)', () => {
    const tasks = [p({ id: '1' }), p({ id: '2' }), p({ id: '3' })];
    const r = composeBatch(tasks);
    expect(r.deviceId).toBe('d-1');
    expect(r.tasks).toHaveLength(3);
  });

  it('respects cap', () => {
    const tasks = Array.from({ length: 25 }, (_, i) => p({ id: String(i) }));
    const r = composeBatch(tasks, { cap: 10 });
    expect(r.tasks).toHaveLength(10);
  });

  it('sorts the chosen group by earliest scheduledFor first', () => {
    const tasks = [
      p({ id: 'late', sched: '2026-04-23T20:00:00Z' }),
      p({ id: 'early', sched: '2026-04-23T08:00:00Z' }),
      p({ id: 'mid', sched: '2026-04-23T14:00:00Z' }),
    ];
    const r = composeBatch(tasks);
    expect(r.tasks.map((t) => t.postId)).toEqual([
      'post-early',
      'post-mid',
      'post-late',
    ]);
  });

  it('multi-device → picks the heavier group', () => {
    const tasks = [
      p({ id: 'a1', device: 'd-A' }),
      p({ id: 'a2', device: 'd-A' }),
      p({ id: 'a3', device: 'd-A' }),
      p({ id: 'b1', device: 'd-B' }),
      p({ id: 'b2', device: 'd-B' }),
    ];
    const r = composeBatch(tasks);
    expect(r.deviceId).toBe('d-A');
    expect(r.tasks).toHaveLength(3);
  });

  it('multi-device tie → breaks on earliest scheduledFor in the group', () => {
    const tasks = [
      p({ id: 'a1', device: 'd-A', sched: '2026-04-23T15:00:00Z' }),
      p({ id: 'a2', device: 'd-A', sched: '2026-04-23T16:00:00Z' }),
      p({ id: 'b1', device: 'd-B', sched: '2026-04-23T08:00:00Z' }),
      p({ id: 'b2', device: 'd-B', sched: '2026-04-23T09:00:00Z' }),
    ];
    const r = composeBatch(tasks);
    expect(r.deviceId).toBe('d-B');
    expect(r.tasks).toHaveLength(2);
  });

  it('null-device tasks are their own bucket', () => {
    const tasks = [
      p({ id: 'A1', device: null, sched: '2026-04-23T08:00:00Z' }),
      p({ id: 'A2', device: null, sched: '2026-04-23T09:00:00Z' }),
      p({ id: 'B1', device: 'd-B', sched: '2026-04-23T15:00:00Z' }),
    ];
    const r = composeBatch(tasks);
    // null group has more tasks (2 vs 1) → wins
    expect(r.deviceId).toBeNull();
    expect(r.tasks.map((t) => t.postId)).toEqual(['post-A1', 'post-A2']);
  });
});
