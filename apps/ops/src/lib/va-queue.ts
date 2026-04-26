/**
 * Pure logic for VA pick-up batch composition. The actions module
 * loads the candidate set and finalises with this function — kept
 * separate so the heuristics are testable without a DB and tunable
 * without churning the action's transaction code.
 *
 * Per `/docs/operational-model.md`: "Tasks arrive in batches grouped
 * by action type and device affinity." v1 is POST-only so action
 * grouping is trivial; we group by phoneDeviceId.
 */

export type Pickable = {
  postId: string;
  accountId: string;
  phoneDeviceId: string | null;
  scheduledFor: Date;
};

export type ComposedBatch = {
  deviceId: string | null;
  tasks: Pickable[];
};

/**
 * Pick the next batch from the candidate set.
 *
 * Strategy:
 *   - Group by `phoneDeviceId`.
 *   - Pick the group with the most candidates (ties broken by
 *     earliest `scheduledFor`).
 *   - Sort that group by `scheduledFor` asc; cap at `opts.cap`
 *     (default 10).
 *
 * Returns `{ deviceId: null, tasks: [] }` when there's nothing to
 * batch. The action layer treats that as "no work to pick up".
 */
export function composeBatch(
  pickable: Pickable[],
  opts: { cap?: number } = {},
): ComposedBatch {
  const cap = opts.cap ?? 10;
  if (pickable.length === 0) return { deviceId: null, tasks: [] };

  // Group keyed by deviceId-or-empty. We keep null as its own bucket
  // (an account with no bound phone device still needs to be worked).
  const groups = new Map<string | null, Pickable[]>();
  for (const p of pickable) {
    const key = p.phoneDeviceId;
    const list = groups.get(key) ?? [];
    list.push(p);
    groups.set(key, list);
  }

  // Pick the heaviest group; tie-break on earliest scheduledFor in the
  // group so a group of 5 ready-now beats a group of 5 due-tomorrow
  // when both have count 5.
  let chosen: { key: string | null; tasks: Pickable[]; earliest: number } | null = null;
  for (const [key, tasks] of groups) {
    const earliest = Math.min(...tasks.map((t) => t.scheduledFor.getTime()));
    if (
      !chosen ||
      tasks.length > chosen.tasks.length ||
      (tasks.length === chosen.tasks.length && earliest < chosen.earliest)
    ) {
      chosen = { key, tasks, earliest };
    }
  }

  if (!chosen) return { deviceId: null, tasks: [] };

  const sorted = [...chosen.tasks].sort(
    (a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime(),
  );
  return {
    deviceId: chosen.key,
    tasks: sorted.slice(0, cap),
  };
}
