# Build F plan — VA checklist runner

## Context

Per `/docs/operational-model.md` "The VA checklist runner". This is
"the build that deserves the most craft" — where hours get spent
daily. Fullscreen, card-by-card, keyboard-driven. v1 covers the POST
flow only; replies, reposts, warmups, and comment-triage are deferred.

The pipeline now ends here:
```
Build D draft → Build E approve → Build F VA executes → Post POSTED
```

## Schema impact

**None.** `TaskBatch`, `Task`, `TaskAction`, `TaskStatus`,
`TaskBatchKind`, `TaskBatchStatus` all shipped in Phase 0.

## Architectural decisions

### Just-in-time task materialisation
Tasks are not pre-created. A `SCHEDULED` Post sits as just a Post until
a VA clicks "Pick up batch" on `/va`. At that moment the server:
1. Pulls SCHEDULED Posts whose `scheduledFor <= now + lookahead`
2. Filters out posts already attached to a Task in any
   non-final state
3. Groups by `phoneDeviceId` (device affinity per spec); a single
   batch contains tasks for one device
4. Caps the batch size at 10
5. Creates one `TaskBatch` (kind=`POST_DROP`, assignedTo=this VA) +
   one `Task` per Post

The VA executes the batch; the next pick-up call repeats. This keeps
the schema simple (every Task always has a batch) and avoids the
"unbatched tasks pool" problem.

### Post ↔ Task lifecycle

| Operator action          | Post.status      | Task.status        |
|--------------------------|------------------|--------------------|
| Build D auto-approve     | SCHEDULED        | (no task yet)      |
| Build D needs review     | PENDING_APPROVAL | —                  |
| Build E approve          | SCHEDULED        | —                  |
| VA picks up batch        | SCHEDULED        | PENDING            |
| VA marks done            | **POSTED**       | COMPLETED          |
| VA marks escalate        | PENDING_APPROVAL | ESCALATED          |
| VA marks skip            | SCHEDULED        | SKIPPED            |

Escalation flips the Post back into the review queue with the VA's
reason recorded in `Post.generationMeta.escalation`. The operator can
re-approve, edit-and-approve, or reject. The original Task stays
ESCALATED for the audit trail; a fresh Task gets created if the Post
is re-approved and a VA picks it up again.

Skip leaves the Post on `SCHEDULED` so a future pick-up can re-batch
it. The original SKIPPED Task is the audit row.

### Operators can switch hats

Per spec: "When the operator needs to execute a task themselves
(e.g. a quarantine, a partner posting personally during a surge),
they switch hats and become a VA — same UI, same queue." Update
`/va/layout.tsx` to admit FOUNDER and PARTNER too.

## Component inventory

### New (backend / loaders)
- `apps/ops/src/lib/va-queue.ts` — pure logic for batch composition
  (filter / group / cap). Unit-tested.
- `apps/ops/src/app/va/actions.ts` — server actions:
  - `pickUpBatch()` → creates TaskBatch + Tasks transactionally,
    returns the new batchId, redirects to the runner
  - `markTaskDone(taskId)` → Task=COMPLETED + Post=POSTED + `postedAt`
  - `escalateTask(taskId, reason)` → Task=ESCALATED;
    Post=PENDING_APPROVAL with `generationMeta.escalation` set so the
    review queue surfaces it with context
  - `skipTask(taskId)` → Task=SKIPPED; Post stays SCHEDULED
- `apps/ops/src/app/va/_loaders/`
  - `current-batch.ts` — `getOpenBatchForUser(userId)` for resume
  - `batch-detail.ts` — `getBatchWithTasks(batchId, userId)` for
    the fullscreen runner

### New (UI)
- `apps/ops/src/app/va/page.tsx` — landing. Replaces today's
  StatCard placeholder. If an in-progress batch exists for this VA,
  shows a "Resume batch (N tasks)" link; otherwise a "Pick up batch"
  button or an empty state when nothing is queued.
- `apps/ops/src/app/va/batch/[id]/page.tsx` — server component.
  Loads the batch + tasks and hands off to `<TaskRunner>`. Wraps the
  runner in a `fixed inset-0` overlay that visually replaces the
  topbar layout — same DOM, fullscreen feel.
- `apps/ops/src/app/va/_components/task-runner.tsx` — client
  component. Holds the active-task index state, keyboard listener,
  three action buttons. Calls server actions then advances or
  refreshes.
