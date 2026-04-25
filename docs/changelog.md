# Changelog

Per spec §9 step 8 — every shipped feature logged here.

## Unreleased — Build E: Review queue UI (2026-04-23)

The operator surface for triaging the `PENDING_APPROVAL` posts that
Build D produces. Per spec ("not a daily destination"): roster signal
light surfaces it when there's something to look at, otherwise quiet.
Plan at `/docs/builds/build-e-plan.md`. Two commits:

- **Backend** (`a9326eb`) —
  - `apps/ops/src/app/console/_loaders/review-queue.ts`:
    `getReviewQueue()` returns FIFO PENDING_APPROVAL posts with
    model + account + agency joins. Cap 100; filtering and
    pagination deliberately deferred to a future build.
  - `apps/ops/src/app/console/_loaders/asset-alternatives.ts`:
    `getAssetAlternativesForAccount()` reuses Build D's candidate-
    asset predicate to surface top-N novelty alternatives for the
    Edit form's swap UI.
  - `apps/ops/src/app/console/review/actions.ts`: three server
    actions:
    - `approvePost` — PENDING_APPROVAL → SCHEDULED, idempotent on
      already-resolved posts. Records approval in
      `generationMeta.approval` for Build G's signal-learning.
    - `rejectPost` — PENDING_APPROVAL → CANCELLED with optional
      reason persisted at `generationMeta.rejection` (the negative-
      signal feedback Build G will consume).
    - `editAndApprovePost` — `useFormState`-shaped action.
      Updates copy + assetIds, sets SCHEDULED, records original
      values at `generationMeta.edit`. Asset must belong to the
      same model (no cross-model swaps). Validates copy ≤280 / ≥1.
  - 11 new tests covering each action's branches.

- **UI + roster wiring** (this commit) —
  - `/console/review` page (server component). Loads queue + asset
    alternatives in parallel, renders one card per pending post
    with copy preview + thumbnail + confidence + reasoning + hard
    rules + three actions.
  - `_components/review-item.tsx` — per-card render. Server
    component; the action triggers are forms or client expanders.
  - `_components/edit-form.tsx` — client expander. Copy textarea
    with 280-counter, current-asset + up-to-6 alternatives as
    click-to-swap thumbnails (proxied via `/api/drive/file/[id]`),
    plus a paste-an-ID escape hatch for assets outside the top-N.
  - `_components/reject-form.tsx` — client expander. Confirm with
    optional reason textarea; submit posts to `rejectPost`.
  - Roster header band: "Review queue: N pending →" link appears
    when total > 0; hidden on healthy days.
  - Roster row restructured so the review-queue pill can be its
    own `<Link>` to `/console/review` without nesting anchors. The
    name + accounts area remains the primary drill target into
    model detail.
  - Model detail `#scheduled` block: each PENDING_APPROVAL row
    gets a "review →" anchor link to `/console/review#post-<id>`
    so operators can drill from a model into the queue with
    scroll-to-item.

Schema impact: none. Workspace: 87 ops + 16 ai + 5 shared tests pass;
typecheck + lint clean; `/console/review` is in the route manifest as
dynamic.

Anti-goals honoured: no bulk approve/reject, no schedule-time
editing, no filtering on the queue page, no rejected-posts recovery
flow, no inline content-library picker (the alternatives + manual-ID
escape hatch is enough for v1).

## Unreleased — Build D: Generation loop v1 (2026-04-23)

The autonomous generator. Per `/docs/operational-model.md` "The
generation loop": runs on a 4h cron, produces drafts, routes by
confidence into SCHEDULED or PENDING_APPROVAL. Plan committed ahead
of code at `/docs/builds/build-d-plan.md`. Three commits + plan:

- **Plan + off-spec adoption** (`f6648c1`) — Build D plan written;
  vision-tagging schema v2 and the asset-novelty score (the previous
  "off-spec carryovers") are formally adopted by D since the
  generator now uses both. Operational model doc updated to reflect.

