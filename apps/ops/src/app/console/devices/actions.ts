'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma, PhoneDeviceStatus } from '@xcrm/db';
import { requireUser } from '@/lib/session';

const labelSchema = z.string().min(1).max(40);

const createSchema = z.object({
  label: labelSchema,
  status: z.nativeEnum(PhoneDeviceStatus),
});

export type DeviceFormState = { error?: string } | null;

export async function createDevice(
  _prev: DeviceFormState,
  formData: FormData,
): Promise<DeviceFormState> {
  await requireUser();
  const parsed = createSchema.safeParse({
    label: formData.get('label'),
    status: formData.get('status'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join('; ') };
  }
  try {
    await prisma.phoneDevice.create({ data: parsed.data });
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && (e as { code?: string }).code === 'P2002') {
      return { error: 'A device with that label already exists.' };
    }
    throw e;
  }
  revalidatePath('/console/devices');
  redirect('/console/devices');
}

const updateSchema = z.object({
  id: z.string().min(1),
  label: labelSchema,
  status: z.nativeEnum(PhoneDeviceStatus),
});

export async function updateDevice(formData: FormData): Promise<void> {
  await requireUser();
  const parsed = updateSchema.safeParse({
    id: formData.get('id'),
    label: formData.get('label'),
    status: formData.get('status'),
  });
  if (!parsed.success) return;
  await prisma.phoneDevice.update({
    where: { id: parsed.data.id },
    data: { label: parsed.data.label, status: parsed.data.status },
  });
  revalidatePath('/console/devices');
}