- `apps/ops/src/app/va/_components/escalate-form.tsx` — client
  expander on the runner; reason textarea + confirm.

### Updated
- `apps/ops/src/app/va/layout.tsx` — allow FOUNDER and PARTNER (hat
  switching per spec).
- `apps/ops/src/app/console/_loaders/roster.ts` — escalated-tasks
  signal flips from STUB to live: count of ESCALATED tasks (latest
  generation only — i.e. tasks tied to Posts whose status is still
  PENDING_APPROVAL because of the escalation) per model. Same NEUTRAL-
  count-when->0 / STUB-when-0 pattern as review-queue.
- `apps/ops/src/app/console/_components/roster-row.tsx` — render
  the new Escalated chip with a count + tooltip.

### Not changed
- Existing `/va/escalations` and `/va/stats` placeholder pages stay
  as-is. They become real in later phases — out of scope for F.
- No nav-sidebar / topbar reshaping.

## Keyboard contract

Active when `<TaskRunner>` is mounted (not in a textarea / input):

| Key            | Action                       |
|----------------|------------------------------|
| `D` / `Enter`  | Mark current task done       |
| `E`            | Open escalate form           |
| `S`            | Skip current task            |
| `J` / `→`      | Next (peek without resolving)|
| `K` / `←`      | Previous (peek)              |
| `Esc`          | Exit runner → /va            |

Mouse / touch parity: every keyboard action has a button. Keys are
the fast path, not the only path.

## Pure-logic module: `va-queue.ts`

```ts
type Pickable = {
  postId: string;
  accountId: string;
  phoneDeviceId: string | null;
  scheduledFor: Date;
};

// Returns the chosen subset for one batch + the chosen device id.
function composeBatch(
  pickable: Pickable[],
  opts: { now: Date; cap?: number },
): { deviceId: string | null; tasks: Pickable[] };
```
Behaviour:
- If empty input → empty batch.
- Group by `phoneDeviceId`; pick the group with the most ready
  tasks (ties broken by the earliest `scheduledFor`).
- Sort that group by `scheduledFor` asc; take up to `cap` (default 10).

Unit-tested: empty input, all-same-device, multi-device tie-break,
null-device handling, cap respected, mixed-due-times.

## Anti-goals — explicitly NOT in F

- **No platform integration.** The VA does the post manually on a
  phone. We track `Task.completedAt` + flip `Post → POSTED`.
- **No reply / repost / warmup / comment-triage tasks.** v1 is POST
  only. The other `TaskAction` enum values stay unused for now.
- **No multi-batch parallel work.** A VA has one open batch at a time;
  the resume-batch view enforces this.
- **No undo.** Done is final; the audit row remains.
- **No QualitySample sampling/review flow.** Separate phase.
- **No evidence upload** (screenshots, links to the live post).
  Future build will probably add `Task.payload.evidence` after the
  done action.
- **No `/va/escalations` and `/va/stats` real content.** Placeholders
  stay.
- **No nav-sidebar reshape.** That's the cross-cutting `nav-shrink`
  follow-up flagged in `/docs/reality-delta.md`.

## Verification

Tests:
- `apps/ops/src/lib/va-queue.test.ts` — pure-function batch composition.
- `apps/ops/src/app/va/actions.test.ts` — branch logic of every
  server action with prisma mocked.

Manual smoke:
1. Approve a Post in `/console/review` → SCHEDULED.
2. Sign in as a seeded VA user.
3. `/va` shows the Pick-up CTA. Click → redirected to
   `/va/batch/<id>`. Runner shows 1 task.
4. Press `D` → task done; Post→POSTED. Roster Runway recomputes.
5. Approve another, escalate from the runner with a reason. Post
   shows in `/console/review` again with the escalation note.
6. Roster "Escalated" pill goes YELLOW with count = 1; click pill
   goes nowhere yet (no `/console/escalations` page) — that's a
   later build's concern.

## Commits

Three chunks:
1. Backend — `va-queue.ts` + tests, server actions + tests, loaders.
2. Runner UI — `/va/page.tsx`, `/va/batch/[id]/page.tsx`,
   `<TaskRunner>`, `<EscalateForm>`, layout role gate.
3. Roster escalated-signal unstubbing + changelog entry.
