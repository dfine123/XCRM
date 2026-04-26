import { prisma, TaskBatchStatus } from '@xcrm/db';

/**
 * Find the VA's currently-open batch, if any. A batch is "open" if its
 * status is PENDING or IN_PROGRESS — once COMPLETED or EXPIRED it
 * stops surfacing as resumable work.
 *
 * Returning the row + its task counts lets the landing page render
 * "Resume batch (3/8 done)" without a second query.
 */
export type OpenBatchSummary = {
  id: string;
  status: TaskBatchStatus;
  totalTasks: number;
  completedTasks: number;
  startedAt: Date | null;
};

export async function getOpenBatchForUser(
  userId: string,
): Promise<OpenBatchSummary | null> {
  const batch = await prisma.taskBatch.findFirst({
    where: {
      assignedToUserId: userId,
      status: { in: [TaskBatchStatus.PENDING, TaskBatchStatus.IN_PROGRESS] },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      status: true,
      totalTasks: true,
      completedTasks: true,
      startedAt: true,
    },
  });
  return batch;
}
