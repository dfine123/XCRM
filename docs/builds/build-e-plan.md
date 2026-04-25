# Build E plan — Review queue UI

## Context

Per `/docs/operational-model.md` "The review queue". Build D writes
`PENDING_APPROVAL` Posts; Build E gives the operator a surface to
approve / edit / reject them. Spec frames it explicitly as **not a
daily destination**: surfaces via the Roster signal light when
something is there, ignored otherwise.

Per the doc, per item:
- Model, account, scheduled time
- Generated copy + suggested asset
- Confidence score + reasoning
- Buttons: **Approve** · **Edit & Approve** · **Reject**

Approve flips status to `SCHEDULED` (the VA task queue is Build F —
"shipping to the VA queue" lands then; for E an approved post is just
"scheduled, waiting for execution"). Reject sets `CANCELLED` and
records the reason; the negative-signal feedback loop for the generator
itself is Build G.

## Schema impact

**None.** `PostStatus` includes `APPROVED`, `SCHEDULED`, `CANCELLED`.
`Post.generationMeta` is Json — we merge approval/edit/reject metadata
into it. No new tables, no migrations.

## Routes

- `/console/review` — cross-model queue page (new, server component).
- Server actions in `apps/ops/src/app/console/review/actions.ts`:
  - `approvePost(formData)` — flips PENDING_APPROVAL → SCHEDULED,
    records `{ approvedAt, approvedByUserId }` in `generationMeta`.
  - `rejectPost(formData)` — flips PENDING_APPROVAL → CANCELLED,
    records `{ rejectedAt, rejectedByUserId, rejectionReason }`.
    Negative signal is just persisted metadata for now; Build G reads it.
  - `editAndApprovePost(formData)` — updates `copy` + `assetIds[0]`,
    then approves. Records the edit in `generationMeta` as
    `{ editedAt, editedByUserId, originalCopy, originalAssetId }` so
    Build G can see operator-overrides.

No HTTP API routes — all flows are server actions tied to forms. Same
pattern we've used everywhere else in `/console`.

## Component inventory

### New (backend / loaders)
- `apps/ops/src/app/console/review/actions.ts` — three server
  actions above.
- `apps/ops/src/app/console/_loaders/review-queue.ts` —
  `getReviewQueue()` returns the list of pending posts with model +
  account + author info needed to render. Sort: oldest first
  (FIFO triage).
- `apps/ops/src/app/console/_loaders/asset-alternatives.ts` —
  `getAssetAlternativesForAccount(accountId, count = 6)`. Reuses the
  Build D candidate-asset predicate (top novelty, exclude already-
  committed) for the Edit-form asset-swap UX. Tight cap so the form
  stays compact.

### New (UI)
- `apps/ops/src/app/console/review/page.tsx` — list page. Header
  with count + filter status. Empty state when nothing pending.
- `apps/ops/src/app/console/review/_components/review-item.tsx` —
  one card per Post. Renders preview + thumbnails + confidence chip +
  reasoning + three action buttons. Server component.
- `apps/ops/src/app/console/review/_components/edit-form.tsx` —
  client component. Inline expander on the review-item. Shows current
  copy as a textarea, current asset + N alternatives as click-to-swap
  thumbnails, Submit + Cancel buttons.
- `apps/ops/src/app/console/review/_components/reject-form.tsx` —
  client component. Confirm dialog with optional reason textarea.

### Updated
- `apps/ops/src/app/console/page.tsx` (Roster) — when
  `pendingApprovalCount > 0` across the whole roster, the
  `<ActiveNotesStrip>`-style header band gets a "Review queue: N
  pending →" link to `/console/review`.
- `apps/ops/src/app/console/_components/roster-row.tsx` — review-queue
  pill becomes wrapped in markup that, instead of being inside the
  row's `<a>`, sits beside it (avoid nested anchors). Concretely: the
  row's main `<Link>` no longer wraps the whole flex container —
  instead the header info is the link; the pills are siblings.
- `apps/ops/src/app/console/models/[id]/page.tsx` — `#scheduled`
  block's PENDING_APPROVAL items get a small inline "Review →"
  link to `/console/review#post-<id>` (anchor scrolls to the item)
  so the operator can drill from a model into the queue. No
  duplicating the action buttons there — review queue is the home
  for the verbs.
