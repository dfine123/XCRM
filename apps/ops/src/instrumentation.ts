/**
 * Next.js instrumentation hook — runs once per server process at startup.
 * Two jobs:
 *   - Validate GOOGLE_SERVICE_ACCOUNT_JSON shape (logs a clear error if
 *     it's missing or unparseable, logs client_email prefix on success).
 *   - If DRIVE_SYNC_SCHEDULE_ENABLED=true, register the in-process
 *     node-cron that ticks POST /api/drive/sync/cron every N minutes.
 *
 * See /docs/infra/scheduled-jobs.md for the scheduler contract.
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
 *   - Same reason we can't import @xcrm/drive-adapter for env validation —
 *     it transitively drags in googleapis, which blows up the edge bundle.
 *     The service-account parse below is therefore duplicated from
 *     packages/drive-adapter/src/auth.ts. Kept intentionally minimal
 *     (plain-JSON-then-base64-fallback); the full parser with PEM sanity
 *     checks is what getDriveClient() uses at runtime.
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

  validateServiceAccountEnvInline();

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

/**
 * Minimal parse-only check of GOOGLE_SERVICE_ACCOUNT_JSON. Kept in-file
 * (not imported from @xcrm/drive-adapter) because that package drags in
 * Node-only modules that break the edge-runtime bundle. The authoritative
 * parser with PEM-shape checks lives at
 * packages/drive-adapter/src/auth.ts and runs the first time getDriveClient
 * is called.
 */
function validateServiceAccountEnvInline(): void {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw || raw.trim() === '') {
    console.error(
      '[instrumentation] GOOGLE_SERVICE_ACCOUNT_JSON is not set. Drive sync will fail until this is configured.',
    );
    return;
  }

  const trimmed = raw.trim();
  let creds: unknown = null;
  let via: 'plain' | 'base64' | null = null;
  let plainErr = '';
  try {
    creds = JSON.parse(trimmed);
    via = 'plain';
  } catch (e) {
    plainErr = e instanceof Error ? e.message : String(e);
    try {
      creds = JSON.parse(Buffer.from(trimmed, 'base64').toString('utf8'));
      via = 'base64';
    } catch (e2) {
      const b64Err = e2 instanceof Error ? e2.message : String(e2);
      console.error(
        `[instrumentation] GOOGLE_SERVICE_ACCOUNT_JSON is unparseable (plain: "${plainErr}"; base64→JSON: "${b64Err}"). Paste the service-account JSON as one minified line.`,
      );
      return;
    }
  }

  if (!creds || typeof creds !== 'object') {
    console.error(
      '[instrumentation] GOOGLE_SERVICE_ACCOUNT_JSON parsed to a non-object value.',
    );
    return;
  }
  const email = (creds as Record<string, unknown>).client_email;
  if (typeof email !== 'string' || !email) {
    console.error(
      '[instrumentation] GOOGLE_SERVICE_ACCOUNT_JSON is missing client_email.',
    );
    return;
  }
  const prefix = email.slice(0, 20);
  console.log(
    `[instrumentation] GOOGLE_SERVICE_ACCOUNT_JSON ok (${via}) — client_email starts with "${prefix}…" (length ${email.length})`,
  );
  if (via === 'base64') {
    console.log(
      '[instrumentation] env is base64-encoded (legacy). Plain JSON is the canonical format going forward.',
    );
  }
}
