'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma, ContextNoteStatus, Archetype } from '@xcrm/db';
import { requireUser } from '@/lib/session';
import {
  DurationKey,
  durationToEffectiveUntil,
  type Scope,
} from '@/lib/context-notes';

/**
 * Form-data shape the overlay serialises:
 *
 *   title         string
 *   body          string
 *   weight        "1".."10"
 *   durationKey   TODAY | THREE_DAYS | ONE_WEEK | UNTIL_REMOVED
 *   scopeKind     ALL | ARCHETYPES | ACCOUNTS
 *   archetypes    comma-separated when scopeKind === ARCHETYPES
 *   accountHandles comma-separated @handles when scopeKind === ACCOUNTS
 */
const inputSchema = z.object({
  title: z.string().min(1).max(80),
  body: z.string().min(1).max(2000),
  weight: z.number().int().min(1).max(10),
  durationKey: DurationKey,
  scopeKind: z.enum(['ALL', 'ARCHETYPES', 'ACCOUNTS']),
  archetypes: z.array(z.nativeEnum(Archetype)).optional(),
  accountHandles: z.array(z.string().min(1)).optional(),
});

export type ContextNoteFormState = { error?: string; ok?: boolean } | null;

function splitCsv(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim().replace(/^@/, ''))
    .filter(Boolean);
}

export async function createContextNote(
  _prev: ContextNoteFormState,
  formData: FormData,
): Promise<ContextNoteFormState> {
  const user = await requireUser();

  const parsed = inputSchema.safeParse({
    title: String(formData.get('title') ?? '').trim(),
    body: String(formData.get('body') ?? '').trim(),
    weight: Number(formData.get('weight') ?? 5),
    durationKey: formData.get('durationKey'),
    scopeKind: formData.get('scopeKind'),
    archetypes: splitCsv(formData.get('archetypes') as string | null),
    accountHandles: splitCsv(formData.get('accountHandles') as string | null),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; '),
    };
  }

  // Resolve the operator-friendly scope input into the storage shape.
  let scope: Scope;
  switch (parsed.data.scopeKind) {
    case 'ALL':
      scope = { kind: 'ALL' };
      break;
    case 'ARCHETYPES':
      if (!parsed.data.archetypes || parsed.data.archetypes.length === 0) {
        return { error: 'Pick at least one archetype.' };
      }
      scope = { kind: 'ARCHETYPES', archetypes: parsed.data.archetypes };
      break;
    case 'ACCOUNTS': {
      if (!parsed.data.accountHandles || parsed.data.accountHandles.length === 0) {
        return { error: 'List at least one account handle.' };
      }
      const accounts = await prisma.account.findMany({
        where: { handle: { in: parsed.data.accountHandles }, deletedAt: null },
        select: { id: true, handle: true },
      });
      const found = new Set(accounts.map((a) => a.handle));
      const missing = parsed.data.accountHandles.filter((h) => !found.has(h));
      if (missing.length > 0) {
        return {
          error: `Unknown handle${missing.length > 1 ? 's' : ''}: ${missing.map((h) => '@' + h).join(', ')}`,
        };
      }
      scope = { kind: 'ACCOUNTS', accountIds: accounts.map((a) => a.id) };
      break;
    }
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
      scope,
      status: ContextNoteStatus.ACTIVE,
    },
  });

  revalidatePath('/console');
  revalidatePath('/console/models', 'page');
  return { ok: true };
}

const cancelSchema = z.object({ id: z.string().min(1) });

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