- **Backend primitives** (`ae260da`) — pure logic, prompt templates,
  Claude call:
  - `packages/shared/src/prompts/draft-post.ts` — system prompt
    (ephemeral-cached) + `buildDraftPostUserPrompt()` that renders
    a compact view of model + account + active notes + asset pool.
    Caption is the retrieval backbone; mood/lighting/aesthetic/novelty
    ride along as tiebreakers.
  - `packages/ai/src/draft-post.ts` — `draftPost(input) → DraftResultT`.
    Mirrors `tagAsset()` shape: tolerant JSON extraction, schema
    validation, `AiDraftError` on bad parse / out-of-pool assetId.
    Text-only call (no image bytes) — caption-driven.
  - `apps/ops/src/lib/post-scheduler.ts` — pure scheduler.
    Walks hour-by-hour from next-full-hour, picks the first peak-hour
    slot ≥ `SPACING_HOURS=3` clear of existing scheduled times,
    within a 72h horizon. Defaults peak hours to `[9,12,18,21]` UTC
    when `Account.peakHours` is empty.
  - `apps/ops/src/lib/confidence-routing.ts` — thresholds: FRESH_BUILD
    always reviews, ACTIVE_RAMPING <0.8, ACTIVE_ESTABLISHED <0.7,
    ACTIVE_MATURE <0.6.
  - 35 new tests across the three new modules.

- **Orchestrator + cron** (`ec1a894`) — wiring:
  - `apps/ops/src/services/generate-draft.ts` —
    `generateDraftForAccount(accountId)` returns a discriminated
    outcome (CREATED / SKIPPED / NO_SLOT / LLM_ERROR). Gate order
    skips the LLM call when no schedule slot is available, saving
    a doomed Anthropic spend. `runScheduledGeneration()` fans the
    orchestrator across every eligible account.
  - `apps/ops/src/app/api/generate/cron/route.ts` — CRON_SECRET-
    gated. Separate `GENERATE_ENABLED` flag so preview deploys don't
    burn credits. Returns `{ accountsRun, created, skipped, noSlot,
    errors }`.
  - `apps/ops/src/app/api/generate/[accountId]/route.ts` —
    session-gated manual trigger. Bypasses `GENERATE_ENABLED` (a
    click is always intentional).
  - `apps/ops/src/app/console/_loaders/candidate-assets.ts` — pool
    predicate + novelty rank + top-30 cap. Excludes assets already
    committed to PENDING_APPROVAL/APPROVED/SCHEDULED posts on the
    account so the generator can't double-book.
  - `apps/ops/src/instrumentation.ts` — third cron registered
    alongside drive-sync and context-notes-expire. Default
    `GENERATE_CRON=0 */4 * * *`.
  - `infra/env/.env.example` — `GENERATE_CRON` + `GENERATE_ENABLED`
    documented.

- **UI surfaces + signal unstubbing** (this commit):
  - Surface 3 `#scheduled` block now real: a "Manual generation" row
    with one `<GenerateDraftButton>` per generation-eligible account,
    plus a list of upcoming SCHEDULED + PENDING_APPROVAL posts (copy,
    confidence chip, scheduled-for, reasoning, asset link).
  - Roster signal lights flip from STUB to live for **runway** and
    **review queue depth**. Runway = `scheduledIn14d / (accounts ×
    DEFAULT_CADENCE_PER_DAY=3)`. Review queue renders NEUTRAL with
    the count when > 0, STUB when 0 (keeps day-one rosters clean).
  - One grouped Prisma `groupBy` query feeds both signals — the
    roster loader doesn't N+1.
  - Generate button POSTs to `/api/generate/[accountId]`, surfaces
    the orchestrator outcome inline ("Draft scheduled · conf 78%" or
    "No open slot in the next 72h" etc.), then `router.refresh()`.

Schema changes: none. `Post`, `PostStatus`, `Post.confidenceScore`,
`Post.generationMeta`, `Account.peakHours`, `AssetUsage` were all
present from Phase 0.

Workspace: typecheck + lint + 76 ops tests + 16 ai tests + 5 shared
tests pass; build emits `/api/generate/cron` and
`/api/generate/[accountId]` as dynamic.

Anti-goals honoured: no review queue UI (that's Build E — D just
writes PENDING_APPROVAL rows for E to render), no VA task creation
(F), no engagement ingest (G), no camps (H), no actual posting,
no per-account timezone, no rejected-draft training loop.

## Unreleased — Build C: Context note system (2026-04-23)

