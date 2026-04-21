'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma, AccountStatus } from '@xcrm/db';
import { StateMachines } from '@xcrm/shared';
import { requireUser } from '@/lib/session';
import { transitionAccountStatus } from '@/services/account-status';

const handleSchema = z
  .string()
  .min(1)
  .max(32)
  .regex(/^[A-Za-z0-9_]+$/, 'Handle may only contain letters, numbers, underscores.');

const createSchema = z.object({
  modelId: z.string().min(1, 'Model is required.'),
  handle: handleSchema,
  status: z.nativeEnum(AccountStatus),
  phoneDeviceId: z.string().min(1, 'Phone device is required.'),
  followerCount: z.coerce.number().int().min(0).default(0),
});

export type AccountFormState = { error?: string } | null;

export async function createAccount(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  await requireUser();
  const parsed = createSchema.safeParse({
    modelId: formData.get('modelId'),
    handle: String(formData.get('handle') ?? '').replace(/^@/, ''),
    status: formData.get('status'),
    phoneDeviceId: formData.get('phoneDeviceId'),
    followerCount: formData.get('followerCount') || 0,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join('; ') };
  }

  const [model, device] = await Promise.all([
    prisma.model.findFirst({
      where: { id: parsed.data.modelId, deletedAt: null },
      select: { id: true },
    }),
    prisma.phoneDevice.findUnique({
      where: { id: parsed.data.phoneDeviceId },
      select: { id: true },
    }),
  ]);
  if (!model) return { error: 'Selected model does not exist.' };
  if (!device) return { error: 'Selected phone device does not exist.' };

  let accountId: string;
  try {
    const created = await prisma.account.create({
      data: {
        modelId: parsed.data.modelId,
        handle: parsed.data.handle,
        status: parsed.data.status,
        phoneDeviceId: parsed.data.phoneDeviceId,
        followerCount: parsed.data.followerCount,
      },
      select: { id: true },
    });
    accountId = created.id;
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && (e as { code?: string }).code === 'P2002') {
      return { error: 'That handle is already taken.' };
    }
    throw e;
  }

  revalidatePath('/console/accounts');
  revalidatePath(`/console/models/${parsed.data.modelId}`);
  redirect(`/console/accounts/${accountId}`);
}

const changeStatusSchema = z.object({
  id: z.string().min(1),
  toStatus: z.nativeEnum(AccountStatus),
  reason: z.string().max(500).optional(),
});

export async function changeAccountStatus(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = changeStatusSchema.safeParse({
    id: formData.get('id'),
    toStatus: formData.get('toStatus'),
    reason: formData.get('reason') || undefined,
  });
  if (!parsed.success) return;

  try {
    await transitionAccountStatus({
      accountId: parsed.data.id,
      toStatus: parsed.data.toStatus,
      actorId: user.id,
      reason: parsed.data.reason,
    });
  } catch (e: unknown) {
    if (e instanceof StateMachines.InvalidStatusTransitionError) {
      return;
    }
    throw e;
  }

  revalidatePath(`/console/accounts/${parsed.data.id}`);
  revalidatePath('/console/accounts');
}

const updateBindingSchema = z.object({
  id: z.string().min(1),
  phoneDeviceId: z.string().min(1),
});

export async function updateAccountDevice(formData: FormData): Promise<void> {
  await requireUser();
  const parsed = updateBindingSchema.safeParse({
    id: formData.get('id'),
    phoneDeviceId: formData.get('phoneDeviceId'),
  });
  if (!parsed.success) return;

  const device = await prisma.phoneDevice.findUnique({
    where: { id: parsed.data.phoneDeviceId },
    select: { id: true },
  });
  if (!device) return;

  await prisma.account.update({
    where: { id: parsed.data.id },
    data: { phoneDeviceId: parsed.data.phoneDeviceId },
  });

  revalidatePath(`/console/accounts/${parsed.data.id}`);
  revalidatePath('/console/accounts');
}
