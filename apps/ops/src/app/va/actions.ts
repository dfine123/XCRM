'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  prisma,
  PostStatus,
  TaskAction,
  TaskBatchKind,
  TaskBatchStatus,
  TaskStatus,
} from '@xcrm/db';
import { requireUser } from '@/lib/session';
import { composeBatch } from '@/lib/va-queue';

/**
 * Lookahead window — a SCHEDULED Post is pickable if its
 * `scheduledFor` is now or within the next 24h. Tunable.
 */
const PICKUP_LOOKAHEAD_HOURS = 24;
const BATCH_CAP = 10;

/**
 * Pick up the next batch for the current VA. Just-in-time:
 *   1. Find pickable Posts (SCHEDULED, due within window, no live Task)
 *   2. composeBatch() picks a device-affinity group, capped at 10
 *   3. Atomically create TaskBatch + N Tasks
 *   4. Redirect to the runner
 *
 * Idempotency: if the VA already has an open batch, we skip the create
 * and just redirect them to it. Spec: "A VA has one open batch at a
 * time." Avoids accidental double-tap creating two empty batches.
 */
export async function pickUpBatch(): Promise<void> {
  const user = await requireUser();

  // Already-open batch? Resume it instead of creating a new one.
  const existing = await prisma.taskBatch.findFirst({
    where: {
      assignedToUserId: user.id,
      status: { in: [TaskBatchStatus.PENDING, TaskBatchStatus.IN_PROGRESS] },
    },
    select: { id: true },
    orderBy: { createdAt: 'desc' },
  });
  if (existing) redirect(`/va/batch/${existing.id}`);

  const now = new Date();
  const lookaheadCutoff = new Date(
    now.getTime() + PICKUP_LOOKAHEAD_HOURS * 60 * 60 * 1000,
  );

  // Pickable: SCHEDULED Posts due within the lookahead window with no
  // live Task. "Live" = any Task whose status is not in a terminal
  // bucket (COMPLETED/SKIPPED/ESCALATED/FAILED). Easier to scope by
  // post status: when the VA flow finishes a post, the Post flips
  // POSTED — so SCHEDULED is sufficient.
  const candidates = await prisma.post.findMany({
    where: {
      status: PostStatus.SCHEDULED,
      deletedAt: null,
      scheduledFor: { lte: lookaheadCutoff },
      account: { deletedAt: null },
    },
    select: {
      id: true,
      scheduledFor: true,
      copy: true,
      assetIds: true,
      accountId: true,
      account: {
        select: {
          handle: true,
          phoneDeviceId: true,
          model: { select: { displayName: true } },
        },
      },
    },
    take: BATCH_CAP * 4, // generous — composeBatch picks the right slice
  });

  // Skip posts that already have a non-terminal Task pointing at them.
  // We track linkage via Task.payload.postId since Task has no direct
  // postId column. Cheap given small N.
  const candidatePostIds = candidates.map((c) => c.id);
  let lockedPostIds = new Set<string>();
  if (candidatePostIds.length > 0) {
    const liveTasks = await prisma.task.findMany({
      where: {
        status: TaskStatus.PENDING,
        payload: { path: ['postId'], string_contains: '' }, // any postId set
      },
      select: { payload: true },
    });
    for (const t of liveTasks) {
      const p = (t.payload ?? {}) as Record<string, unknown>;
      if (typeof p.postId === 'string') lockedPostIds.add(p.postId);
    }
  }
  const filtered = candidates.filter((c) => !lockedPostIds.has(c.id));

  const composed = composeBatch(
    filtered.map((c) => ({
      postId: c.id,
      accountId: c.accountId,
      phoneDeviceId: c.account.phoneDeviceId,
      scheduledFor: c.scheduledFor!,
    })),
    { cap: BATCH_CAP },
  );

  if (composed.tasks.length === 0) {
    revalidatePath('/va');
    return; // nothing to do; the landing page renders the empty state
  }

  // Build a lookup from the candidate set so we can carry payload data
  // into the Task rows without a second query.
  const byPostId = new Map(filtered.map((c) => [c.id, c] as const));

  const created = await prisma.$transaction(async (tx) => {
    const batch = await tx.taskBatch.create({
      data: {
        assignedToUserId: user.id,
        kind: TaskBatchKind.POST_DROP,
        scheduledFor: composed.tasks[0]!.scheduledFor,
        status: TaskBatchStatus.PENDING,
        totalTasks: composed.tasks.length,
      },
      select: { id: true },
    });

    await tx.task.createMany({
      data: composed.tasks.map((t, i) => {
        const post = byPostId.get(t.postId)!;
        return {
          batchId: batch.id,
          orderInBatch: i,
          accountId: t.accountId,
          phoneDeviceId: t.phoneDeviceId,
          action: TaskAction.POST,
          status: TaskStatus.PENDING,
          payload: {
            postId: t.postId,
            copy: post.copy,
            assetId: post.assetIds[0] ?? null,
            scheduledFor: t.scheduledFor.toISOString(),
            modelDisplayName: post.account.model.displayName,
            accountHandle: post.account.handle,
          },
        };
      }),
    });

    return batch.id;
  });

  revalidatePath('/va');
  redirect(`/va/batch/${created}`);
}

