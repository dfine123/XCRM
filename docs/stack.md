# Stack Decision

**Status:** Proposed — awaiting operator sign-off
**Date:** 2026-04-18
**Owner:** Claude Code (initial scaffold)

## Constraints (from build spec §0.1)

- TypeScript end-to-end
- Postgres + Prisma ORM
- Framework with SSR **and** rich client interactivity (posting flow)
- Tailwind + Radix-based component primitives
- Background job runner compatible with Railway
- Auth that's low-friction with the chosen framework

## Choices

| Concern | Choice | Why |
|---|---|---|
| Language | TypeScript 5.x | Required by spec |
| Runtime | Node 20 LTS | Railway-supported, aligned with Next.js requirements |
| Package manager | pnpm 9 | Fast, deterministic, first-class workspace support |
| Monorepo tooling | Turborepo | Caching, `pnpm` integration, minimal config |
| Framework | Next.js 14 (App Router) | SSR + client interactivity in one model; React Server Components make the VA dashboard cheap; Railway has a first-class Next template |
| ORM | Prisma 5 | Matches operator familiarity; migration ergonomics; `@prisma/client` works in Node runtime (we avoid Edge for the ops app) |
| DB | Postgres 16 (Railway-managed) | Spec default |
| Styling | Tailwind CSS 3 + CSS vars for theming | Spec default |
| Components | shadcn/ui (Radix primitives) | Operator-owned components (copied into `/packages/ui`), not a vendored lib that locks us in |
| Validation | Zod | Shared types between client + server + prompts |
| Auth | Auth.js (NextAuth v5) | Separate configs per app — satisfies "do not share auth" rule; supports email magic-link for portal and credentials for ops VAs |
| Background jobs | BullMQ + Redis (Railway Redis addon) | Rich scheduling, delayed jobs, retries; Railway supports Redis natively |
| Cron | BullMQ repeatable jobs | No separate scheduler infra |
| Object storage | Cloudflare R2 (S3-compatible) | Spec default; lower egress than S3 |
| Email | Resend | Simple magic-link flow; DX |
| Observability | Pino + Railway logs + Sentry | Sentry wired early for both apps |
| CI | GitHub Actions | Runs lint + typecheck + test on every PR |

## Rejected alternatives

- **Remix** — strong candidate, but the team-owned React ecosystem tooling (shadcn, many job-runner examples) leans Next. No compelling reason to swap.
- **T3 stack preset** — would save a day but opinionates the auth (Clerk) and tRPC integration in ways the spec doesn't ask for.
- **Inngest instead of BullMQ** — easier DX for cron, but adds a third-party runtime dependency. BullMQ keeps jobs on infra we already rent (Railway Redis).
- **Drizzle** — newer, but migration story is less mature than Prisma. Spec explicitly allows only Prisma.
- **Clerk for auth** — single-tenant SaaS would be fine, but we need two completely separate user tables (§1.1). Auth.js gives us that for free; Clerk would need two Clerk projects + billing, unnecessary.

## Implications

- Both `/apps/ops` and `/apps/portal` are Next.js projects. They share `/packages/db`, `/packages/shared`, `/packages/ui`.
- Each app has its own `NextAuth` config, its own session cookies, its own users table. No cross-app auth leakage.
- Jobs run in a separate Railway service (`worker`) that imports `/packages/jobs`.
- Prisma migrations run via a Railway release command before each deploy.

## Open decisions that become real once we hit feature code

- Which vision model for asset auto-tagging — defaulting to Claude multimodal but abstracted behind `packages/vision-adapter`.
- Redis persistence tier on Railway (free tier is ephemeral; Phase 1 is fine on free; Phase 2 needs persistent).
- Whether portal gets its own subdomain vs path prefix (recommendation: subdomain, because separate Next app).
