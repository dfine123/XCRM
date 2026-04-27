'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma, CampStatus } from '@xcrm/db';
import { requireUser } from '@/lib/session';

export type CampFormState = { error?: string; ok?: boolean } | null;

const createSchema = z.object({
  weekOf: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date'),
});

/**
 * Create a PROPOSED camp for the given week. Operator-driven (no
 * algorithm in v1) — `createdByAlgorithm = false`.
 */
export async function createCamp(
  _prev: CampFormState,
  formData: FormData,
): Promise<CampFormState> {
  await requireUser();
  const parsed = createSchema.safeParse({
    weekOf: String(formData.get('weekOf') ?? '').trim(),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues.map((i) => i.message).join('; '),
    };
  }

  const camp = await prisma.camp.create({
    data: {
      weekOf: new Date(parsed.data.weekOf),
      status: CampStatus.PROPOSED,
      createdByAlgorithm: false,
    },
    select: { id: true },
  });

  revalidatePath('/console/camps');
  redirect(`/console/camps/${camp.id}`);
}

const idSchema = z.object({ id: z.string().min(1) });

/**
 * PROPOSED → ACTIVE. Records the operator who approved.
 * Idempotent: if the camp is already past PROPOSED, no-op.
 */
export async function activateCamp(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = idSchema.safeParse({ id: formData.get('id') });
  if (!parsed.success) return;

  const camp = await prisma.camp.findUnique({
    where: { id: parsed.data.id },
    select: { status: true },
  });
  if (!camp || camp.status !== CampStatus.PROPOSED) return;

  await prisma.camp.update({
    where: { id: parsed.data.id },
    data: {
      status: CampStatus.ACTIVE,
      approvedByUserId: user.id,
      approvedAt: new Date(),
    },
  });

  revalidatePath('/console/camps');
  revalidatePath(`/console/camps/${parsed.data.id}`);
  revalidatePath('/console');
}

/**
 * ACTIVE → COMPLETED. Idempotent. Once completed, asset-spacing
 * coordination stops applying — existing schedules aren't touched.
 */
export async function completeCamp(formData: FormData): Promise<void> {
  await requireUser();
  const parsed = idSchema.safeParse({ id: formData.get('id') });
  if (!parsed.success) return;

  const camp = await prisma.camp.findUnique({
    where: { id: parsed.data.id },
    select: { status: true },
  });
  if (!camp || camp.status !== CampStatus.ACTIVE) return;

  await prisma.camp.update({
    where: { id: parsed.data.id },
    data: { status: CampStatus.COMPLETED },
  });

  revalidatePath('/console/camps');
  revalidatePath(`/console/camps/${parsed.data.id}`);
  revalidatePath('/console');
}

const addAccountSchema = z.object({
  campId: z.string().min(1),
  handle: z
    .string()
    .min(1)
    .max(32)
    .regex(/^[A-Za-z0-9_]+$/, 'Handle may only contain letters, numbers, underscores.'),
});

/**
 * Add an account by handle (operator-friendly). Resolves to accountId
 * server-side and idempotent-upserts via the (campId, accountId)
 * composite unique.
 */
export async function addAccountToCamp(
  _prev: CampFormState,
  formData: FormData,
): Promise<CampFormState> {
  await requireUser();
  const parsed = addAccountSchema.safeParse({
    campId: formData.get('campId'),
    handle: String(formData.get('handle') ?? '').replace(/^@/, '').trim(),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues.map((i) => i.message).join('; '),
    };
  }

  const account = await prisma.account.findFirst({
    where: { handle: parsed.data.handle, deletedAt: null },
    select: { id: true },
  });
  if (!account) {
    return { error: `No active account for @${parsed.data.handle}.` };
  }

  try {
    await prisma.campMembership.create({
      data: { campId: parsed.data.campId, accountId: account.id },
    });
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && (e as { code?: string }).code === 'P2002') {
      // Already a member — treat as success.
      return { ok: true };
    }
    throw e;
  }

  revalidatePath(`/console/camps/${parsed.data.campId}`);
  revalidatePath('/console');
  return { ok: true };
}

const removeAccountSchema = z.object({
  membershipId: z.string().min(1),
});

export async function removeAccountFromCamp(formData: FormData): Promise<void> {
  await requireUser();
  const parsed = removeAccountSchema.safeParse({
    membershipId: formData.get('membershipId'),
  });
  if (!parsed.success) return;

  const membership = await prisma.campMembership.findUnique({
    where: { id: parsed.data.membershipId },
    select: { campId: true },
  });
  if (!membership) return;

  await prisma.campMembership.delete({
    where: { id: parsed.data.membershipId },
  });

  revalidatePath(`/console/camps/${membership.campId}`);
  revalidatePath('/console');
}
