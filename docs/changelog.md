# Changelog

Per spec §9 step 8 — every shipped feature logged here.

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
