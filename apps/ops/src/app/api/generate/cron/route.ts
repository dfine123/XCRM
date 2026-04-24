import { NextResponse } from 'next/server';
import { runScheduledGeneration } from '@/services/generate-draft';

/**
 * POST /api/generate/cron
 *
 * Fan-out endpoint for the scheduled draft-generation run. Called by
 * the in-process node-cron in instrumentation.ts, and safe to curl
 * manually for smoke tests.
 *
 * Auth: CRON_SECRET in the `x-cron-secret` header — same contract
 * as /api/drive/sync/cron and /api/context-notes/expire.
 *
 * Separately gated by GENERATE_ENABLED so a preview deploy doesn't
 * fire an LLM call every 4h by accident. When disabled the endpoint
 * still responds 200 so the cron caller logs a benign no-op rather
 * than an error.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'CRON_SECRET not configured on this service' },
      { status: 500 },
    );
  }
  const provided = req.headers.get('x-cron-secret');
  if (provided !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  if (process.env.GENERATE_ENABLED !== 'true') {
    return NextResponse.json({
      ok: true,
      disabled: true,
      reason: 'GENERATE_ENABLED != true on this service',
    });
  }

  const started = Date.now();
  try {
    const summary = await runScheduledGeneration();
    return NextResponse.json({
      ok: true,
      durationMs: Date.now() - started,
      ...summary,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[gen:cron-route] unhandled:', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