Per `/docs/operational-model.md` "The context note mechanic". The
operator's lever for injecting real-world signal into generation.
Plan + three commits on `claude/build-crm-system-zo5AT`:

- **Backend** (`aa949ad`) — `apps/ops/src/lib/context-notes.ts` defines
  the scope discriminated union (ALL / ARCHETYPES / ACCOUNTS) + zod
  schema + `noteAppliesTo()` resolver + `durationToEffectiveUntil()` +
  `formatScope` / `formatRemainingTime` UI helpers. Covered by 19
  unit tests. `apps/ops/src/app/console/context-notes/actions.ts`
  handles create (zod-validated, resolves @handles → IDs server-side)
  and cancel (flips ACTIVE → CANCELLED, distinct from natural EXPIRED
  so audit preserves intent). `apps/ops/src/app/api/context-notes/expire/route.ts`
  is a CRON_SECRET-gated POST that flips ACTIVE rows whose
  `effectiveUntil` has passed. Registered in `instrumentation.ts`
  alongside drive-sync, default cadence `*/10 * * * *`.
- **Create path** (`71e8049`) — `<NoteHotkey>` global listener binds
  `N` (skips inputs/textareas/selects/contenteditable, doesn't
  intercept Cmd+N / Ctrl+N / Alt+N). Opens `<NoteOverlay>`, a
  backdrop-click / ESC-close modal with title, body, scope
  (All/Archetypes/Accounts), weight slider, duration radio. Mounted
  once in `apps/ops/src/app/console/layout.tsx`.
- **Visibility** — `_loaders/active-notes.ts` supplies a single
  `getActiveNotes()` plus a pure `filterNotesForModel()`.
  `<ActiveNotesStrip>` on the roster header is now expandable with
  the live count; clicking it drops down an in-page list.
  `<NoteListItem>` renders one note (title, weight, scope summary,
  remaining time, cancel button) — shared between the strip and the
  model detail `#notes` SectionBlock. `#notes` now shows actual notes
  that apply to the open model (via `noteAppliesTo`), with empty-state
  copy when none.

Schema changes: none. The `ContextNote` table shipped in Phase 0 had
every field we needed.

Explicit anti-goals honoured: no Cmd+K palette (still deferred), no
note editing (create + cancel only), no generator integration (Build
D), no archived/expired browsing UI.

## Unreleased — Build B: Roster + Model detail reshape (2026-04-23)

First pass at the three-surface operator model from
`/docs/operational-model.md`. Plan committed ahead of code at
`/docs/builds/build-b-plan.md`.

- **Surface 2 — Roster** (`apps/ops/src/app/console/page.tsx`)
  replaces the Phase-0 `StatCard` dashboard. One row per non-deleted
  model with signal-light pills, sorted red → yellow → green (worst
  signal wins the group, alphabetical within). Healthy roster shows
  all green = "nothing needs attention".
  - `_loaders/roster.ts` — single batched query with signal folding.
  - `_components/signal-light.tsx` — one pill, OKLCH hue per state.
  - `_components/roster-row.tsx` — server component.
  - `_components/active-notes-strip.tsx` — stubbed at 0 pending Build C.
- **Surface 3 — Model detail** (`apps/ops/src/app/console/models/[id]/page.tsx`)
  reshaped into six anchor-navigable blocks (Overview / Content /
  Scheduled / Context notes / Settings / Audit) with a sticky
  `<AnchorNav>` left-rail. Single URL, no tabs, no sub-routes. Active
  section highlights as you scroll via `IntersectionObserver`.
- **Signal lights** — pure logic in `apps/ops/src/lib/signal-lights.ts`,
  25 tests covering every threshold + the red+yellow mixed-severity
  case. Sort comparator tested with full red/yellow/green fixtures.
- **Incomplete-onboarding signal** — yellow pill with "Resume
  onboarding" label; clicking the row routes back to
  `/console/onboard?modelId=X` instead of the detail page.

Real signals rendered today: failed Drive syncs (24h window + 3-
consecutive red threshold), quarantined accounts, incomplete
onboarding. Stubbed pending later builds: content runway (Build D),
escalated tasks (Build F), review queue depth (Build E).

Explicit anti-goals landed intact: no `N` hotkey wiring, no generation,
no review queue UI, no VA runner, no engagement ingest, no nav-sidebar
reshape. The sidebar divergence is logged in `/docs/reality-delta.md`.

