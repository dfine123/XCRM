'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma, AgencyStatus } from '@xcrm/db';
import { requireUser } from '@/lib/session';

const slugSchema = z
  .string()
  .min(2)
  .max(40)
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, 'lowercase letters, digits, hyphens only');

const createSchema = z.object({
  name: z.string().min(2).max(80),
  slug: slugSchema,
  status: z.nativeEnum(AgencyStatus),
});

export type AgencyFormState = { error?: string } | null;

export async function createAgency(
  _prev: AgencyFormState,
  formData: FormData,
): Promise<AgencyFormState> {
  await requireUser();
  const parsed = createSchema.safeParse({
    name: formData.get('name'),
    slug: formData.get('slug'),
    status: formData.get('status'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join('; ') };
  }

  try {
    await prisma.agency.create({ data: parsed.data });
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && (e as { code?: string }).code === 'P2002') {
      return { error: 'An agency with that slug already exists.' };
    }
    throw e;
  }

  revalidatePath('/console/agencies');
  redirect('/console/agencies');
}

const updateStatusSchema = z.object({
  id: z.string().min(1),
  status: z.nativeEnum(AgencyStatus),
});

export async function updateAgencyStatus(formData: FormData): Promise<void> {
  await requireUser();
  const parsed = updateStatusSchema.safeParse({
    id: formData.get('id'),
    status: formData.get('status'),
  });
  if (!parsed.success) return;
  await prisma.agency.update({
    where: { id: parsed.data.id },
    data: { status: parsed.data.status },
  });
  revalidatePath(`/console/agencies/${parsed.data.id}`);
  revalidatePath('/console/agencies');
}
