# Build C plan — Context note system

## Context

Per `/docs/operational-model.md` "The context note mechanic". Operator-
invoked steering signal for the generator. **Rare, not mandatory** — the
generator must produce great output even when zero notes are active.
This build wires the create path, the visibility surfaces (roster
header strip + model-detail `#notes` block stubbed in Build B), and the
expiration cron. It does **not** touch the generator itself — that's
Build D.

## Schema — already in place

`ContextNote` exists in `packages/db/prisma/schema.prisma` with all the
fields we need:

```
id, authorUserId, title, body,
effectiveFrom, effectiveUntil,
weight (Int default 5),
scope (Json default {"all":true}),
status (ACTIVE | EXPIRED | CANCELLED),
createdAt/updatedAt,
@@index([status, effectiveFrom, effectiveUntil])
```

**No migration needed.** The index is the right shape for both the
generator's lookup query (Build D) and the expiration cron's bulk
update.

## Scope shape

Defined in this build as a discriminated union stored in the `scope`
JSON column:

```ts
type Scope =
  | { kind: 'ALL' }
  | { kind: 'ARCHETYPES'; archetypes: Archetype[] }
  | { kind: 'ACCOUNTS';   accountIds: string[] };
```

Resolution helper `noteAppliesTo(scope, { archetype, accountIds })`
lives in `apps/ops/src/lib/context-notes.ts` and is exhaustively unit
tested. Scope is deliberately simple — "just models by archetype, or
just specific accounts, or all" covers the doc's examples. Richer
predicates (status windows, time-of-day, etc.) can extend the union
later without a schema change.

## Flows

1. **Hotkey `N`** (global, console-layout-scoped): opens the overlay.
   Guards: don't fire when the active element is `input | textarea |
   [contenteditable]`, and don't fire while the overlay is already
   open. `Esc` closes; focus returns to the previously-focused element.

2. **Overlay form.** Fields:
   - **Title** — short heading (required, ≤80 chars).
   - **Body** — free-form text (required, ≤2000 chars).
   - **Scope** — radio: "all models" / "archetypes" / "specific accounts",
     with a conditional multi-select depending on choice.
   - **Weight** — slider 1–10 (default 5).
   - **Duration** — radio: today / 3 days / 1 week / until removed.
     Maps to `effectiveUntil` (null = until removed).
   Submit → `createContextNote` server action. On success: overlay
   dismisses, roster + model detail revalidate.

3. **Roster header** — `ActiveNotesStrip` goes from stubbed-zero to
   reading live count. Clickable: expands inline to list the active
   notes (title + scope summary + remaining time + cancel button).
   Still no `Cmd+K` palette — per spec, deferred at earliest to C.
   We're in C, and **one hotkey remains sufficient**; palette is
   deferred further (explicitly: the doc says "deferred to Build C at
   earliest", not "must ship in C").

4. **Model detail `#notes` block** — stub copy replaced by a real list
   of notes whose scope resolves to this model. Empty-state stays
   when none apply.

5. **Expiration cron** — every 10 minutes, hit
   `POST /api/context-notes/expire` (same CRON_SECRET / in-process
   node-cron loopback pattern we already use for drive sync). The
   endpoint runs:
   ```sql
   UPDATE "ContextNote"
      SET status = 'EXPIRED', updatedAt = NOW()
    WHERE status = 'ACTIVE'
      AND effectiveUntil IS NOT NULL
      AND effectiveUntil <= NOW();
   ```
   Returns `{ expired: N }`.

## Component inventory

### New
- `apps/ops/src/lib/context-notes.ts` — scope zod schema + discriminated
  union type + `noteAppliesTo()` resolver + `formatScope()` for UI copy
  + `formatRemainingTime()`.
- `apps/ops/src/lib/context-notes.test.ts` — scope/resolver tests.
- `apps/ops/src/app/console/context-notes/actions.ts` —
  `createContextNote`, `cancelContextNote`. `'use server'`.