No schema changes. No new dependencies.


## Unreleased — Soft-delete-aware uniqueness (2026-04-22)

Fixes two related onboarding bugs by moving DB-level unique constraints
to partial indexes (WHERE deletedAt IS NULL) while keeping Prisma's
schema view declarative (`@unique`). Callers unchanged; soft-deleted
rows no longer squat on email/slug/handle namespaces.

DriveSource replaces soft-delete with a `status` enum (ACTIVE |
DISCONNECTED) so reconnect is a row-level state transition —
DriveSync history and ContentAssets stay attached across reconnects.
New `upsertDriveSource()` helper shared by the model-detail connect
form and onboard step 4 reactivates a DISCONNECTED row on reconnect.

New UI on the model detail page:
- Remove-account button on each row (soft-deletes + frees the handle).
- Danger-zone card with retype-display-name confirm (soft-deletes the
  model, cascades to accounts, flips drive sources to DISCONNECTED).

Vitest wired up in apps/ops; 8 regression tests cover the
connect→disconnect→reconnect loop and the softDeleteAccount happy
path.

Partial unique indexes apply to: User.email, AgencyUser.email,
Agency.slug, Account.handle, Account.platformAccountId,
Post.platformPostId. Migration `20260422010000_soft_delete_partial_uniques`.

## Unreleased — Build A: guided model onboarding wizard (2026-04-22)

First operator surface from the operational-model doc (Surface 1: Onboarding).
Replaces the scattered "new agency / new model / new account / connect drive"
paths with one linear flow that takes an operator from empty state to active
model in under ten minutes. Saves after every step — close the tab, come back
later, resume where you left off.

- `packages/db`: `Model.onboardingCompletedAt DateTime?` +
  migration `20260421010000_build_a_onboarding`. Null = in progress, set =
  activated. Drives the resume-list predicate on `/console/onboard`.
- `apps/ops/src/app/console/onboard`:
  - `page.tsx` — URL-driven dispatcher. No params → entry (resume list +
    "Start new" → step 1). `?agencyId=X` → step 2. `?modelId=X[&step=N]` →
    resume at computed step (never skips ahead; capped at
    `computeResumeStep()`). Completed model redirects to
    `/console/models/[id]`.
  - `_lib/resume.ts` — `computeResumeStep(modelId)`: 3 if no accounts, 4 if no
    drive sources, else 5. Linear, no skipping.
  - `_lib/drive-url.ts` — `parseDriveFolderId()` accepts `/folders/<ID>`,
    `?id=<ID>`, or a raw ID.
  - `actions.ts` — seven server actions, all zod-validated +
    `requireUser()`. Step 1 creates-or-picks an agency, step 2 creates a
    model, step 3 adds accounts (can inline-create a PhoneDevice), step 4
    connects a DriveSource and best-effort enqueues an initial sync, step 5
    stamps `onboardingCompletedAt`. `abandonOnboarding` soft-deletes an
    in-progress model.
  - `_components/` — `stepper.tsx` (5-step indicator, accent hue 100) plus
    one component per step. Each step component is a client form using
    `useFormState` / `useFormStatus`; the wizard page itself is a server
    component.
- `apps/ops/src/app/console/layout.tsx`: added `/console/onboard` as a
  `NAV_PRIMARY` entry (alongside Dashboard) with icon `On`, literal hue 100.
  Build B will reshape the nav into the three operator surfaces and formalize
  `OPS_HUES` — literal here keeps Build A scoped.

VA-readiness crosscheck:
- `DriveSource.createdByUserId` captured at step 4 (same path as feature 2).
- Account + PhoneDevice inline-creation in step 3 uses the same creation
  paths as the standalone pages — no parallel write path to unwind.
- `onboardingCompletedAt` is additive; no existing reads change behavior.

## Unreleased — Feature 2: Drive ingest + Claude-vision auto-tagging (2026-04-21)

First end-to-end content loop: operator connects a Google Drive folder to a
model, the worker polls every 10 minutes, Claude-vision auto-tags each new
asset, the per-model library renders thumbnails with auto-tags attached, and
VAs (when role gating flips on) will see only assets that haven't been posted
yet. Everything writes through audited server actions — no simplify-now
shortcuts.

