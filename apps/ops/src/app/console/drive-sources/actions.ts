'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma, DriveSourceStatus } from '@xcrm/db';
import { requireUser } from '@/lib/session';
import { runDriveSync } from '@/lib/drive-sync';

const connectSchema = z.object({
  modelId: z.string().min(1),
  folderId: z
    .string()
    .min(10, 'Folder IDs are typically 20+ chars. Paste the ID from the folder URL.')
    .max(200),
  folderName: z.string().min(1).max(120),
});

export type DriveSourceFormState = { error?: string } | null;

/**
 * Connect a Drive folder to a model — or reconnect one that was previously
 * disconnected. Reconnect preserves the existing DriveSource row (and all
 * its history: DriveSync rows, ContentAssets) by flipping
 * `status: DISCONNECTED → ACTIVE`.
 *
 * Returned as a named export so the onboard step-4 action can reuse it
 * without duplicating the pre-check / reactivation logic.
 */
export async function upsertDriveSource(input: {
  modelId: string;
  folderId: string;
  folderName: string;
  userId: string;
}): Promise<{ sourceId: string; reactivated: boolean }> {
  const existing = await prisma.driveSource.findUnique({
    where: { modelId_folderId: { modelId: input.modelId, folderId: input.folderId } },
    select: { id: true, status: true },
  });

  if (existing) {
    if (existing.status === DriveSourceStatus.ACTIVE) {
      throw new Error('That folder is already connected to this model.');
    }
    await prisma.driveSource.update({
      where: { id: existing.id },
      data: {
        status: DriveSourceStatus.ACTIVE,
        disconnectedAt: null,
        folderName: input.folderName,
      },
    });
    return { sourceId: existing.id, reactivated: true };
  }

  const created = await prisma.driveSource.create({
    data: {
      modelId: input.modelId,
      folderId: input.folderId,
      folderName: input.folderName,
      createdByUserId: input.userId,
    },
    select: { id: true },
  });
  return { sourceId: created.id, reactivated: false };
}

export async function connectDriveSource(
  _prev: DriveSourceFormState,
  formData: FormData,
): Promise<DriveSourceFormState> {
  const user = await requireUser();
  const parsed = connectSchema.safeParse({
    modelId: formData.get('modelId'),
    folderId: String(formData.get('folderId') ?? '').trim(),
    folderName: String(formData.get('folderName') ?? '').trim(),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join('; ') };
  }

  const model = await prisma.model.findFirst({
    where: { id: parsed.data.modelId, deletedAt: null },
    select: { id: true },
  });
  if (!model) return { error: 'Model not found.' };

  let sourceId: string;
  try {
    const res = await upsertDriveSource({ ...parsed.data, userId: user.id });
    sourceId = res.sourceId;
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to connect.' };
  }

  // Kick off an initial sync inline. Best-effort — if it fails we still
  // return success and the operator can hit "Sync now" to retry.
  try {
    await runDriveSync(sourceId, { triggeredByUserId: user.id });
  } catch (err) {
    console.error(
      `[drive-sources] initial sync after connect failed:`,
      err instanceof Error ? err.message : String(err),
    );
  }

  revalidatePath(`/console/models/${parsed.data.modelId}`);
  return null;
}

const idSchema = z.object({ id: z.string().min(1) });

/**
 * Disconnect a Drive folder. Row persists (status=DISCONNECTED) so
 * ContentAssets + DriveSync history stay queryable. Reconnecting the same
 * folder reactivates this row — see {@link upsertDriveSource}.
 */
export async function disconnectDriveSource(formData: FormData): Promise<void> {
  await requireUser();
  const parsed = idSchema.safeParse({ id: formData.get('id') });
  if (!parsed.success) return;

  const source = await prisma.driveSource.findUnique({
    where: { id: parsed.data.id },
    select: { modelId: true, status: true },
  });
  if (!source || source.status === DriveSourceStatus.DISCONNECTED) return;

  await prisma.driveSource.update({
    where: { id: parsed.data.id },
    data: { status: DriveSourceStatus.DISCONNECTED, disconnectedAt: new Date() },
  });

  revalidatePath(`/console/models/${source.modelId}`);
}
