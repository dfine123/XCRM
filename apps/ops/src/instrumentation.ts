/**
 * Next.js instrumentation hook — runs once per server process at startup.
 * Registers an in-process node-cron that ticks the scheduled Drive sync
 * endpoint every N minutes.
 *
 * Opt-in via DRIVE_SYNC_SCHEDULE_ENABLED=true. On Railway, set that
 * variable on exactly ONE ops replica to avoid duplicate runs when
 * horizontally scaled. See /docs/infra/scheduled-jobs.md.
 *
 * Why everything is crammed into this one file:
 *   - Next.js 14 compiles instrumentation.ts for BOTH edge + Node runtimes.
 *   - node-cron pulls in 'path' / 'child_process' which don't exist on the
 *     edge runtime. Bundling blows up unless we hide the dep from webpack.
 *   - The `webpackIgnore` comment keeps the node-cron import as a native
 *     dynamic import, resolved at runtime by Node from node_modules. All
 *     cron logic must therefore live inside the guarded branch below — if
 *     it lived in a sibling module, webpackIgnore on THAT import would also
 *     leave the path unresolvable at runtime (.next/server has no src tree).
 *   - This file itself only imports node:* via the runtime dynamic import,
 *     so edge bundling produces a harmless no-op.
 *
 * The cron tick loops back through the app's own HTTP API
 * (POST /api/drive/sync/cron) rather than importing the sync library
 * directly. That keeps this file free of @xcrm/drive-adapter / @xcrm/ai
 * imports, which transitively drag in Node-only modules (googleapis, etc.)
 * that blow up the edge bundle.
 */

let registered = false;

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.DRIVE_SYNC_SCHEDULE_ENABLED !== 'true') {
    console.log('[instrumentation] DRIVE_SYNC_SCHEDULE_ENABLED != true — skipping cron.');
    return;
  }
  if (registered) {
    console.log('[instrumentation] cron already registered — skipping.');
    return;
  }

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[instrumentation] CRON_SECRET not set — cron NOT started.');
    return;
  }

  const expr = process.env.DRIVE_SYNC_POLL_CRON || '*/15 * * * *';
  const baseUrl =
    process.env.OPS_INTERNAL_URL || `http://127.0.0.1:${process.env.PORT || 3000}`;
  const target = `${baseUrl}/api/drive/sync/cron`;

  type CronLib = {
    validate: (s: string) => boolean;
    schedule: (s: string, cb: () => void | Promise<void>) => unknown;
  };
  const cronMod = (await import(/* webpackIgnore: true */ 'node-cron')) as
    | CronLib
    | { default: CronLib };
  const cron: CronLib = 'default' in cronMod ? cronMod.default : cronMod;

  if (!cron.validate(expr)) {
    console.error(
      `[instrumentation] invalid DRIVE_SYNC_POLL_CRON "${expr}" — cron NOT started.`,
    );
    return;
  }

  let running = false;
  cron.schedule(expr, async () => {
    if (running) {
      console.log('[scheduler] tick skipped — previous run still in flight');
      return;
    }
    running = true;
    const started = Date.now();
    try {
      const res = await fetch(target, {
        method: 'POST',
        headers: { 'x-cron-secret': secret },
      });
      const body = (await res.json().catch(() => ({}))) as {
        sourcesRun?: number;
        error?: string;
      };
      if (!res.ok) {
        console.error(
          `[scheduler] tick HTTP ${res.status} in ${Date.now() - started}ms:`,
          body.error ?? '(no body)',
        );
      } else {
        console.log(
          `[scheduler] tick ok — sourcesRun=${body.sourcesRun ?? 0} in ${Date.now() - started}ms`,
        );
      }
    } catch (err) {
      console.error(
        '[scheduler] tick fetch failed:',
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      running = false;
    }
  });

  registered = true;
  console.log(
    `[instrumentation] drive-sync cron registered with expression "${expr}" → ${target}`,
  );
}
