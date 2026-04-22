import { NextResponse } from 'next/server';
import { runScheduledDriveSyncs } from '@/lib/drive-sync';

/**
 * POST /api/drive/sync/cron
 *
 * Fan-out endpoint for scheduled Drive syncs. Called from the in-process
 * node-cron registered in instrumentation.ts, and also safe to curl
 * manually for smoke tests.
 *
 * Auth: protected by a shared secret header `x-cron-secret` matching
 * CRON_SECRET. Kept server-to-server only — the UI never hits this.
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

  const started = Date.now();
  try {
    const { sourcesRun } = await runScheduledDriveSyncs();
    return NextResponse.json({
      ok: true,
      sourcesRun,
      durationMs: Date.now() - started,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[drive-sync:cron-route] unhandled:', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