- `apps/ops/src/lib/signal-lights.ts` — no logic change; review-
  queue thresholds stay as is.

### Not changed
- Build D orchestrator, Build C overlay, Build B roster shape.
- `Post` schema, `PostStatus` enum.

## Edit & Approve UX detail

The doc says "Edit lets the operator tune copy or swap asset". For v1:

- **Copy** — textarea, 280-char counter.
- **Asset swap** — current asset thumbnail + up to 6 alternatives
  (top by novelty from the candidate pool for this account, excluding
  the current pick). Click to swap. If the operator wants something
  outside this set, they can browse `/console/content?modelId=…` and
  paste the asset ID into a manual-ID input. The manual-ID input is
  intentionally low-friction-but-explicit — keeps the common path
  (pick from alternatives) clean.

**Schedule-time editing is NOT in v1.** Operators can reject + wait
for the next cron, or accept the slot the deterministic scheduler
picked. Editing the time bleeds into Build G's territory (peak-hour
learning) — defer.

## Reject UX detail

- Click "Reject" → small inline confirm with optional reason textarea
  (≤500 chars).
- Submit → status flips to `CANCELLED`, `generationMeta.rejection`
  gets `{ rejectedAt, rejectedByUserId, reason }`.
- The rejected Post stays queryable in the model detail audit feed
  (already part of the audit-block roll-up). No separate "rejected
  posts" page in this build.

## Roster header band

When the loader's roster-wide pending-approval total > 0:
```
[3 notes active] [Review queue: 5 pending →]    [Onboard model]
```
The Review-queue link is a plain `<Link>` to `/console/review`. When
total is 0, the link is hidden — keeps the header quiet on healthy
days.

## Auth / role

Same gate as the rest of `/console` — FOUNDER and PARTNER. No new
roles. `requireUser()` at the top of every server action.

## Tests

- `apps/ops/src/app/console/review/actions.test.ts` — server-action
  branch logic with prisma mocked (mirrors the
  `accounts/actions.test.ts` shape from Build B):
  - `approvePost` happy path: PENDING_APPROVAL → SCHEDULED,
    generationMeta merged.
  - `approvePost` no-op: post already SCHEDULED (idempotent guard).
  - `rejectPost` happy path: → CANCELLED, reason persisted.
  - `editAndApprovePost`: copy + assetIds updated, status SCHEDULED,
    `generationMeta.edit` records the original values.
  - `editAndApprovePost` rejects copy > 280 / empty / missing assetId.

No integration / E2E — same bar as prior builds.

## Anti-goals — explicitly NOT in E

- **No bulk approve/reject.** One item at a time.
- **No schedule-time editing.** Defer to G.
- **No filter / search on the queue.** Single FIFO list. Filtering
  becomes a problem when N > 50 — we'll add it then.
- **No "rejected posts" recovery flow.** CANCELLED is final.
- **No VA task creation.** That's F. Approve == status flip only.
- **No engagement-feedback training.** G consumes the
  `generationMeta.rejection` rows we record here.
- **No undo.** Browser refresh is the undo.
- **No inline content-library picker.** Top-N alternatives + manual
  ID input is enough for v1.

## Verification

Manual smoke after deploy:
1. Have at least one PENDING_APPROVAL post (use the `Generate draft`
   button on a `FRESH_BUILD` account — those always need review).
2. Visit `/console/review` → the post appears.
3. Approve → row disappears, status = SCHEDULED, model detail
   `#scheduled` shows it under SCHEDULED.
4. Generate another draft. Click Edit → change copy, swap asset →
   submit. Row disappears; new copy + asset on the SCHEDULED row.
5. Generate another. Reject with reason. Row disappears; model detail
   `#audit` shows the rejection event (it'll surface there once the
   audit roll-up includes Post status changes — we may need a tiny
   addition to the audit block in this commit).
6. Roster shows the review-queue pill as a count when posts are
   pending and a link to the queue page in the header band.

## Commit plan

Two chunks:
1. **Backend** — actions, loaders, server-side logic + tests.
2. **UI** — page, components, roster header link, model-detail
   "Review →" link, audit-block update.

Changelog entry at the end of chunk 2.