const idSchema = z.object({ id: z.string().min(1) });

/**
 * Internal helper: load + authorise a Task for the calling VA. Returns
 * null when the task doesn't belong to the VA or isn't actionable.
 */
async function loadOwnedActiveTask(
  taskId: string,
  userId: string,
) {
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      batch: { assignedToUserId: userId },
    },
    select: {
      id: true,
      status: true,
      batchId: true,
      payload: true,
      startedAt: true,
    },
  });
  if (!task) return null;
  if (task.status !== TaskStatus.PENDING) return null;
  return task;
}

/**
 * Mark the active task done. Flip Task → COMPLETED and Post → POSTED
 * with `postedAt = now`. Increment batch progress; if that closes out
 * the batch, mark it COMPLETED too.
 *
 * The Post update is best-effort — if Post is already POSTED (race
 * with another runner), the update is a no-op via the where clause
 * scoping on `status: SCHEDULED`.
 */
export async function markTaskDone(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = idSchema.safeParse({ id: formData.get('id') });
  if (!parsed.success) return;

  const task = await loadOwnedActiveTask(parsed.data.id, user.id);
  if (!task) return;

  const payload = (task.payload ?? {}) as Record<string, unknown>;
  const postId = typeof payload.postId === 'string' ? payload.postId : null;
  const startedAt = task.startedAt ?? new Date();
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.task.update({
      where: { id: task.id },
      data: {
        status: TaskStatus.COMPLETED,
        startedAt,
        completedAt: now,
        timeSpentSeconds: Math.round((now.getTime() - startedAt.getTime()) / 1000),
      },
    });

    if (postId) {
      await tx.post.updateMany({
        where: { id: postId, status: PostStatus.SCHEDULED, deletedAt: null },
        data: {
          status: PostStatus.POSTED,
          postedAt: now,
          postedByUserId: user.id,
        },
      });
    }

    // Bump batch progress; close out when fully done.
    const batch = await tx.taskBatch.findUnique({
      where: { id: task.batchId },
      select: { totalTasks: true, completedTasks: true, status: true },
    });
    if (batch) {
      const completedTasks = batch.completedTasks + 1;
      const closingOut = completedTasks >= batch.totalTasks;
      await tx.taskBatch.update({
        where: { id: task.batchId },
        data: {
          completedTasks,
          status: closingOut
            ? TaskBatchStatus.COMPLETED
            : batch.status === TaskBatchStatus.PENDING
              ? TaskBatchStatus.IN_PROGRESS
              : batch.status,
          startedAt:
            batch.status === TaskBatchStatus.PENDING ? now : undefined,
          completedAt: closingOut ? now : undefined,
        },
      });
    }
  });

  revalidatePath('/va');
  revalidatePath(`/va/batch/${task.batchId}`);
  revalidatePath('/console');
}

const escalateSchema = z.object({
  id: z.string().min(1),
  reason: z.string().min(1).max(500),
});

