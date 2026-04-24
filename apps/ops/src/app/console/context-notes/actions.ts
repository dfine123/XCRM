'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma, ContextNoteStatus } from '@xcrm/db';
import { requireUser } from '@/lib/session';
import {
  ScopeSchema,
  DurationKey,
  durationToEffectiveUntil,
} from '@/lib/context-notes';

const createSchema = z.object({
  title: z.string().min(1).max(80),
  body: z.string().min(1).max(2000),
  scope: ScopeSchema,
  weight: z.number().int().min(1).max(10),
  durationKey: DurationKey,
});

export type ContextNoteFormState = { error?: string; ok?: boolean } | null;

/**
 * Create a context note. Validates the scope discriminator + weight
 * range + duration mapping up-front so the row we write is always
 * in a known-good shape.
 */
export async function createContextNote(
  _prev: ContextNoteFormState,
  formData: FormData,
): Promise<ContextNoteFormState> {
  const user = await requireUser();

  // Decode the structured scope — the client serialises it to a
  // single JSON string so we don't have to reassemble radio+multi in
  // the FormData parsing.
  let scopeRaw: unknown;
  try {
    scopeRaw = JSON.parse(String(formData.get('scope') ?? ''));
  } catch {
    return { error: 'Malformed scope.' };
  }

  const parsed = createSchema.safeParse({
    title: String(formData.get('title') ?? '').trim(),
    body: String(formData.get('body') ?? '').trim(),
    scope: scopeRaw,
    weight: Number(formData.get('weight') ?? 5),
    durationKey: formData.get('durationKey'),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; '),
    };
  }

  const now = new Date();
  const effectiveUntil = durationToEffectiveUntil(parsed.data.durationKey, now);

  await prisma.contextNote.create({
    data: {
      authorUserId: user.id,
      title: parsed.data.title,
      body: parsed.data.body,
      effectiveFrom: now,
      effectiveUntil,
      weight: parsed.data.weight,
      scope: parsed.data.scope,
      status: ContextNoteStatus.ACTIVE,
    },
  });

  revalidatePath('/console');
  revalidatePath('/console/models', 'page');
  return { ok: true };
}

const cancelSchema = z.object({ id: z.string().min(1) });

/**
 * Operator-triggered cancellation. Distinct from EXPIRED so the audit
 * trail preserves intent — "operator killed this note" vs "note ran
 * its course".
 */
export async function cancelContextNote(formData: FormData): Promise<void> {
  await requireUser();
  const parsed = cancelSchema.safeParse({ id: formData.get('id') });
  if (!parsed.success) return;

  const note = await prisma.contextNote.findUnique({
    where: { id: parsed.data.id },
    select: { status: true },
  });
  if (!note || note.status !== ContextNoteStatus.ACTIVE) return;

  await prisma.contextNote.update({
    where: { id: parsed.data.id },
    data: { status: ContextNoteStatus.CANCELLED },
  });

  revalidatePath('/console');
  revalidatePath('/console/models', 'page');
}
