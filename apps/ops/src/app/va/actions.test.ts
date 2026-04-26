import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = {
  taskBatch: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
  task: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    createMany: vi.fn(),
  },
  post: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  $transaction: vi.fn(async (fn: any) => {
    if (typeof fn === 'function') {
      return fn(prismaMock);
    }
    return Promise.all(fn);
  }),
};

const revalidatePathMock = vi.fn();
const redirectMock = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});

vi.mock('@xcrm/db', () => ({
  prisma: prismaMock,
  PostStatus: {
    DRAFT: 'DRAFT',
    PENDING_APPROVAL: 'PENDING_APPROVAL',
    APPROVED: 'APPROVED',
    SCHEDULED: 'SCHEDULED',
    POSTED: 'POSTED',
    FAILED: 'FAILED',
    CANCELLED: 'CANCELLED',
  },
  TaskAction: {
    POST: 'POST',
    REPLY: 'REPLY',
    REPOST: 'REPOST',
    COMMENT_RESPONSE: 'COMMENT_RESPONSE',
    WARMUP_POST: 'WARMUP_POST',
  },
  TaskStatus: {
    PENDING: 'PENDING',
    COMPLETED: 'COMPLETED',
    SKIPPED: 'SKIPPED',
    ESCALATED: 'ESCALATED',
    FAILED: 'FAILED',
  },
  TaskBatchKind: {
    WARMUP: 'WARMUP',
    REPLY: 'REPLY',
    POST_DROP: 'POST_DROP',
    REPOST: 'REPOST',
    COMMENT_TRIAGE: 'COMMENT_TRIAGE',
    MIXED: 'MIXED',
  },
  TaskBatchStatus: {
    PENDING: 'PENDING',
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
    EXPIRED: 'EXPIRED',
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('next/navigation', () => ({ redirect: redirectMock }));
vi.mock('@/lib/session', () => ({
  requireUser: vi.fn(async () => ({
    id: 'va-1',
    email: 'va@x.com',
    name: 'VA',
    role: 'VA_T1',
  })),
}));

beforeEach(() => {
  for (const k of Object.keys(prismaMock) as (keyof typeof prismaMock)[]) {
    if (k === '$transaction') continue;
    const obj = prismaMock[k] as Record<string, ReturnType<typeof vi.fn>>;
    for (const m of Object.values(obj)) m.mockReset();
  }
  prismaMock.$transaction.mockClear();
  revalidatePathMock.mockReset();
  redirectMock.mockClear();
});

describe('pickUpBatch', () => {
  it('redirects to existing open batch instead of creating a new one', async () => {
    prismaMock.taskBatch.findFirst.mockResolvedValue({ id: 'b-existing' });

    const { pickUpBatch } = await import('./actions');
    await expect(pickUpBatch()).rejects.toThrow('REDIRECT:/va/batch/b-existing');
    expect(prismaMock.taskBatch.create).not.toHaveBeenCalled();
  });

  it('no candidates → returns without redirect', async () => {
    prismaMock.taskBatch.findFirst.mockResolvedValue(null);
    prismaMock.post.findMany.mockResolvedValue([]);

    const { pickUpBatch } = await import('./actions');
    await pickUpBatch();
    expect(prismaMock.taskBatch.create).not.toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalledWith('/va');
  });

  it('creates batch + tasks when candidates exist', async () => {
    prismaMock.taskBatch.findFirst.mockResolvedValue(null);
    prismaMock.post.findMany.mockResolvedValue([
      {
        id: 'post-1',
        scheduledFor: new Date('2026-04-23T12:00:00Z'),
        copy: 'hello',
        assetIds: ['asset-1'],
        accountId: 'a-1',
        account: {
          handle: 'h1',
          phoneDeviceId: 'd-1',
          model: { displayName: 'Model A' },
        },
      },
    ]);
    prismaMock.task.findMany.mockResolvedValue([]); // no live tasks
    prismaMock.taskBatch.create.mockResolvedValue({ id: 'b-new' });
    prismaMock.task.createMany.mockResolvedValue({ count: 1 });

    const { pickUpBatch } = await import('./actions');
    await expect(pickUpBatch()).rejects.toThrow('REDIRECT:/va/batch/b-new');

    expect(prismaMock.taskBatch.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.task.createMany).toHaveBeenCalledTimes(1);

    const tasksArg = prismaMock.task.createMany.mock.calls[0]![0];
    expect(tasksArg.data).toHaveLength(1);
    expect(tasksArg.data[0].action).toBe('POST');
    expect(tasksArg.data[0].payload.postId).toBe('post-1');
    expect(tasksArg.data[0].payload.copy).toBe('hello');
    expect(tasksArg.data[0].payload.assetId).toBe('asset-1');
  });

  it('filters out posts already locked by a live task', async () => {
    prismaMock.taskBatch.findFirst.mockResolvedValue(null);
    prismaMock.post.findMany.mockResolvedValue([
      {
        id: 'post-locked',
        scheduledFor: new Date('2026-04-23T12:00:00Z'),
        copy: 'x',
        assetIds: ['a'],
        accountId: 'a-1',
        account: { handle: 'h', phoneDeviceId: 'd', model: { displayName: 'M' } },
      },
    ]);
    prismaMock.task.findMany.mockResolvedValue([
      { payload: { postId: 'post-locked' } },
    ]);

    const { pickUpBatch } = await import('./actions');
    await pickUpBatch();
    expect(prismaMock.taskBatch.create).not.toHaveBeenCalled();
  });
});

describe('markTaskDone', () => {
  it('flips Task → COMPLETED, Post → POSTED, increments batch progress', async () => {
    prismaMock.task.findFirst.mockResolvedValue({
      id: 't-1',
      status: 'PENDING',
      batchId: 'b-1',
      payload: { postId: 'p-1' },
      startedAt: null,
    });
    prismaMock.taskBatch.findUnique.mockResolvedValue({
      totalTasks: 3,
      completedTasks: 0,
      status: 'PENDING',
    });
    prismaMock.task.update.mockResolvedValue({});
    prismaMock.post.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.taskBatch.update.mockResolvedValue({});

    const { markTaskDone } = await import('./actions');
    const fd = new FormData();
    fd.set('id', 't-1');
    await markTaskDone(fd);

    const taskUpdate = prismaMock.task.update.mock.calls[0]![0];
    expect(taskUpdate.data.status).toBe('COMPLETED');
    expect(taskUpdate.data.completedAt).toBeInstanceOf(Date);

    const postUpdate = prismaMock.post.updateMany.mock.calls[0]![0];
    expect(postUpdate.where).toMatchObject({
      id: 'p-1',
      status: 'SCHEDULED',
    });
    expect(postUpdate.data.status).toBe('POSTED');
    expect(postUpdate.data.postedByUserId).toBe('va-1');

    const batchUpdate = prismaMock.taskBatch.update.mock.calls[0]![0];
    expect(batchUpdate.data.completedTasks).toBe(1);
    expect(batchUpdate.data.status).toBe('IN_PROGRESS');
  });

  it('closes the batch when last task completes', async () => {
    prismaMock.task.findFirst.mockResolvedValue({
      id: 't-1',
      status: 'PENDING',
      batchId: 'b-1',
      payload: { postId: 'p-1' },
      startedAt: new Date(),
    });
    prismaMock.taskBatch.findUnique.mockResolvedValue({
      totalTasks: 2,
      completedTasks: 1,
      status: 'IN_PROGRESS',
    });
    prismaMock.task.update.mockResolvedValue({});
    prismaMock.post.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.taskBatch.update.mockResolvedValue({});

    const { markTaskDone } = await import('./actions');
    const fd = new FormData();
    fd.set('id', 't-1');
    await markTaskDone(fd);

    const batchUpdate = prismaMock.taskBatch.update.mock.calls[0]![0];
    expect(batchUpdate.data.completedTasks).toBe(2);
    expect(batchUpdate.data.status).toBe('COMPLETED');
    expect(batchUpdate.data.completedAt).toBeInstanceOf(Date);
  });

  it('no-op when task is not PENDING', async () => {
    prismaMock.task.findFirst.mockResolvedValue({
      id: 't-1',
      status: 'COMPLETED',
      batchId: 'b-1',
      payload: {},
      startedAt: null,
    });

    const { markTaskDone } = await import('./actions');
    const fd = new FormData();
    fd.set('id', 't-1');
    await markTaskDone(fd);
    expect(prismaMock.task.update).not.toHaveBeenCalled();
  });
});

describe('escalateTask', () => {
  it('flips Task → ESCALATED, Post → PENDING_APPROVAL with reason', async () => {
    prismaMock.task.findFirst.mockResolvedValue({
      id: 't-1',
      status: 'PENDING',
      batchId: 'b-1',
      payload: { postId: 'p-1' },
      startedAt: null,
    });
    prismaMock.post.findUnique.mockResolvedValue({
      generationMeta: { reasoning: 'r' },
      status: 'SCHEDULED',
    });
    prismaMock.taskBatch.findUnique.mockResolvedValue({
      totalTasks: 3,
      completedTasks: 0,
      status: 'PENDING',
    });
    prismaMock.task.update.mockResolvedValue({});
    prismaMock.post.update.mockResolvedValue({});
    prismaMock.taskBatch.update.mockResolvedValue({});

    const { escalateTask } = await import('./actions');
    const fd = new FormData();
    fd.set('id', 't-1');
    fd.set('reason', 'asset is wrong');
    await escalateTask(fd);

    const taskUpdate = prismaMock.task.update.mock.calls[0]![0];
    expect(taskUpdate.data.status).toBe('ESCALATED');
    expect(taskUpdate.data.escalationReason).toBe('asset is wrong');

    const postUpdate = prismaMock.post.update.mock.calls[0]![0];
    expect(postUpdate.data.status).toBe('PENDING_APPROVAL');
    expect(postUpdate.data.generationMeta.escalation.reason).toBe(
      'asset is wrong',
    );
    expect(postUpdate.data.generationMeta.reasoning).toBe('r'); // preserved
  });

  it('rejects empty reason', async () => {
    const { escalateTask } = await import('./actions');
    const fd = new FormData();
    fd.set('id', 't-1');
    fd.set('reason', '');
    await escalateTask(fd);
    expect(prismaMock.task.update).not.toHaveBeenCalled();
  });
});

describe('skipTask', () => {
  it('flips Task → SKIPPED, leaves Post unchanged', async () => {
    prismaMock.task.findFirst.mockResolvedValue({
      id: 't-1',
      status: 'PENDING',
      batchId: 'b-1',
      payload: { postId: 'p-1' },
      startedAt: null,
    });
    prismaMock.taskBatch.findUnique.mockResolvedValue({
      totalTasks: 3,
      completedTasks: 0,
      status: 'PENDING',
    });
    prismaMock.task.update.mockResolvedValue({});
    prismaMock.taskBatch.update.mockResolvedValue({});

    const { skipTask } = await import('./actions');
    const fd = new FormData();
    fd.set('id', 't-1');
    await skipTask(fd);

    const taskUpdate = prismaMock.task.update.mock.calls[0]![0];
    expect(taskUpdate.data.status).toBe('SKIPPED');

    expect(prismaMock.post.update).not.toHaveBeenCalled();
    expect(prismaMock.post.updateMany).not.toHaveBeenCalled();
  });
});
