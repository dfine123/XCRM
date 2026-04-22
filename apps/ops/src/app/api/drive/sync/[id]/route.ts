import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@xcrm/db';
import { revalidatePath } from 'next/cache';
import { runDriveSync } from '@/lib/drive-sync';

/**
 * POST /api/drive/sync/[id]
 *
 * Runs a Drive sync synchronously for the given DriveSource and returns the
 * result. Ingest is awaited (fast, DB-only). Auto-tagging is kicked off in
 * the background and is not awaited — expect the response in ~1-2s.
 *
 * Auth: requires an ops session (FOUNDER | PARTNER). Returns 401 otherwise.
 */
export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const role = session.user.role;
  if (role !== 'FOUNDER' && role !== 'PARTNER') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const sourceId = params.id;
  if (!sourceId) {
    return NextResponse.json({ error: 'missing source id' }, { status: 400 });
  }

  const source = await prisma.driveSource.findUnique({
    where: { id: sourceId },
    select: { modelId: true, isActive: true, deletedAt: true },
  });
  if (!source || !source.isActive || source.deletedAt) {
    return NextResponse.json({ error: 'source not found' }, { status: 404 });
  }

  const result = await runDriveSync(sourceId, {
    triggeredByUserId: session.user.id,
  });

  revalidatePath(`/console/models/${source.modelId}`);

  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
