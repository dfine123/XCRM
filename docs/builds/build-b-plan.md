# Build B plan — Roster + Model detail reshape

## Context

Build B brings Surfaces 2 and 3 from `/docs/operational-model.md` to life.

- **Surface 2 (Roster)** replaces the Phase-0 `StatCard` dashboard at
  `/console` with a signal-light view — one row per model, sorted by
  severity.
- **Surface 3 (Model detail)** keeps its URL (`/console/models/[id]`) but
  gets reshaped from "two-column hero + sidebar" into a single vertical
  scroll of six anchor-navigable blocks, with a sticky left-rail of
  anchor links. Density and scroll, not navigation.

Both rely on the signal-light thresholds defined in the doc. No schema
changes — signal data is derivable from rows that already exist or
safely stubbed where a dependent build (C/D/E/F) hasn't landed.

## Component inventory

### Reused as-is
- `PageHeader`, `Tag`, `Card`, `EmptyState`, `Button` from `@xcrm/ui`.
- `OPS_HUES` + the `hue()` helpers from `@xcrm/ui`.
- `relativeTime` at `apps/ops/src/lib/relative-time.ts`.
- `ContentSourcesCard` at
  `apps/ops/src/app/console/models/[id]/_components/content-sources-card.tsx`
  — gets embedded inside the new **Content** block.
- `RemoveModelCard` — gets embedded inside the new **Settings** block.
- `RemoveAccountButton` — stays inside the Overview block's account row.
- `ACCOUNT_STATUS_HUE` from `apps/ops/src/lib/status-hues.ts`.

### New files
Grouped for review:

Roster (`apps/ops/src/app/console/`)
- `_components/signal-light.tsx` — one pill (`{ color, label, count?, tooltip? }`).
- `_components/signal-lights-row.tsx` — horizontal cluster of up to six pills.
- `_components/roster-row.tsx` — one model row (server component).
- `_components/active-notes-strip.tsx` — header strip; stubbed to 0 count.
- `page.tsx` — replaces the Phase-0 dashboard with the roster list.
- `_loaders/roster.ts` — `getRosterModels()` (see Data queries below).

Signal-light logic (shared)
- `apps/ops/src/lib/signal-lights.ts` — pure functions that take raw
  counts and return `SignalLightState = 'GREEN' | 'YELLOW' | 'RED' | 'NEUTRAL' | 'STUB'`.
  `NEUTRAL` = count-only signals (review queue); `STUB` = data source
  not yet shipped (runway pre-D, escalated pre-F, review-queue pre-E).
- `apps/ops/src/lib/signal-lights.test.ts` — threshold boundary tests.

Model detail (`apps/ops/src/app/console/models/[id]/`)
- `_components/anchor-nav.tsx` — sticky left-rail with anchor links;
  highlights the section in view via `IntersectionObserver`. Client component.
- `_components/overview-block.tsx`
- `_components/content-block.tsx`
- `_components/scheduled-block.tsx` (stub)
- `_components/notes-block.tsx` (stub)
- `_components/settings-block.tsx`
- `_components/audit-block.tsx`
- `page.tsx` — refactored into a single loader + six `<section id>`s.

