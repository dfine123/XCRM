import { prisma, TaskStatus, type TaskBatchStatus } from '@xcrm/db';

export type RunnerTaskPayload = {
  postId: string | null;
  copy: string | null;
  assetId: string | null;
  scheduledFor: string | null;
  modelDisplayName: string | null;
  accountHandle: string | null;
};

export type RunnerTask = {
  id: string;
  orderInBatch: number;
  status: TaskStatus;
  payload: RunnerTaskPayload;
  accountId: string;
  accountHandle: string;
  modelDisplayName: string;
  modelId: string;
  phoneDeviceLabel: string | null;
  escalationReason: string | null;
};

export type BatchDetail = {
  id: string;
  status: TaskBatchStatus;
  totalTasks: number;
  completedTasks: number;
  startedAt: Date | null;
  completedAt: Date | null;
  tasks: RunnerTask[];
};

/**
 * Load a batch + its tasks for the runner. Scoped to `assignedToUserId`
 * so a VA can't open another VA's batch. Returns null if the batch
 * doesn't exist or belongs to someone else.
 *
 * Each task's payload is what `pickUpBatch` wrote — copy + assetId +
 * the strings the runner needs to render without further joins.
 */
export async function getBatchWithTasks(
  batchId: string,
  userId: string,
): Promise<BatchDetail | null> {
  const batch = await prisma.taskBatch.findFirst({
    where: { id: batchId, assignedToUserId: userId },
    select: {
      id: true,
      status: true,
      totalTasks: true,
      completedTasks: true,
      startedAt: true,
      completedAt: true,
      tasks: {
        orderBy: { orderInBatch: 'asc' },
        select: {
          id: true,
          orderInBatch: true,
          status: true,
          payload: true,
          accountId: true,
          escalationReason: true,
          account: {
            select: {
              handle: true,
              model: { select: { id: true, displayName: true } },
            },
          },
          phoneDevice: { select: { label: true } },
        },
      },
    },
  });
  if (!batch) return null;

  return {
    id: batch.id,
    status: batch.status,
    totalTasks: batch.totalTasks,
    completedTasks: batch.completedTasks,
    startedAt: batch.startedAt,
    completedAt: batch.completedAt,
    tasks: batch.tasks.map((t) => {
      const payload = (t.payload ?? {}) as Record<string, unknown>;
      return {
        id: t.id,
        orderInBatch: t.orderInBatch,
        status: t.status,
        payload: {
          postId: typeof payload.postId === 'string' ? payload.postId : null,
          copy: typeof payload.copy === 'string' ? payload.copy : null,
          assetId: typeof payload.assetId === 'string' ? payload.assetId : null,
          scheduledFor:
            typeof payload.scheduledFor === 'string'
              ? payload.scheduledFor
              : null,
          modelDisplayName:
            typeof payload.modelDisplayName === 'string'
              ? payload.modelDisplayName
              : null,
          accountHandle:
            typeof payload.accountHandle === 'string'
              ? payload.accountHandle
              : null,
        },
        accountId: t.accountId,
        accountHandle: t.account.handle,
        modelDisplayName: t.account.model.displayName,
        modelId: t.account.model.id,
        phoneDeviceLabel: t.phoneDevice?.label ?? null,
        escalationReason: t.escalationReason,
      };
    }),
  };
}
