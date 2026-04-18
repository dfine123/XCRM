# @xcrm/db

Prisma schema, generated client, and migrations. **Source of truth for the data model** (spec §0.3 rule 2).

## Usage

```ts
import { prisma } from '@xcrm/db';

const agencies = await prisma.agency.findMany({ where: { deletedAt: null } });
```

Always filter by `deletedAt: null` for normal reads — soft delete is non-negotiable.

## Commands

- `pnpm --filter @xcrm/db generate` — regenerate client
- `pnpm --filter @xcrm/db migrate:dev` — new migration in dev
- `pnpm --filter @xcrm/db migrate` — apply migrations in CI/prod (Railway release cmd)
- `pnpm --filter @xcrm/db studio` — Prisma Studio

## Service layer rule

Route handlers must NOT import `prisma` directly (spec §0.3 rule 5). Wrap DB access in services under `/apps/*/src/services` or `/packages/db/src/services` so we can add caching, read replicas, or audit logging without touching handlers.
