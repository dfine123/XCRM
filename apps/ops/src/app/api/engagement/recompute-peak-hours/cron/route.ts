import { NextResponse } from 'next/server';
import { recomputePeakHoursForEligibleAccounts } from '@/services/recompute-peak-hours';

/**
 * POST /api/engagement/recompute-peak-hours/cron
 *
 * Periodic recompute of `Account.peakHours` from the latest
 * engagement snapshots. Runs under the same `CRON_SECRET` contract as
 * the other crons. Quiet by design — only logs on update.
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
    const summary = await recomputePeakHoursForEligibleAccounts();
    if (summary.accountsUpdated > 0) {
      console.log(
        `[engagement:peak-hours] scanned=${summary.accountsScanned} updated=${summary.accountsUpdated} skipped=${summary.accountsSkipped} in ${Date.now() - started}ms`,
      );
    }
    return NextResponse.json({
      ok: true,
      durationMs: Date.now() - started,
      ...summary,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[engagement:peak-hours] unhandled:', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
