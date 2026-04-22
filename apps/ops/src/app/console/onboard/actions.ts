'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  prisma,
  AgencyStatus,
  Archetype,
  AccountStatus,
  PhoneDeviceStatus,
} from '@xcrm/db';
import { runDriveSync } from '@/lib/drive-sync';
import { requireUser } from '@/lib/session';
import { parseDriveFolderId } from './_lib/drive-url';

export type OnboardFormState = { error?: string } | null;

function splitList(raw: string | null): string[] {
  if (!raw) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

// --- Step 1: agency -------------------------------------------------------

const step1Schema = z
  .object({
    mode: z.enum(['pick', 'create']),
    existingId: z.string().optional(),
    name: z.string().optional(),
    slug: z
      .string()
      .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, 'lowercase letters, digits, hyphens only')
      .optional(),
  })
  .superRefine((v, ctx) => {
    if (v.mode === 'pick' && !v.existingId) {
      ctx.addIssue({ code: 'custom', message: 'Pick an agency.', path: ['existingId'] });
    }
    if (v.mode === 'create') {
      if (!v.name || v.name.length < 2)
        ctx.addIssue({ code: 'custom', message: 'Name required.', path: ['name'] });
      if (!v.slug || v.slug.length < 2)
        ctx.addIssue({ code: 'custom', message: 'Slug required.', path: ['slug'] });
    }
  });

export async function submitStep1(
  _prev: OnboardFormState,
  formData: FormData,
): Promise<OnboardFormState> {
  await requireUser();
  const parsed = step1Schema.safeParse({
    mode: formData.get('mode'),
    existingId: formData.get('existingId') || undefined,
    name: formData.get('name') || undefined,
    slug: formData.get('slug') || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join('; ') };
  }

  let agencyId: string;
  if (parsed.data.mode === 'pick') {
    const agency = await prisma.agency.findFirst({
      where: { id: parsed.data.existingId!, deletedAt: null },
      select: { id: true },
    });
    if (!agency) return { error: 'Agency not found.' };
    agencyId = agency.id;
  } else {
    try {
      const agency = await prisma.agency.create({
        data: {
          name: parsed.data.name!,
          slug: parsed.data.slug!,
          status: AgencyStatus.PROSPECT,
        },
        select: { id: true },
      });
      agencyId = agency.id;
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'code' in e && (e as { code?: string }).code === 'P2002') {
        return { error: 'An agency with that slug already exists.' };
      }
      throw e;
    }
  }

  redirect(`/console/onboard?agencyId=${agencyId}`);
}

// --- Step 2: model basics -------------------------------------------------

const step2Schema = z.object({
  agencyId: z.string().min(1),
  displayName: z.string().min(1).max(80),
  realName: z.string().max(120).optional().default(''),
  archetype: z.nativeEnum(Archetype),
  voiceToneNotes: z.string().max(4000).optional().default(''),
  hardRules: z.array(z.string()).default([]),
  softPreferences: z.array(z.string()).default([]),
});

export async function submitStep2(
  _prev: OnboardFormState,
  formData: FormData,
): Promise<OnboardFormState> {
  await requireUser();
  const parsed = step2Schema.safeParse({
    agencyId: formData.get('agencyId'),
    displayName: formData.get('displayName'),
    realName: formData.get('realName') ?? '',
    archetype: formData.get('archetype'),
    voiceToneNotes: formData.get('voiceToneNotes') ?? '',
    hardRules: splitList(formData.get('hardRules') as string | null),
    softPreferences: splitList(formData.get('softPreferences') as string | null),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    };
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
    select: { id: true },
  });

  redirect(`/console/onboard?modelId=${model.id}&step=3`);
}

// --- Step 3: add account (+ optional inline device create) ----------------

const step3Schema = z
  .object({
    modelId: z.string().min(1),
    handle: z
      .string()
      .regex(/^[A-Za-z0-9_]+$/, 'Handle may only contain letters, numbers, underscores.')
      .min(1)
      .max(32),
    status: z.nativeEnum(AccountStatus),
    deviceMode: z.enum(['pick', 'create']),
    existingDeviceId: z.string().optional(),
    newDeviceLabel: z.string().max(40).optional(),
    followerCount: z.coerce.number().int().min(0).default(0),
  })
  .superRefine((v, ctx) => {
    if (v.deviceMode === 'pick' && !v.existingDeviceId) {
      ctx.addIssue({
        code: 'custom',
        message: 'Pick a device.',
        path: ['existingDeviceId'],
      });
    }
    if (v.deviceMode === 'create' && (!v.newDeviceLabel || v.newDeviceLabel.length < 1)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Device label required.',
        path: ['newDeviceLabel'],
      });
    }
  });