- `packages/db`: schema additions + migration `20260421000000_feature_2_drive_ingest`.
  New `DriveSource` (folder connection, soft-deletable, unique per
  `modelId+folderId`, stores `cursor` for incremental poll), `DriveSync` (one
  row per poll run with `filesSeen/Ingested/Skipped` counters + `error` + who
  triggered it), `AssetAuditEvent` (DELETE / RESTORE / MANUAL_TAG_EDIT /
  REVIEW_OVERRIDE — real audit rows, not JSON breadcrumbs). `ContentAsset`
  gained `driveSourceId`, `driveFileId`, `driveChecksum` with a composite
  unique on `(driveSourceId, driveFileId)` so poll re-runs are idempotent.
- `packages/ai`: new workspace package. `tagAsset({ bytes, mime })` sends a
  single image to Claude with the shared `assetTagPrompt()`, parses the JSON
  response through zod, throws `AiTagError` on malformed output. System
  prompt is marked `cache_control: ephemeral` so bulk folder syncs hit the
  Anthropic prompt cache.
- `packages/drive-adapter`: new workspace package wrapping `googleapis` +
  service-account JWT auth. MIME-filters to `image/*` and `video/*`, exposes
  `listFiles(folderId, { pageToken })` and `fetchFileBytes(fileId)`. Supports
  shared drives.
