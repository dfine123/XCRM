'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma, Archetype } from '@xcrm/db';
import { requireUser } from '@/lib/session';

/**
 * Parse a comma-separated list into a clean string array.
 * Users type "no crypto talk, no politics, brand-safe" — we store ["no crypto talk","no politics","brand-safe"].
 */
function splitList(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const createSchema = z.object({
  agencyId: z.string().min(1),
  displayName: z.string().min(1).max(80),
  realName: z.string().max(120).optional().default(''),
  archetype: z.nativeEnum(Archetype),
  voiceToneNotes: z.string().max(4000).optional().default(''),
  hardRules: z.array(z.string()).default([]),
  softPreferences: z.array(z.string()).default([]),
});

export type ModelFormState = { error?: string } | null;

export async function createModel(
  _prev: ModelFormState,
  formData: FormData,
): Promise<ModelFormState> {
  await requireUser();
  const parsed = createSchema.safeParse({
    agencyId: formData.get('agencyId'),
    displayName: formData.get('displayName'),
    realName: formData.get('realName') ?? '',
    archetype: formData.get('archetype'),
    voiceToneNotes: formData.get('voiceToneNotes') ?? '',
    hardRules: splitList(formData.get('hardRules') as string | null),
    softPreferences: splitList(formData.get('softPreferences') as string | null),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') };
  }

  const agency = await prisma.agency.findFirst({
    where: { id: parsed.data.agencyId, deletedAt: null },
    select: { id: true },
  });
  if (!agency) return { error: 'Agency not found.' };

  const model = await prisma.model.create({
    data: {
      agencyId: parsed.data.agencyId,
      displayName: parsed.data.displayName,
      realName: parsed.data.realName,
      archetype: parsed.data.archetype,
      voiceToneNotes: parsed.data.voiceToneNotes,
      hardRules: parsed.data.hardRules,
      softPreferences: parsed.data.softPreferences,
    },
  });

  revalidatePath('/console/models');
  revalidatePath(`/console/agencies/${parsed.data.agencyId}`);
  redirect(`/console/models/${model.id}`);
}
