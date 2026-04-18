# Phase 0 checklist

Tracks the boxes from spec §6 "Phase 0 — Foundations".

- [x] Pick stack; write `/docs/stack.md`; [ ] get operator sign-off → ADR 0001 pending approval
- [x] Scaffold monorepo structure (`/apps/ops`, `/apps/portal`, `/packages/{db,shared,ui,jobs}`, `/docs`, `/infra`)
- [ ] Railway projects created (ops + portal + worker + postgres + redis) — **operator action**; configs in `/infra/railway/`
- [x] Prisma schema covers §1.1–§1.9 and §4 (job runs)
- [x] Auth wired for ops app (credentials; role-gated middleware)
- [x] Auth wired for portal app (magic link — email send stubbed, Phase 3 adds Resend)
- [x] Empty nav shells render for all three view modes (Founder/Partner console, VA queue, Agency portal)
- [x] CI runs lint + typecheck + tests on PR (`.github/workflows/ci.yml`)
- [x] First ADR written documenting stack choice (`/docs/adr/0001-stack-choice.md`)

## Remaining operator actions before Phase 1

1. Review and sign off on `/docs/stack.md` and ADR 0001.
2. Provision Railway: two Next services (ops, portal), one worker service, one Postgres, one Redis. Point each service at its `infra/railway/*.railway.json`.
3. Seed first users (founder, partner, one VA) — seed script lands in early Phase 1.
4. Resolve the "Before Phase 1" questions in `/docs/open-decisions.md`.
