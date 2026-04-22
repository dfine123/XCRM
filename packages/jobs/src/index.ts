/**
 * @xcrm/jobs — NOT CURRENTLY IN USE.
 *
 * Drive sync + asset tagging were moved inline into the ops app
 * (apps/ops/src/lib/drive-sync.ts, apps/ops/src/lib/asset-tagger.ts) to
 * avoid running a separate Railway worker service for the Phase-0 volumes
 * (3-ish accounts). This package is retained intact so we can migrate back
 * to a real BullMQ worker once scale justifies it (~20+ accounts, multiple
 * camps polling simultaneously, etc.).
 *
 * When re-adopting:
 *   1. Re-add a `worker` service on Railway running `pnpm --filter @xcrm/jobs start`.
 *   2. Swap apps/ops imports of `@/lib/drive-sync` and `@/lib/asset-tagger`
 *      back to `enqueueDriveSync` / `enqueueAssetAutoTag` from this package.
 *   3. Delete apps/ops/src/instrumentation.ts + scheduler.ts (node-cron).
 *   4. Restore `registerRecurringJobs()` in the worker entry.
 *
 * The handlers in ./handlers/*.ts mirror the inline versions 1:1 — keep
 * them in sync if you change sync/tag behavior.
 */

export { QUEUE_NAMES, queues, connection, type QueueName } from './queues';
export { RECURRING_JOBS, registerRecurringJobs } from './schedule';
export { enqueueDriveSync, enqueueAssetAutoTag } from './enqueue';
