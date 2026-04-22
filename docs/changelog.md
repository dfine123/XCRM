# Changelog

Per spec §9 step 8 — every shipped feature logged here.

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
