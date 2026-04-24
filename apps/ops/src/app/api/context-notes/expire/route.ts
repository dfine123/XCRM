import { NextResponse } from 'next/server';
import { prisma, ContextNoteStatus } from '@xcrm/db';

/**
 * POST /api/context-notes/expire
 *
 * Recurring job: flip ACTIVE notes whose effectiveUntil has passed to
 * EXPIRED. Called by the in-process node-cron in instrumentation.ts on
 * a 10-minute cadence and also safe to curl manually for smoke tests.
 *
 * Auth: shared CRON_SECRET in the `x-cron-secret` header. Same
 * contract as /api/drive/sync/cron.
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

  const now = new Date();
  try {
    const res = await prisma.contextNote.updateMany({
      where: {
        status: ContextNoteStatus.ACTIVE,
        effectiveUntil: { not: null, lte: now },
      },
      data: { status: ContextNoteStatus.EXPIRED },
    });
    if (res.count > 0) {
      console.log(`[context-notes:expire] expired ${res.count} note(s)`);
    }
    return NextResponse.json({ ok: true, expired: res.count });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[context-notes:expire] unhandled:', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