export async function submitStep3(
  _prev: OnboardFormState,
  formData: FormData,
): Promise<OnboardFormState> {
  await requireUser();
  const parsed = step3Schema.safeParse({
    modelId: formData.get('modelId'),
    handle: String(formData.get('handle') ?? '').replace(/^@/, ''),
    status: formData.get('status'),
    deviceMode: formData.get('deviceMode'),
    existingDeviceId: formData.get('existingDeviceId') || undefined,
    newDeviceLabel: formData.get('newDeviceLabel') || undefined,
    followerCount: formData.get('followerCount') || 0,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join('; ') };
  }

  const model = await prisma.model.findFirst({
    where: { id: parsed.data.modelId, deletedAt: null, onboardingCompletedAt: null },
    select: { id: true },
  });
  if (!model) return { error: 'Model not found or already onboarded.' };

  let phoneDeviceId: string;
  if (parsed.data.deviceMode === 'pick') {
    const d = await prisma.phoneDevice.findUnique({
      where: { id: parsed.data.existingDeviceId! },
      select: { id: true },
    });
    if (!d) return { error: 'Phone device not found.' };
    phoneDeviceId = d.id;
  } else {
    try {
      const d = await prisma.phoneDevice.create({
        data: {
          label: parsed.data.newDeviceLabel!,
          status: PhoneDeviceStatus.ACTIVE,
        },
        select: { id: true },
      });
      phoneDeviceId = d.id;
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'code' in e && (e as { code?: string }).code === 'P2002') {
        return { error: 'A device with that label already exists.' };
      }
      throw e;
    }
  }

  try {
    await prisma.account.create({
      data: {
        modelId: parsed.data.modelId,
        handle: parsed.data.handle,
        status: parsed.data.status,
        phoneDeviceId,
        followerCount: parsed.data.followerCount,
      },
    });
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && (e as { code?: string }).code === 'P2002') {
      return { error: 'That handle is already taken.' };
    }
    throw e;
  }

  // Stay on step 3 (operator can add more accounts). We reveal an
  // "Add another" vs "Continue" choice in the UI after the first account.
  revalidatePath(`/console/onboard`);
  redirect(`/console/onboard?modelId=${parsed.data.modelId}&step=3`);
}

/** Explicit "done adding accounts" — user clicks to advance to step 4. */
export async function advanceFromStep3(formData: FormData): Promise<void> {
  await requireUser();
  const modelId = String(formData.get('modelId') ?? '');
  if (!modelId) return;
  const count = await prisma.account.count({
    where: { modelId, deletedAt: null },
  });
  if (count === 0) return;
  redirect(`/console/onboard?modelId=${modelId}&step=4`);
}

// --- Step 4: connect Drive folder -----------------------------------------

const step4Schema = z.object({
  modelId: z.string().min(1),
  folderInput: z.string().min(1, 'Paste a Drive URL or folder ID.'),
  folderName: z.string().min(1).max(120),
});

export async function submitStep4(
  _prev: OnboardFormState,
  formData: FormData,
): Promise<OnboardFormState> {
  const user = await requireUser();
  const parsed = step4Schema.safeParse({
    modelId: formData.get('modelId'),
    folderInput: String(formData.get('folderInput') ?? '').trim(),
    folderName: String(formData.get('folderName') ?? '').trim(),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join('; ') };
  }

  const folderId = parseDriveFolderId(parsed.data.folderInput);
  if (!folderId) {
    return {
      error:
        'Could not parse a folder ID from that input. Paste the folder URL or the raw ID.',
    };
  }

  const model = await prisma.model.findFirst({
    where: { id: parsed.data.modelId, deletedAt: null, onboardingCompletedAt: null },
    select: { id: true },
  });
  if (!model) return { error: 'Model not found or already onboarded.' };

  let sourceId: string;
  try {
    const created = await prisma.driveSource.create({
      data: {
        modelId: parsed.data.modelId,
        folderId,
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

  // Kick off an initial sync inline. Best-effort — the operator can re-sync
  // from the model detail page if anything goes wrong.
  try {
    await runDriveSync(sourceId, { triggeredByUserId: user.id });
  } catch (err) {
    console.error(
      `[onboard:step4] initial sync failed sourceId=${sourceId}:`,
      err instanceof Error ? err.message : String(err),
    );
  }

  redirect(`/console/onboard?modelId=${parsed.data.modelId}&step=5`);
}

// --- Step 5: activate -----------------------------------------------------

export async function completeOnboarding(formData: FormData): Promise<void> {
  await requireUser();
  const modelId = String(formData.get('modelId') ?? '');
  if (!modelId) return;

  const [accountCount, driveSourceCount] = await Promise.all([
    prisma.account.count({ where: { modelId, deletedAt: null } }),
    prisma.driveSource.count({ where: { modelId, deletedAt: null } }),
  ]);
  if (accountCount === 0 || driveSourceCount === 0) return;

  await prisma.model.update({
    where: { id: modelId },
    data: { onboardingCompletedAt: new Date() },
  });

  revalidatePath('/console');
  revalidatePath(`/console/models/${modelId}`);
  redirect(`/console/models/${modelId}`);
}

/** Abandon an in-progress onboarding — soft-delete the model. */
export async function abandonOnboarding(formData: FormData): Promise<void> {
  await requireUser();
  const modelId = String(formData.get('modelId') ?? '');
  if (!modelId) return;

  const model = await prisma.model.findFirst({
    where: { id: modelId, deletedAt: null, onboardingCompletedAt: null },
    select: { id: true },
  });
  if (!model) return;

  await prisma.model.update({
    where: { id: modelId },
    data: { deletedAt: new Date() },
  });

  revalidatePath('/console/onboard');
  redirect('/console/onboard');
}
