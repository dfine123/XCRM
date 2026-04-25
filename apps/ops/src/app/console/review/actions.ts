'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma, PostStatus } from '@xcrm/db';
import { requireUser } from '@/lib/session';

export type ReviewActionState = { error?: string; ok?: boolean } | null;

const idSchema = z.object({ id: z.string().min(1) });

/**
 * Approve a PENDING_APPROVAL post → SCHEDULED. Idempotent: if the
 * post is already in any non-PENDING state we no-op rather than
 * thrash the row. The deterministic schedule the orchestrator picked
 * during draft creation is preserved — Build E doesn't change time.
 *
 * generationMeta gets an `approval` block recording who and when.
 * Build G will read this for "operator-approved-without-edit" signals.
 */
export async function approvePost(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = idSchema.safeParse({ id: formData.get('id') });
  if (!parsed.success) return;

  const post = await prisma.post.findFirst({
    where: { id: parsed.data.id, deletedAt: null },
    select: { status: true, accountId: true, generationMeta: true },
  });
  if (!post || post.status !== PostStatus.PENDING_APPROVAL) return;

  const meta = (post.generationMeta ?? {}) as Record<string, unknown>;
  await prisma.post.update({
    where: { id: parsed.data.id },
    data: {
      status: PostStatus.SCHEDULED,
      approvedByUserId: user.id,
      generationMeta: {
        ...meta,
        approval: {
          approvedAt: new Date().toISOString(),
          approvedByUserId: user.id,
        },
      },
    },
  });

  revalidatePath('/console/review');
  revalidatePath('/console');
  // Account-scoped revalidation for the model detail view.
  const account = await prisma.account.findUnique({
    where: { id: post.accountId },
    select: { modelId: true },
  });
  if (account) revalidatePath(`/console/models/${account.modelId}`);
}

const rejectSchema = z.object({
  id: z.string().min(1),
  reason: z.string().max(500).optional().default(''),
});

/**
 * Reject a PENDING_APPROVAL post → CANCELLED with optional operator
 * reason. The reason persists in `generationMeta.rejection` for Build
 * G's negative-signal feedback loop. CANCELLED is final; no undo.
 */
export async function rejectPost(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = rejectSchema.safeParse({
    id: formData.get('id'),
    reason: String(formData.get('reason') ?? '').trim(),
  });
  if (!parsed.success) return;

  const post = await prisma.post.findFirst({
    where: { id: parsed.data.id, deletedAt: null },
    select: { status: true, accountId: true, generationMeta: true },
  });
  if (!post || post.status !== PostStatus.PENDING_APPROVAL) return;

  const meta = (post.generationMeta ?? {}) as Record<string, unknown>;
  await prisma.post.update({
    where: { id: parsed.data.id },
    data: {
      status: PostStatus.CANCELLED,
      generationMeta: {
        ...meta,
        rejection: {
          rejectedAt: new Date().toISOString(),
          rejectedByUserId: user.id,
          reason: parsed.data.reason || null,
        },
      },
    },
  });

  revalidatePath('/console/review');
  revalidatePath('/console');
  const account = await prisma.account.findUnique({
    where: { id: post.accountId },
    select: { modelId: true },
  });
  if (account) revalidatePath(`/console/models/${account.modelId}`);
}

const editSchema = z.object({
  id: z.string().min(1),
  copy: z.string().min(1).max(280),
  assetId: z.string().min(1),
});

/**
 * Edit copy and/or asset, then approve in one motion. Updates
 * `Post.copy` and `Post.assetIds[0]`, flips status to SCHEDULED.
 *
 * Records the override in `generationMeta.edit` with the originals so
 * Build G's feedback loop can learn what the operator changed and why.
 *
 * Asset existence is validated against the same model's library —
 * an operator can only swap to an asset on the model that owns this
 * post's account, never cross-pollinate.
 */
export async function editAndApprovePost(
  _prev: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const user = await requireUser();
  const parsed = editSchema.safeParse({
    id: formData.get('id'),
    copy: String(formData.get('copy') ?? '').trim(),
    assetId: String(formData.get('assetId') ?? '').trim(),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; '),
    };
  }

  const post = await prisma.post.findFirst({
    where: { id: parsed.data.id, deletedAt: null },
    select: {
      status: true,
      copy: true,
      assetIds: true,
      accountId: true,
      generationMeta: true,
      account: { select: { modelId: true } },
    },
  });
  if (!post) return { error: 'Post not found.' };
  if (post.status !== PostStatus.PENDING_APPROVAL) {
    return { error: 'Post is no longer pending approval.' };
  }

  // Asset must belong to this account's model and not be deleted.
  const asset = await prisma.contentAsset.findFirst({
    where: {
      id: parsed.data.assetId,
      modelId: post.account.modelId,
      deletedAt: null,
    },
    select: { id: true },
  });
  if (!asset) {
    return { error: 'Asset not found in this model’s library.' };
  }

  const meta = (post.generationMeta ?? {}) as Record<string, unknown>;
  await prisma.post.update({
    where: { id: parsed.data.id },
    data: {
      status: PostStatus.SCHEDULED,
      copy: parsed.data.copy,
      assetIds: [parsed.data.assetId],
      approvedByUserId: user.id,
      generationMeta: {
        ...meta,
        edit: {
          editedAt: new Date().toISOString(),
          editedByUserId: user.id,
          originalCopy: post.copy,
          originalAssetId: post.assetIds[0] ?? null,
        },
        approval: {
          approvedAt: new Date().toISOString(),
          approvedByUserId: user.id,
          edited: true,
        },
      },
    },
  });

  revalidatePath('/console/review');
  revalidatePath('/console');
  revalidatePath(`/console/models/${post.account.modelId}`);
  return { ok: true };
}
