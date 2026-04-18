# XCRM

X (Twitter) account management platform for OnlyFans agencies.
Working product name: **camp** (placeholder — see `PRODUCT_NAME` in `@xcrm/shared/constants`).

> **Status:** Phase 0 scaffold. Two apps, one DB, shared types — no feature code yet.
> See `/docs/stack.md` and ADR 0001 for the stack decision (awaiting operator sign-off).

## Repo layout

```
apps/
  ops/        internal app — founder, partner, VAs
  portal/     agency client app — read-mostly
packages/
  db/         Prisma schema + client (source of truth for data model)
  shared/     shared types, validators, state machines, prompt templates
  ui/         Tailwind + shadcn/ui primitives
  jobs/       BullMQ queues + worker
infra/
  railway/    per-service Railway configs
  env/        env templates
docs/         spec, ADRs, runbooks, reality-delta
```

## Quick start

Requires Node 20.11+, pnpm 9, local Postgres 16, local Redis 7.

```bash
pnpm install
cp infra/env/.env.example apps/ops/.env
cp infra/env/.env.example apps/portal/.env
cp infra/env/.env.example packages/jobs/.env

pnpm --filter @xcrm/db generate
pnpm --filter @xcrm/db migrate:dev --name init

pnpm dev
# ops:    http://localhost:3000
# portal: http://localhost:3001
```

## Commands

| Command | What |
|---|---|
| `pnpm dev` | Run every app + worker in watch mode |
| `pnpm build` | Turbo build all packages + apps |
| `pnpm lint` | ESLint across workspace |
| `pnpm typecheck` | tsc --noEmit across workspace |
| `pnpm test` | Vitest across workspace |
| `pnpm db:migrate` | Apply migrations (prod/CI) |
| `pnpm db:studio` | Prisma Studio |

## Ground rules (from `/docs` build spec §0.3)

1. Prisma schema is the source of truth.
2. Every entity has soft-delete (`deletedAt`). Never hard-delete.
3. No direct DB access from route handlers — go through a service layer.
4. ContentFormula is versioned, never mutated.
5. No fake-data mocks in committed code behind feature flags. Feature-flag off instead.
6. Small PRs. Phase 0 is a floor, not a ceiling.
7. Document non-obvious decisions in `/docs/adr`.
