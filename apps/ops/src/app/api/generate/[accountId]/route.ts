import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { prisma } from '@xcrm/db';
import { generateDraftForAccount } from '@/services/generate-draft';

/**
 * POST /api/generate/[accountId]
 *
 * Manual draft trigger, called from the "Generate draft" button on
 * model detail. Runs the same orchestrator the cron uses. Session-
 * auth'd (FOUNDER | PARTNER) and bypasses GENERATE_ENABLED — manual
 * triggers are deliberate and should always work.
 *
 * Returns the generator's outcome as JSON so the UI can show
 * "created draft / no slot / skipped / error" inline.
 */
export async function POST(
  _req: Request,
  { params }: { params: { accountId: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const role = session.user.role;
  if (role !== 'FOUNDER' && role !== 'PARTNER') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const accountId = params.accountId;
  if (!accountId) {
    return NextResponse.json({ error: 'missing accountId' }, { status: 400 });
  }

  // Load the account's modelId up front so we can revalidate the
  // right paths regardless of the outcome.
  const account = await prisma.account.findFirst({
    where: { id: accountId, deletedAt: null },
    select: { modelId: true },
  });
  if (!account) {
    return NextResponse.json({ error: 'account not found' }, { status: 404 });
  }

  const outcome = await generateDraftForAccount(accountId, {
    triggeredByUserId: session.user.id,
  });

  revalidatePath(`/console/models/${account.modelId}`);
  revalidatePath('/console');

  return NextResponse.json(
    { accountId, outcome },
    { status: outcome.kind === 'LLM_ERROR' ? 502 : 200 },
  );
}
