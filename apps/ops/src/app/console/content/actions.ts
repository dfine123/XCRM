'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@xcrm/db';
import { requireUser } from '@/lib/session';

export type ContentActionState = { error?: string } | null;

const softDeleteSchema = z.object({
  id: z.string().min(1),
  reason: z.string().max(500).optional(),
});

export async function softDeleteAsset(
  _prev: ContentActionState,
  formData: FormData,
): Promise<ContentActionState> {
  const user = await requireUser();
  const parsed = softDeleteSchema.safeParse({
    id: formData.get('id'),
    reason: (formData.get('reason') as string | null) ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join('; ') };
  }

  const asset = await prisma.contentAsset.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, modelId: true, deletedAt: true },
  });
  if (!asset) return { error: 'Asset not found.' };
  if (asset.deletedAt) return { error: 'Asset is already deleted.' };

  await prisma.$transaction([
    prisma.contentAsset.update({
      where: { id: asset.id },
      data: { deletedAt: new Date() },
    }),
    prisma.assetAuditEvent.create({
      data: {
        assetId: asset.id,
        actorId: user.id,
        kind: 'DELETE',
        payload: parsed.data.reason ? { reason: parsed.data.reason } : {},
      },
    }),
  ]);

  revalidatePath(`/console/content/${asset.id}`);
  revalidatePath(`/console/content`);
  revalidatePath(`/console/models/${asset.modelId}`);
  return null;
}

const idSchema = z.object({ id: z.string().min(1) });

export async function restoreAsset(
  _prev: ContentActionState,
  formData: FormData,
): Promise<ContentActionState> {
  const user = await requireUser();
  const parsed = idSchema.safeParse({ id: formData.get('id') });
  if (!parsed.success) return { error: 'Invalid asset id.' };

  const asset = await prisma.contentAsset.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, modelId: true, deletedAt: true },
  });
  if (!asset) return { error: 'Asset not found.' };
  if (!asset.deletedAt) return { error: 'Asset is not deleted.' };

  await prisma.$transaction([
    prisma.contentAsset.update({
      where: { id: asset.id },
      data: { deletedAt: null },
    }),
    prisma.assetAuditEvent.create({
      data: {
        assetId: asset.id,
        actorId: user.id,
        kind: 'RESTORE',
        payload: {},
      },
    }),
  ]);

  revalidatePath(`/console/content/${asset.id}`);
  revalidatePath(`/console/content`);
  revalidatePath(`/console/models/${asset.modelId}`);
  return null;
}

const updateTagsSchema = z.object({
  id: z.string().min(1),
  // Comma-separated, trimmed, de-duplicated, lowercased. Keep it simple —
  // the tag taxonomy can tighten in a later feature.
  tagsRaw: z.string().max(1000),
});

export async function updateManualTags(
  _prev: ContentActionState,
  formData: FormData,
): Promise<ContentActionState> {
  const user = await requireUser();
  const parsed = updateTagsSchema.safeParse({
    id: formData.get('id'),
    tagsRaw: String(formData.get('tags') ?? ''),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join('; ') };
  }

  const next = Array.from(
    new Set(
      parsed.data.tagsRaw
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length > 0 && t.length <= 40),
    ),
  ).slice(0, 32);

  const asset = await prisma.contentAsset.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, modelId: true, manualTags: true, deletedAt: true },
  });
  if (!asset) return { error: 'Asset not found.' };
  if (asset.deletedAt) return { error: 'Cannot edit a deleted asset.' };

  const before = [...asset.manualTags].sort();
  const after = [...next].sort();
  const unchanged =
    before.length === after.length && before.every((t, i) => t === after[i]);
  if (unchanged) return null;

  await prisma.$transaction([
    prisma.contentAsset.update({
      where: { id: asset.id },
      data: { manualTags: next },
    }),
    prisma.assetAuditEvent.create({
      data: {
        assetId: asset.id,
        actorId: user.id,
        kind: 'MANUAL_TAG_EDIT',
        payload: { before, after },
      },
    }),
  ]);

  revalidatePath(`/console/content/${asset.id}`);
  revalidatePath(`/console/content`);
  revalidatePath(`/console/models/${asset.modelId}`);
  return null;
}