- `packages/jobs`:
  - `queues.ts` now lazy-connects to Redis so ops can import
    `enqueueDriveSync` at build time without a live Redis.
  - `schedule.ts` registers a `driveSync` recurring job at
    `DRIVE_SYNC_POLL_CRON` (default `*/10 * * * *`).
  - `handlers/drive-sync.ts`: fan-out job (`recurring:driveSync`) reads all
    active `DriveSource`s and enqueues one `sync-source` job each. Per-source
    job opens a `DriveSync` row, paginates the folder, upserts each file by
    the composite key, and re-enqueues the tagger when the md5 checksum
    changes. Finalizes the `DriveSync` + `DriveSource` rows transactionally;
    FAILED with `error` message on throw.
  - `handlers/asset-auto-tagger.ts`: fetches bytes, calls `tagAsset`, writes
    `autoTags` + flips `tagStatus` to TAGGED. Videos skip with empty auto-tags
    (vision can't read them yet). On final attempt failure flips to FAILED so
    the UI can surface it.
  - `worker.ts` rewritten with a `HANDLERS: Record<QueueName, Processor>` map
    so each queue gets its own handler — Phase-0 stubs remain for queues whose
    features haven't landed yet.
- `apps/ops`:
  - `app/console/drive-sources/actions.ts`: `connectDriveSource`,
    `disconnectDriveSource` (soft-delete), `triggerManualSync` — all zod +
    `requireUser()` + `revalidatePath` on the model detail route.
  - `app/console/content/actions.ts`: `softDeleteAsset`, `restoreAsset`,
    `updateManualTags` — each wraps the ContentAsset mutation + an
    `AssetAuditEvent` insert in a single `prisma.$transaction` so the trail
    never drifts.
  - `app/console/models/[id]`: replaced the placeholder card with a real
    `ContentSourcesCard` — table of connected folders with last-sync status
    tag, relative "last synced" timestamp, "Sync now" + "Disconnect" buttons,
    and an inline connect form.
  - `app/console/content/page.tsx`: rebuilt as an asset browser with URL-param
    filters (`modelId`, `type`, `tagStatus`, `hidePosted` — default `true`
    using `usages: { none: {} }`). Thumbnail grid, no pagination yet (cap
    120 assets — enough for the first real folder).
  - `app/console/content/[id]/page.tsx`: per-asset detail with preview, auto-
    tags, editable manual tags, `AssetUsage` history, `AssetAuditEvent`
    history, soft-delete/restore. URL-shareable for the VA compose modal in
    feature 3.
- `infra/env/.env.example`: added `GOOGLE_SERVICE_ACCOUNT_JSON` (base64)
  and `DRIVE_SYNC_POLL_CRON`.

Storage strategy — MVP uses `webContentLink` as `storageUrl`. If the operator
revokes the service-account share, preview URLs 404. Mitigation (copy-on-
ingest to R2) is a follow-up; flagged in the connect-form copy so the
operator knows.

VA-readiness crosscheck:
- `DriveSource.createdByUserId`, `DriveSync.triggeredByUserId` populated on
  every mutation.
- Asset delete / restore / manual-tag edit each emit an `AssetAuditEvent`
  with actor + kind + payload (including `{ before, after }` tag diff).
- `hidePosted` picker predicate (`usages: { none: {} }`) already works today
  in the ops browser — the VA compose modal in feature 3 reuses the same
  query.
- Soft-delete (`deletedAt`) honored on `DriveSource` and `ContentAsset` reads.

## Unreleased — Feature 1: core entity CRUD (2026-04-21)

First working loop — shape of the product, backed by the real state machine.
Operator can stand up an agency from zero in the console; everything the VA
execution loop needs to exist later is addressable from a UI today.

- `@xcrm/ui`: added form primitives (`Input`, `Textarea`, `Select`, `Label`,
  `Field`, `Table`) so feature pages don't have to hand-roll every control.
- `apps/ops/src/services/account-status.ts`: server service wrapping the
  state-machine check + `StatusTransition` audit insert + account update in a
  single Prisma transaction. Every transition that reaches the DB has an
  actorId. No founder-only shortcut — the same service will run for VAs.
- `apps/ops/src/app/console/agencies`: list with status tag + model counts,
  create form (slug/name/status, zod-validated, duplicate-slug handled),
  detail with models table and a status-change form in the sidebar.
- `apps/ops/src/app/console/models`: list filterable by `?agencyId=`, create
  form with archetype dropdown and comma-separated hard-rules / soft-prefs
  parsed to JSON arrays, detail with accounts table, voice/tone card, and a
  placeholder card referencing feature 2 for Drive ingest.
- `apps/ops/src/app/console/devices`: list with bound-account counts, create
  + edit forms with label uniqueness handling, detail page lists bound
  accounts with their statuses.
- `apps/ops/src/app/console/accounts`: list filterable by status + agency,
  create form requiring model + handle + status + device (per spec — device
  binding is mandatory), detail page with:
  - status chip + follower count in header
  - recent posts card (feature 3 placeholder)
  - camp membership card (later-phase placeholder)
  - followers-over-time card (cron-dependent placeholder)
  - status history table reading `StatusTransition` with actor + reason
  - change-status form that only lists valid next states per
    `StateMachines.ACCOUNT_STATUS_TRANSITIONS[currentStatus]`
  - device-rebind form
- `apps/ops/src/lib/status-hues.ts`: hue map from every status enum to the
  shared OKLCH rainbow palette — list views and detail headers stay visually
  consistent.

VA-readiness notes for later phases:
- All writes go through zod-validated server actions that call
  `requireUser()`, so flipping role gating on at the middleware level is a
  one-file change.
- Status transitions always run through the state machine + audit service,
  including founder clicks — no parallel "trusted" write path to rip out.
- Soft-delete (`deletedAt`) honored on agency / model / account reads.

No schema migration needed for feature 1 — every table and field we touched
already exists from the Phase 0 Prisma scaffold.

## Unreleased — Phase 0 scaffold (2026-04-18)

- Initial monorepo scaffold: pnpm workspaces + Turborepo
- Stack decision documented in `/docs/stack.md` and `/docs/adr/0001-stack-choice.md`
- `@xcrm/db`: Prisma schema covering §1.1 through §1.9 and §4 job runs
- `@xcrm/shared`: enum validators, state machines (account / post / reply / repost), prompt templates, constants
- `@xcrm/ui`: Tailwind preset + shadcn-style `Button` / `Card` primitives
- `@xcrm/jobs`: BullMQ queue registry + recurring schedule for all §4 jobs (handlers no-op in Phase 0)
- `@xcrm/ops`: Next.js 14 app with credentials auth, nav shells for Founder/Partner console and VA execution UI, role-gated middleware
- `@xcrm/portal`: Next.js 14 app with magic-link-based session (link send is Phase-0-stubbed — no email yet), nav shell for all §3.2 routes
- GitHub Actions CI: format, lint, typecheck, test, build
- Railway per-service configs (ops, portal, worker)

Phase 0 deliverable expected by spec: "operator can log in as founder, partner, VA — each sees their empty nav. Deployment works. No features yet."
