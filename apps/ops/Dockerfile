#
# Ops service (apps/ops) — multi-stage pnpm monorepo build.
# Build context: repo ROOT. Configure Railway Settings > Dockerfile Path
# to "apps/ops/Dockerfile".
#
# Plain Dockerfile syntax — no BuildKit-specific features (no
# --mount=type=cache / secret / bind). Railway's builder doesn't
# support those cache mounts; repeat builds re-download the pnpm
# store, which is acceptable.
#
# Layers are still ordered so that edits under src/ don't bust the
# install cache — only changes to any package.json or pnpm-lock.yaml do.

# -----------------------------------------------------------------------------
# base — shared across stages: pinned node, pnpm via corepack, OpenSSL for Prisma.
# -----------------------------------------------------------------------------
FROM node:20.19-slim AS base

ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH" \
    CI=true

# OpenSSL + ca-certificates: Prisma's debian-openssl-3.0.x engine needs libssl
# and the CA bundle at runtime. ca-certificates also covers outbound HTTPS
# (Resend, Anthropic, R2) once those are wired in later phases.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable \
    && corepack prepare pnpm@9.12.0 --activate

WORKDIR /app

# -----------------------------------------------------------------------------
# builder — install workspace deps, generate prisma client, build ops.
# -----------------------------------------------------------------------------
FROM base AS builder

# Copy manifests FIRST so the install layer caches on source edits.
# Every workspace package MUST have its manifest staged before
# `pnpm install --frozen-lockfile` — missing any one causes pnpm to
# fail resolving the workspace graph, and Railway's builder returns
# "Failed to build an image" with no visible logs.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/ops/package.json              ./apps/ops/
COPY apps/portal/package.json           ./apps/portal/
COPY packages/ai/package.json           ./packages/ai/
COPY packages/db/package.json           ./packages/db/
COPY packages/drive-adapter/package.json ./packages/drive-adapter/
COPY packages/jobs/package.json         ./packages/jobs/
COPY packages/shared/package.json       ./packages/shared/
COPY packages/ui/package.json           ./packages/ui/

# --ignore-scripts: the db package has a postinstall that runs `prisma generate`,
# but the schema file isn't copied yet. We run generate explicitly after source lands.
RUN pnpm install --frozen-lockfile --ignore-scripts

# Now the source. .dockerignore at repo root must exclude node_modules,
# .next, .turbo, and .env* so we don't clobber the installed modules.
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm --filter @xcrm/db generate \
    && pnpm --filter @xcrm/ops build

# -----------------------------------------------------------------------------
# runner — minimal runtime.
# -----------------------------------------------------------------------------
FROM base AS runner

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000

# Bring over the fully-built workspace. Larger than a standalone output,
# but deterministic and avoids Next-standalone footguns on monorepos.
# Optimize to a trimmed image in a later PR if the image size hurts.
COPY --from=builder /app ./

EXPOSE 3000

# Boot sequence: apply any pending migrations, upsert seed rows,
# then start Next. All three steps are idempotent:
#   - `prisma migrate deploy` is a no-op when fully migrated
#   - seed.ts uses upserts
#   - next start is stateless
# Shell form so && chains through the same sh -c.
# Rebuild trigger: 2026-04-21 reskin (force Railway to pick up OKLCH design).
CMD ["sh", "-c", "pnpm --filter @xcrm/db migrate:deploy && pnpm --filter @xcrm/db db:seed && pnpm --filter @xcrm/ops start"]
