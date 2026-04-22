'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@xcrm/db';
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
    const created = await prisma.driveSource.create({
      data: {
        modelId: parsed.data.modelId,
        folderId: parsed.data.folderId,
        folderName: parsed.data.folderName,
        createdByUserId: user.id,
      },
      select: { id: true },
    });
    sourceId = created.id;
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && (e as { code?: string }).code === 'P2002') {
      return { error: 'That folder is already connected to this model.' };
    }
    throw e;
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

export async function disconnectDriveSource(formData: FormData): Promise<void> {
  await requireUser();
  const parsed = idSchema.safeParse({ id: formData.get('id') });
  if (!parsed.success) return;

  const source = await prisma.driveSource.findUnique({
    where: { id: parsed.data.id },
    select: { modelId: true, deletedAt: true },
  });
  if (!source || source.deletedAt) return;

  await prisma.driveSource.update({
    where: { id: parsed.data.id },
    data: { isActive: false, deletedAt: new Date() },
  });

  revalidatePath(`/console/models/${source.modelId}`);
}
