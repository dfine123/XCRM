# ADR 0001: Stack Choice

**Status:** Proposed
**Date:** 2026-04-18
**Deciders:** Founder, Partner, Claude Code
**Supersedes:** —

## Context

The build spec (§0.1) sets hard constraints but leaves the specific stack to the first-task decision: framework, job runner, auth, component library, deployment shape. Two apps, one DB, shared types.

## Decision

Adopt the stack documented in `/docs/stack.md`:

- **Monorepo:** pnpm workspaces + Turborepo
- **Apps:** Next.js 14 App Router (`/apps/ops`, `/apps/portal`)
- **DB:** Postgres 16 + Prisma 5 (`/packages/db`)
- **Jobs:** BullMQ + Redis (`/packages/jobs`, worker service)
- **Auth:** Auth.js v5 — separate configs per app, separate user tables
- **UI:** Tailwind + shadcn/ui primitives in `/packages/ui`
- **Validation:** Zod in `/packages/shared`
- **Storage:** Cloudflare R2 (S3-compatible client)
- **Email:** Resend
- **Deploy:** Railway (ops service, portal service, worker service, postgres, redis)
- **CI:** GitHub Actions

## Consequences

**Positive**
- Spec-compliant: two apps, one DB, shared types, no shared auth.
- Common React ecosystem — hiring and community resources are easy.
- Prisma + Postgres lets the schema be the single source of truth.
- Turborepo caches typecheck/lint across packages and CI.
- BullMQ makes the cron table in §4 straightforward to implement with repeatable jobs.

**Negative**
- Two Next apps means two deploy targets, two bundle budgets, two sets of dependencies to keep in sync. Mitigated by shared packages.
- Auth.js v5 is still new-ish; we'll pin a specific release.
- BullMQ requires Redis with persistence in production — Railway free tier won't do past Phase 1.

**Neutral**
- Node-runtime-only for DB access. We won't chase Edge for ops routes; not worth the Prisma limitations.

## Alternatives considered

See `/docs/stack.md` §"Rejected alternatives".

## Sign-off

- [ ] Founder
- [ ] Partner
