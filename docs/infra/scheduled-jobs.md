# Scheduled jobs — current approach

_Last updated: 2026-04-22 (Phase 0)._

## TL;DR

Drive sync runs **in-process inside the ops Next.js app**, not in a separate
worker service. Manual syncs are triggered by the "Sync now" button (which
POSTs `/api/drive/sync/[id]`); scheduled syncs are driven by an in-process
`node-cron` registered at server startup via Next.js's `instrumentation.ts`
hook. No Redis, no BullMQ, no worker container.

Why: at Phase-0 volumes (≈3 accounts) the throughput is tiny, and a
separate worker service on Railway costs money + adds a moving part. The
inline path is ~200 LOC and measurably simpler to operate. When we hit
~20+ accounts the BullMQ scaffolding in `packages/jobs/` is still there,
ready to reactivate — see the header of `packages/jobs/src/index.ts` for
the migration recipe.

## How it's wired

| Piece | File | Notes |
|---|---|---|
| Inline sync | `apps/ops/src/lib/drive-sync.ts` | `runDriveSync(id)` — awaited, 60s timeout on ingest |
| Inline tagger | `apps/ops/src/lib/asset-tagger.ts` | `tagAssetInline(id)` — fire-and-forget from `runDriveSync` |
| HTTP entrypoint | `apps/ops/src/app/api/drive/sync/[id]/route.ts` | Called by the "Sync now" button |
| Cron registration | `apps/ops/src/instrumentation.ts` → `apps/ops/src/lib/scheduler.ts` | Uses `node-cron` |
| Fan-out | `runScheduledDriveSyncs()` in `drive-sync.ts` | Iterates active `DriveSource`s sequentially |

### Why `node-cron` (not Railway cron / external cron)

1. **Simplicity.** `instrumentation.ts` is the official Next.js bootstrap
   hook. Cron lives in the same process as the HTTP server — one service,
   one config, one deploy.
2. **No extra Railway service.** The user's infra is already at
   capacity goals for Phase 0 (ops + portal + Postgres + Redis). Railway's
   built-in cron would add another service.
3. **Co-located logging.** The cron's tick logs show up in the ops service
   Deploy Logs alongside request logs, no log federation needed.

### Tradeoffs we accepted

- **Not horizontally safe by default.** If ops is scaled to >1 replica
  with `DRIVE_SYNC_SCHEDULE_ENABLED=true` on each, every replica ticks
  independently and a sync may fire multiple times. Mitigation: enable
  the schedule on exactly ONE replica (see below). A future hardening is
  a Postgres advisory lock in the scheduler tick — cheap to add when we
  actually scale.
- **If the process crashes mid-tick, background tagging dies with it.**
  Next sync picks up stranded `tagStatus=PENDING` assets on the next pass
  because the sync scans the folder again, finds them via the composite
  dedupe key, and checksum comparison keeps them flagged correctly. In
  practice Railway restarts are rare.
- **60s wall-clock cap on ingest.** A first-time connect against a 500-
  file folder will time out. For Phase 0 folder sizes this isn't real.
  When it becomes one, we migrate to `@xcrm/jobs`.

## Environment variables

Set on the ops Railway service:

```
# Turns the in-process scheduler on. Default off so local dev doesn't
# thrash against Drive. Set to "true" on exactly ONE ops replica.
DRIVE_SYNC_SCHEDULE_ENABLED=true

# Optional — defaults to every 15 minutes.
DRIVE_SYNC_POLL_CRON=*/15 * * * *

# Service-account JSON, base64-encoded (already configured for Feature 2)
GOOGLE_SERVICE_ACCOUNT_JSON=...

# Claude API (already configured)
ANTHROPIC_API_KEY=...
```

## Manual sync (UI)

Operator clicks "Sync now" on the model detail page → browser POSTs
`/api/drive/sync/<sourceId>`. The route awaits ingest (typically <2s for
small folders, capped at 60s), returns a JSON summary, and the button
surfaces "Synced N new files" or the error.

Tagging happens in the background in the same Node process — the browser
response doesn't wait for it. The operator sees new assets on page
refresh as `tagStatus=PENDING`, and the tags fill in over the next
30s-5min as Claude calls complete.

## Observability

Every tick + every sync logs structured lines prefixed with tags so they
grep cleanly in Deploy Logs:

```
[scheduler] drive-sync cron registered with expression "*/15 * * * *"
[drive-sync:cron] fan-out for 2 active sources
[drive-sync] start sourceId=cxyz... folderName="primary folder"
[drive-sync] done sourceId=cxyz... seen=42 ingested=3 skipped=39 tagging=3
[tag-asset] failed assetId=cabc... Unauthorized
[scheduler] tick done — 2 source(s) in 1834ms
```

Failures also materialize in the database:
- `DriveSync.status=FAILED` + `DriveSync.error` (per-run)
- `DriveSource.lastSyncStatus=FAILED` (cached on the source row; drives
  the red pill in the content-sources table)
- `ContentAsset.tagStatus=FAILED` (per-asset tagging failure)

## Migration back to a worker service (when needed)

Trigger: 20+ accounts or the inline 60s ingest cap starts hitting real
folders.

Steps (per header comment in `packages/jobs/src/index.ts`):

1. Deploy a worker service on Railway running `pnpm --filter @xcrm/jobs start`.
2. Swap the ops imports of `@/lib/drive-sync` / `@/lib/asset-tagger` back
   to `enqueueDriveSync` / `enqueueAssetAutoTag` from `@xcrm/jobs`.
3. Set `DRIVE_SYNC_SCHEDULE_ENABLED=false` on ops (or delete
   `instrumentation.ts` + `lib/scheduler.ts`).
4. Call `registerRecurringJobs()` from the worker entrypoint so the
   fan-out cron lives in the queue instead of in-process.