### Deleted
Nothing. Existing components and routes are either moved into new
blocks or left intact (e.g. `/console/models`, `/console/accounts` list
pages stay — they aren't in the spec's operator surfaces but cutting
them is out of scope for B; the anti-goal list just says the nav
sidebar itself isn't reshaped in this build).

## Data queries

One loader per surface. Both server-side in `page.tsx`.

### `getRosterModels()` — `apps/ops/src/app/console/_loaders/roster.ts`

Single Prisma query with strategic `include`s, then post-process in
memory. For all non-deleted models:

```
prisma.model.findMany({
  where: { deletedAt: null },
  include: {
    agency: { select: { id, name, slug } },
    accounts: {
      where: { deletedAt: null },
      select: { id, handle, status, followerCount },
    },
    driveSources: {
      where: { status: 'ACTIVE' },
      select: {
        id, folderName,
        syncs: {
          where: { startedAt: { gte: 24h ago } },
          select: { status },
        },
      },
    },
  },
  orderBy: { displayName: 'asc' },
})
```

Per row, compute via helpers in `lib/signal-lights.ts`:

| Signal            | Source                                                                       | Status this build |
| ----------------- | ---------------------------------------------------------------------------- | ----------------- |
| Content runway    | none (pre-D)                                                                 | `STUB` ("—")      |
| Escalated tasks   | none (pre-F)                                                                 | `STUB` ("—")      |
| Failed syncs      | `driveSources[].syncs` filtered by `status === 'FAILED'` in last 24h         | **Real**          |
| Quarantined accts | `accounts[].status === 'QUARANTINED'`                                        | **Real**          |
| Incomplete onboard | `onboardingCompletedAt === null`                                            | **Real**          |
| Review queue depth | none (pre-E)                                                                 | `STUB` (no chip)  |

`lastActivity` = `max(model.updatedAt, max(accounts.updatedAt))`.

After computing per-model, sort:
  1. **Any `RED`** → red group, alphabetical by `displayName` within.
  2. Else **any `YELLOW`** (and no red) → yellow group, alphabetical within.
  3. Else **green / all-stub** → green group, alphabetical within.

A model with both red and yellow signals belongs in the red group —
severity of the *worst* signal decides the group, not the count of
signals. Documented as fixture cases in `signal-lights.test.ts`.

### Model-detail loader

Stays in `page.tsx` (no separate file). Single query with the fields
every block needs, so the six blocks render from one prop. Adds to
today's loader:

- `driveSources.syncs` (last 5 per source) — for the Audit block's
  activity feed.
- `accounts.statusTransitions` (last 10 per account) — also Audit.
- `contentAssets._count` + 6 most recent `uploadedAt` — Content block's
  summary + link to full library.

## Migration impact

**None.** Verified:

- Every signal source already exists (`DriveSync`, `Account.status`,
  `Model.onboardingCompletedAt`) or is deferred to later builds.
- No new fields on any model.
- No new indexes. Existing `DriveSync(driveSourceId, startedAt desc)`
  and `Account(status)` indexes are sufficient for the 24h/status
  filters.

## Surface 3 — how anchor-nav renders

- `/console/models/[id]` stays one route.
- Layout becomes:
  - sticky left column (`w-48` or similar): `<AnchorNav>` with six
    links (`#overview`, `#content`, `#scheduled`, `#notes`,
    `#settings`, `#audit`).
  - main column: a vertical stack of `<section id="…">` blocks.
- `AnchorNav` uses an `IntersectionObserver` to highlight the active
  section as the operator scrolls. Links use `<a href="#id">` — the
  browser handles the jump; no JS navigation.
- **No tabs. No sub-routes. No page loads.** Matches the doc literally.

### Section contents
- **Overview** — agency + archetype + voice/tone card + hard rules +
  soft prefs + accounts table (handle / status / followers / device /
  remove). Today's "hero + sidebar" content.
- **Content** — `ContentSourcesCard` (connect / sync / disconnect) +
  asset-library summary (`_count.contentAssets`, recent thumbnails,
  link to `/console/content?modelId=…`).
- **Scheduled / recent posts** — stub. "Generation loop not yet wired
  up (Build D). Scheduled and recent posts will surface here." Rendered
  so the operator doesn't see a missing section.
- **Context notes** — stub. "No active notes. The note overlay arrives
  in Build C." Rendered even when empty.
- **Settings** — existing `RemoveModelCard` (danger zone). Placeholder
  for future editable fields (archetype, voice/tone, agency
  reassignment) shown as read-only with "editable in a future build"
  microcopy. No edit flows in B.
- **Audit** — last 20 events, interleaved by `occurredAt desc`:
  `StatusTransition` rows for this model's accounts + `AssetAuditEvent`
  rows for this model's `ContentAsset`s + recent `DriveSync.finishedAt`
  FAILED/SUCCEEDED events. Reuses `relativeTime`.

## Roster shape

- Page at `/console` (replaces current `StatCard` dashboard).
- Header row:
  - Product name / welcome tag (unchanged feel).
  - `<ActiveNotesStrip count={0} />` — stub, shows "0 notes active".
  - "Onboard model" button linking to `/console/onboard`.
- Body: one `RosterRow` per model, signal lights right-aligned, click
  → `/console/models/[id]`.
- Empty state (no models): `EmptyState` with "Onboard your first
  model" CTA.
- Row coloring: only the signal-light pills are colored. The row
  itself stays uniform — no full-row tints. Per doc: "Hue is identity,
  not decoration."

## Hotkey `N`

Spec calls for `N` on Surface 2 (opens note overlay). The note system
itself arrives in Build C. **Do not wire the hotkey in B** — binding
`N` to a toast or placeholder would ship the wrong mental model
("note overlay exists!") and invite drift. The `<ActiveNotesStrip>`
ships with the stubbed "0 notes" counter; the hotkey lands with the
overlay in C.

## Incomplete-onboarding signal

Per spec: yellow on any row where `onboardingCompletedAt IS NULL`. The
pill text is "Resume onboarding" and links to
`/console/onboard?modelId=X` — which today drops the operator back at
the correct step via `computeResumeStep()` (already shipped in A).

## Tests

- `apps/ops/src/lib/signal-lights.test.ts` — all threshold boundaries:
  runway < 3 / 3.0 / 6.9 / 7.0 / > 7; escalated 0 / 1 / 2 / 3 / 4;
  failed syncs 0 / 1 / 2 / 3-consecutive; quarantined 0 / 1+;
  onboarding null/not-null. Plus explicit **sort-order fixture**
  covering:
  - `{ red+yellow, red-only, yellow-only, green-only }` → verifies
    mixed red+yellow lands in the red group, not split; verifies
    alphabetical-within-group ordering (two red rows with names "B"
    and "A" sort A before B).
- Sort-order test for `getRosterModels` in
  `apps/ops/src/app/console/_loaders/roster.test.ts` with a small
  fixture array (no DB); verifies red-before-yellow-before-green and
  that worst-signal decides the group.
- No component/UI tests — same bar as prior builds.

## Anti-goals — explicitly NOT in B

- No ContextNote overlay, no `N` hotkey wiring (**C**).
- No generation, no Post drafts, no confidence routing (**D**).
- No review queue UI (**E**).
- No VA task runner, no Task creation (**F**).
- No engagement ingest, no peak-hours computation (**G**).
- No camps (**H**).
- **No edit flows** for model fields (voice/tone, archetype, slug,
  agency reassignment). Surface 3 Settings block renders them as
  read-only with microcopy. Edits land when there's a driving need.
- **No nav sidebar reshape.** The existing left-rail console nav stays
  as-is. Reshaping it into three operator surfaces ("Onboard", "Roster",
  "Model detail") is a follow-up once all three builds are real. Build B
  only reshapes `/console` (home) and `/console/models/[id]` (detail).
- **No deletion of `/console/models`, `/console/accounts`, `/console/content`
  list pages.** They're useful for debugging and already-shipped. The
  spec's "what is NOT on the operator surfaces" describes the home
  nav, not the deeper routes.

## Verification

- `pnpm -r typecheck` green.
- `pnpm --filter @xcrm/ops lint` green.
- `pnpm --filter @xcrm/ops test` — new signal-lights tests pass, prior
  tests still pass.
- `pnpm --filter @xcrm/ops build` — `/console` renders as `ƒ` (dynamic
  server-rendered); `/console/models/[id]` still renders as dynamic.
- **Manual smoke:**
  1. Log in as founder → `/console` is the roster.
  2. With no models, see the onboard CTA.
  3. Onboard a model partway, abandon at step 3 → roster shows the
     model with a yellow "Resume onboarding" pill; click → drops back
     at step 3.
  4. Complete onboarding → pill disappears.
  5. Open a model detail → six anchor-nav sections, sticky side-rail,
     active section highlights on scroll.
  6. Quarantine an account → row goes red on roster.
  7. Intentionally break a Drive folder share → after next sync, row
     shows yellow/red on failed-syncs signal.

## Rough size

~12 new files, ~4 modified, ~350–500 LOC net (mostly components and
tests). Single commit on `claude/build-crm-system-zo5AT` when reviewed.