- `apps/ops/src/app/console/_components/note-hotkey.tsx` — client,
  global keyboard listener.
- `apps/ops/src/app/console/_components/note-overlay.tsx` — client,
  modal + form.
- `apps/ops/src/app/console/_components/note-list-item.tsx` — shared
  item render used by both the expandable strip and the model-detail
  `#notes` block.
- `apps/ops/src/app/api/context-notes/expire/route.ts` — POST cron.
- `apps/ops/src/app/console/_loaders/active-notes.ts` — query active
  notes for the roster + the model detail.

### Updated
- `apps/ops/src/app/console/layout.tsx` — mounts `<NoteHotkey />`
  globally so every console route has the overlay available.
- `apps/ops/src/app/console/_components/active-notes-strip.tsx` —
  reads real count, becomes expandable.
- `apps/ops/src/app/console/page.tsx` — passes the active-notes count
  + preview list into the strip.
- `apps/ops/src/app/console/models/[id]/page.tsx` — `#notes`
  SectionBlock renders the real list.
- `apps/ops/src/instrumentation.ts` — register the second cron
  (context-notes expire) alongside the drive-sync one.

### Deleted
Nothing.

## Data queries

### `getActiveNotes()` — `_loaders/active-notes.ts`
For the roster strip: all notes where `status=ACTIVE` AND
`effectiveFrom <= now()` AND (`effectiveUntil IS NULL OR effectiveUntil > now()`).
Minimal projection: id, title, scope, weight, effectiveFrom,
effectiveUntil, author.name. Ordered by `weight desc, createdAt desc`.

### `getActiveNotesForModel(model)` — same file
All active notes, then filter in JS via `noteAppliesTo()`. In-memory
filter is fine because the doc explicitly frames notes as rare
(expected count in single digits at steady state).

## Migration impact

**None.**

## Anti-goals — explicitly NOT in C

- **No `Cmd+K` palette.** Spec lets us defer it past C; we defer it
  past C. One hotkey covers the current vocabulary.
- **No note editing.** Create + cancel only. If you typo'd, cancel and
  recreate.
- **No generator integration.** Build D reads the notes. C just writes
  and displays.
- **No "did this note move the numbers" analytics.** Later phase.
- **No archived/expired note browsing UI.** EXPIRED and CANCELLED rows
  are queryable but we do not render them. Operator does not clean up.
- **No richer scope dimensions** (e.g. time-of-day, engagement
  thresholds). The union has three cases; adding a fourth is
  additive-without-migration when the need is real.

## Verification

- `pnpm -r typecheck`, `lint`, `test`, `build` all clean.
- New `context-notes.test.ts`: scope resolution (ALL matches,
  ARCHETYPES matches on membership, ACCOUNTS matches on any overlap),
  duration → `effectiveUntil` mapping, remaining-time formatting.
- Manual smoke:
  1. Hit `N` on the roster → overlay opens.
  2. Create a note scoped to ALL → roster strip shows "1 note
     active"; every model's `#notes` block lists it.
  3. Create a note scoped to ARCHETYPES=[model-1's archetype] → only
     model-1's `#notes` lists it.
  4. Cancel a note from the roster strip → disappears from both
     surfaces.
  5. Create a note with 3-day duration → `effectiveUntil` is ~3d
     ahead; manually flip it in the DB to 1 min ago, trigger the
     cron, note flips to EXPIRED and vanishes.

## Commit plan

Three logical chunks, each self-contained and runnable:

1. **Backend** — scope lib, server actions, API expire route,
   instrumentation cron registration, tests.
2. **Create path** — `NoteHotkey`, `NoteOverlay`, layout wiring.
3. **Visibility** — `ActiveNotesStrip` expansion, model detail
   `#notes` block, `getActiveNotes()` loaders.

Changelog updated at the end of chunk 3.
