# Changelog

Per spec §9 step 8 — every shipped feature logged here.

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