/**
 * Escalate the active task back to the operator. Task → ESCALATED with
 * reason. Post → PENDING_APPROVAL with the reason captured at
 * `generationMeta.escalation` so the review queue surfaces it.
 *
 * Per the lifecycle table in the build plan: a fresh Task gets created
 * if the operator re-approves and a VA picks it up again. The
 * ESCALATED row stays as the audit breadcrumb.
 */
export async function escalateTask(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = escalateSchema.safeParse({
    id: formData.get('id'),
    reason: String(formData.get('reason') ?? '').trim(),
  });
  if (!parsed.success) return;

  const task = await loadOwnedActiveTask(parsed.data.id, user.id);
  if (!task) return;

  const payload = (task.payload ?? {}) as Record<string, unknown>;
  const postId = typeof payload.postId === 'string' ? payload.postId : null;
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.task.update({
      where: { id: task.id },
      data: {
        status: TaskStatus.ESCALATED,
        escalationReason: parsed.data.reason,
        completedAt: now,
      },
    });

    if (postId) {
      const post = await tx.post.findUnique({
        where: { id: postId },
        select: { generationMeta: true, status: true },
      });
      if (post && post.status === PostStatus.SCHEDULED) {
        const meta = (post.generationMeta ?? {}) as Record<string, unknown>;
        await tx.post.update({
          where: { id: postId },
          data: {
            status: PostStatus.PENDING_APPROVAL,
            generationMeta: {
              ...meta,
              escalation: {
                escalatedAt: now.toISOString(),
                escalatedByUserId: user.id,
                reason: parsed.data.reason,
                fromTaskId: task.id,
              },
            },
          },
        });
      }
    }

    // The escalated task counts as resolved-from-the-batch's-perspective:
    // it's no longer PENDING. Bump completedTasks so the batch can finish
    // even when items escalate.
    const batch = await tx.taskBatch.findUnique({
      where: { id: task.batchId },
      select: { totalTasks: true, completedTasks: true, status: true },
    });
    if (batch) {
      const completedTasks = batch.completedTasks + 1;
      const closingOut = completedTasks >= batch.totalTasks;
      await tx.taskBatch.update({
        where: { id: task.batchId },
        data: {
          completedTasks,
          status: closingOut
            ? TaskBatchStatus.COMPLETED
            : batch.status === TaskBatchStatus.PENDING
              ? TaskBatchStatus.IN_PROGRESS
              : batch.status,
          startedAt:
            batch.status === TaskBatchStatus.PENDING ? now : undefined,
          completedAt: closingOut ? now : undefined,
        },
      });
    }
  });

  revalidatePath('/va');
  revalidatePath(`/va/batch/${task.batchId}`);
  revalidatePath('/console');
  revalidatePath('/console/review');
}

/**
 * Skip the active task. Task → SKIPPED. Post stays SCHEDULED so a
 * future pick-up can re-batch it. Audit row remains.
 */
export async function skipTask(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = idSchema.safeParse({ id: formData.get('id') });
  if (!parsed.success) return;

  const task = await loadOwnedActiveTask(parsed.data.id, user.id);
  if (!task) return;

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.task.update({
      where: { id: task.id },
      data: { status: TaskStatus.SKIPPED, completedAt: now },
    });

    const batch = await tx.taskBatch.findUnique({
      where: { id: task.batchId },
      select: { totalTasks: true, completedTasks: true, status: true },
    });
    if (batch) {
      const completedTasks = batch.completedTasks + 1;
      const closingOut = completedTasks >= batch.totalTasks;
      await tx.taskBatch.update({
        where: { id: task.batchId },
        data: {
          completedTasks,
          status: closingOut
            ? TaskBatchStatus.COMPLETED
            : batch.status === TaskBatchStatus.PENDING
              ? TaskBatchStatus.IN_PROGRESS
              : batch.status,
          startedAt:
            batch.status === TaskBatchStatus.PENDING ? now : undefined,
          completedAt: closingOut ? now : undefined,
        },
      });
    }
  });

  revalidatePath('/va');
  revalidatePath(`/va/batch/${task.batchId}`);
}
