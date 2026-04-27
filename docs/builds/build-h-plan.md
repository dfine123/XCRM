# Build H plan — Camps

## Context

Per `/docs/operational-model.md` Build H is **deferred** and "not a
prerequisite" — the single-account loop (A through G) is the
real product. Camps add coordination on top: when multiple accounts
share a model's content library, the same asset shouldn't fire
across them within the same hour.

The most concrete spec line: *"camp repost coordination (Build H)
so a shared asset isn't fired across multiple accounts within the
same hour."* That's what Build H actually has to deliver.

## v1 scope

**In:**
1. Operator-managed camps — create, add/remove accounts, activate,
   complete. UI at `/console/camps`.
2. **Camp-aware asset spacing** — Build D's `loadCandidateAssets`
   gets a new exclusion: if a camp-mate already has the asset in a
   live Post (PENDING_APPROVAL / APPROVED / SCHEDULED / POSTED)
   within the spacing window, drop it from the pool.
3. Camp visibility — model-detail Overview block shows camp
   memberships per account; new top-level `/console/camps` lists
   camps; click → detail page with member list + add/remove.

**Out (anti-goals):**
- Algorithmic camp proposals (operator-only for v1).
- Repost flow integration — `Repost` model exists from Phase 0 but
  the surrounding flow doesn't, so there's nothing to wire.
- `CampPairingHistory` writes (no pairing algorithm yet).
- Auto-activate cron — operator flips PROPOSED → ACTIVE manually.
- Algorithmic camp closure — operator flips ACTIVE → COMPLETED at
  end-of-week or whenever they want.
- Cross-model camps — schema permits, but spacing only matters when
  members share a content library. Surface a soft warning when an
  operator adds accounts from different models; let it through.
- Per-camp engagement aggregation. Defer.
- Roster "in-camp" pill — surface camps on the model detail
  Overview block only. Adding a roster pill is scope creep when
  the operator already drills via roster → model.

## Schema impact

**None.** `Camp`, `CampMembership`, `CampPairingHistory`,
`CampStatus`, `Repost` all in place from Phase 0.

## Architectural decisions

### Spacing window: 72 hours (3 days)

Tunable constant `CAMP_ASSET_SPACING_HOURS = 72`. If any
camp-mate has the asset in a live Post within the last 72h *or*
scheduled within the next 72h, the asset is blocked for the
target account.

3 days is generous for v1 — accounts in a camp typically
post the same asset on the same day for amplification. If we
need shorter or longer, we tune the constant.

### Candidate-asset predicate extension

Today's `loadCandidateAssets`:
1. asset.modelId = account.modelId
2. asset.deletedAt null + tagStatus TAGGED + type ∈ {PHOTO, GIF}
3. AssetUsage.none on this account
4. NOT in this account's PENDING_APPROVAL / APPROVED / SCHEDULED Posts

Build H adds:
5. NOT in any **camp-mate's** live Post within ±72h of now.

The query for #5: gather camp-mate `accountId`s of the target via
`CampMembership` joined to active `Camp`, then filter Posts by
those accountIds + the time window. Keep it one extra query,
collected as a `Set<assetId>` and excluded in JS — same pattern
as the existing `committed` set.

### Camp lifecycle

`PROPOSED` → operator-created drafts. Members can be added/removed
freely.

`ACTIVE` → coordination is in effect. Asset spacing applies. Members
can still be added/removed but it's flagged in the UI as a
mid-flight change.

`COMPLETED` → archive state. Doesn't affect spacing
(`isCampActive(camp.status === ACTIVE)` is the check the predicate
uses).

`weekOf` is informational metadata only in v1 (drives sort order on
the list page). No automatic week rollover.

## Component inventory

### New (backend / loaders)
- `apps/ops/src/lib/camp-spacing.ts` + `.test.ts` — pure logic:
  - `CAMP_ASSET_SPACING_HOURS = 72`
  - `assetsBlockedByCampMates(rows, now): Set<string>` — given a
    list of `{assetId, scheduledFor, postedAt}` rows, returns the
    set whose timestamps fall inside `now ± SPACING`.
- `apps/ops/src/app/console/_loaders/camp-mate-blocks.ts` —
  query helper: pulls live Posts on this account's camp-mates,
  applies the pure spacing logic, returns `Set<assetId>` for
  candidate-assets to exclude.
- `apps/ops/src/app/console/_loaders/camps.ts`:
  - `getCampList()` — all camps with member counts, sorted by
    `(status order: ACTIVE, PROPOSED, COMPLETED), weekOf desc`
  - `getCampDetail(id)` — single camp + member accounts + their
    models
  - `getCampsForAccount(accountId)` — for the model detail.
- `apps/ops/src/app/console/camps/actions.ts`:
  - `createCamp(formData)` — `weekOf` (date string) → PROPOSED
  - `activateCamp(formData)` — PROPOSED → ACTIVE + approval
  - `completeCamp(formData)` — ACTIVE → COMPLETED
  - `addAccountToCamp(formData)` — CampMembership upsert
  - `removeAccountFromCamp(formData)` — delete by composite key

### Updated
- `apps/ops/src/app/console/_loaders/candidate-assets.ts` — add
  the camp-mate exclusion via the new loader.
- `apps/ops/src/app/console/models/[id]/page.tsx` — Overview block
  surfaces a "Camp memberships" row per account when present.
- `apps/ops/src/services/generate-draft.ts` — log the camp-mate
  exclusion size in the prompt-start line.

### New (UI)
- `apps/ops/src/app/console/camps/page.tsx` — list page (one row
  per camp).
- `apps/ops/src/app/console/camps/new/page.tsx` — create form.
- `apps/ops/src/app/console/camps/[id]/page.tsx` — detail with
  member-add form, status transitions, member-remove buttons.
- `apps/ops/src/app/console/camps/_components/camp-row.tsx` —
  list row.
- `apps/ops/src/app/console/camps/_components/add-account-form.tsx`
  — client form to attach an account by handle.
- `apps/ops/src/app/console/camps/_components/lifecycle-buttons.tsx`
  — Activate / Complete forms.

### Tests
- `camp-spacing.test.ts` — boundary cases on the time window.
- `camps/actions.test.ts` — branches for create, activate,
  complete, add (handle resolution), remove (composite key).

## Anti-goals — explicitly NOT in H

- No nav-sidebar reshape (still tracked in `/docs/reality-delta.md`).
- No `Repost` flow.
- No `CampPairingHistory` writes — model is there but unused
  in v1.
- No algorithmic proposal generation.
- No cron-driven activation or completion.
- No engagement aggregation per camp.
- No bulk-add (ImportFromCSV etc.).

## Verification

Tests:
- `camp-spacing.test.ts` — assets within window blocked, outside
  not, mixed scheduledFor + postedAt rows, empty input.
- `camps/actions.test.ts` — create / activate / complete /
  add-by-handle / remove.

Manual:
1. Create a camp `weekOf=this Sunday`. Status PROPOSED.
2. Add 2 accounts of the same model.
3. Activate → ACTIVE.
4. Generate a draft on account A — picks asset X.
5. Generate a draft on account B — asset X excluded from pool;
   picks something else.
6. Wait > 72h (or backdate) → asset X reappears for B.
7. Complete the camp → spacing exclusion stops.

## Commit plan

Two chunks:
1. **Backend** — spacing lib + tests, loaders, actions + tests,
   candidate-asset predicate extension.
2. **UI** — camps list/new/detail pages, model-detail Overview
   integration, changelog.
