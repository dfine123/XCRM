import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = {
  post: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  account: {
    findUnique: vi.fn(),
  },
  contentAsset: {
    findFirst: vi.fn(),
  },
};

const revalidatePathMock = vi.fn();

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
}));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('@/lib/session', () => ({
  requireUser: vi.fn(async () => ({
    id: 'u-1',
    email: 'op@x.com',
    name: 'Op',
    role: 'FOUNDER',
  })),
}));

beforeEach(() => {
  prismaMock.post.findFirst.mockReset();
  prismaMock.post.update.mockReset();
  prismaMock.account.findUnique.mockReset();
  prismaMock.contentAsset.findFirst.mockReset();
  revalidatePathMock.mockReset();
});

describe('approvePost', () => {
  it('PENDING_APPROVAL → SCHEDULED with approval metadata', async () => {
    prismaMock.post.findFirst.mockResolvedValue({
      status: 'PENDING_APPROVAL',
      accountId: 'a-1',
      generationMeta: { reasoning: 'r', source: 'cron' },
    });
    prismaMock.post.update.mockResolvedValue({});
    prismaMock.account.findUnique.mockResolvedValue({ modelId: 'm-1' });

    const { approvePost } = await import('./actions');
    const fd = new FormData();
    fd.set('id', 'p-1');
    await approvePost(fd);

    const update = prismaMock.post.update.mock.calls[0]![0];
    expect(update.where).toEqual({ id: 'p-1' });
    expect(update.data.status).toBe('SCHEDULED');
    expect(update.data.approvedByUserId).toBe('u-1');
    // Original generationMeta keys preserved alongside the new approval block.
    expect(update.data.generationMeta.reasoning).toBe('r');
    expect(update.data.generationMeta.source).toBe('cron');
    expect(update.data.generationMeta.approval.approvedByUserId).toBe('u-1');
    // Revalidates roster + queue + model detail.
    expect(revalidatePathMock).toHaveBeenCalledWith('/console/review');
    expect(revalidatePathMock).toHaveBeenCalledWith('/console');
    expect(revalidatePathMock).toHaveBeenCalledWith('/console/models/m-1');
  });

  it('is a no-op when the post is already SCHEDULED', async () => {
    prismaMock.post.findFirst.mockResolvedValue({
      status: 'SCHEDULED',
      accountId: 'a-1',
      generationMeta: {},
    });

    const { approvePost } = await import('./actions');
    const fd = new FormData();
    fd.set('id', 'p-1');
    await approvePost(fd);

    expect(prismaMock.post.update).not.toHaveBeenCalled();
  });

  it('is a no-op when the post does not exist', async () => {
    prismaMock.post.findFirst.mockResolvedValue(null);

    const { approvePost } = await import('./actions');
    const fd = new FormData();
    fd.set('id', 'nope');
    await approvePost(fd);

    expect(prismaMock.post.update).not.toHaveBeenCalled();
  });
});

describe('rejectPost', () => {
  it('records reason in generationMeta.rejection and flips to CANCELLED', async () => {
    prismaMock.post.findFirst.mockResolvedValue({
      status: 'PENDING_APPROVAL',
      accountId: 'a-1',
      generationMeta: { reasoning: 'r' },
    });
    prismaMock.post.update.mockResolvedValue({});
    prismaMock.account.findUnique.mockResolvedValue({ modelId: 'm-1' });

    const { rejectPost } = await import('./actions');
    const fd = new FormData();
    fd.set('id', 'p-1');
    fd.set('reason', 'tone is off');
    await rejectPost(fd);

    const update = prismaMock.post.update.mock.calls[0]![0];
    expect(update.data.status).toBe('CANCELLED');
    expect(update.data.generationMeta.rejection.reason).toBe('tone is off');
    expect(update.data.generationMeta.rejection.rejectedByUserId).toBe('u-1');
  });

  it('persists null reason when none supplied', async () => {
    prismaMock.post.findFirst.mockResolvedValue({
      status: 'PENDING_APPROVAL',
      accountId: 'a-1',
      generationMeta: {},
    });
    prismaMock.post.update.mockResolvedValue({});
    prismaMock.account.findUnique.mockResolvedValue({ modelId: 'm-1' });

    const { rejectPost } = await import('./actions');
    const fd = new FormData();
    fd.set('id', 'p-1');
    await rejectPost(fd);

    const update = prismaMock.post.update.mock.calls[0]![0];
    expect(update.data.generationMeta.rejection.reason).toBeNull();
  });

  it('no-op when post is not PENDING_APPROVAL', async () => {
    prismaMock.post.findFirst.mockResolvedValue({
      status: 'CANCELLED',
      accountId: 'a-1',
      generationMeta: {},
    });
    const { rejectPost } = await import('./actions');
    const fd = new FormData();
    fd.set('id', 'p-1');
    await rejectPost(fd);
    expect(prismaMock.post.update).not.toHaveBeenCalled();
  });
});

describe('editAndApprovePost', () => {
  it('updates copy + asset, sets SCHEDULED, records edit in metadata', async () => {
    prismaMock.post.findFirst.mockResolvedValue({
      status: 'PENDING_APPROVAL',
      copy: 'old copy',
      assetIds: ['old-asset'],
      accountId: 'a-1',
      generationMeta: { reasoning: 'r' },
      account: { modelId: 'm-1' },
    });
    prismaMock.contentAsset.findFirst.mockResolvedValue({ id: 'new-asset' });
    prismaMock.post.update.mockResolvedValue({});

    const { editAndApprovePost } = await import('./actions');
    const fd = new FormData();
    fd.set('id', 'p-1');
    fd.set('copy', 'new copy');
    fd.set('assetId', 'new-asset');
    const res = await editAndApprovePost(null, fd);

    expect(res?.ok).toBe(true);
    const update = prismaMock.post.update.mock.calls[0]![0];
    expect(update.data.status).toBe('SCHEDULED');
    expect(update.data.copy).toBe('new copy');
    expect(update.data.assetIds).toEqual(['new-asset']);
    expect(update.data.generationMeta.edit.originalCopy).toBe('old copy');
    expect(update.data.generationMeta.edit.originalAssetId).toBe('old-asset');
    expect(update.data.generationMeta.approval.edited).toBe(true);
  });

  it('rejects copy > 280 chars', async () => {
    const { editAndApprovePost } = await import('./actions');
    const fd = new FormData();
    fd.set('id', 'p-1');
    fd.set('copy', 'x'.repeat(281));
    fd.set('assetId', 'a');
    const res = await editAndApprovePost(null, fd);
    expect(res?.error).toBeDefined();
    expect(prismaMock.post.update).not.toHaveBeenCalled();
  });

  it('rejects empty copy', async () => {
    const { editAndApprovePost } = await import('./actions');
    const fd = new FormData();
    fd.set('id', 'p-1');
    fd.set('copy', '');
    fd.set('assetId', 'a');
    const res = await editAndApprovePost(null, fd);
    expect(res?.error).toBeDefined();
  });

  it('rejects asset not in the model library', async () => {
    prismaMock.post.findFirst.mockResolvedValue({
      status: 'PENDING_APPROVAL',
      copy: 'old',
      assetIds: ['x'],
      accountId: 'a-1',
      generationMeta: {},
      account: { modelId: 'm-1' },
    });
    prismaMock.contentAsset.findFirst.mockResolvedValue(null);

    const { editAndApprovePost } = await import('./actions');
    const fd = new FormData();
    fd.set('id', 'p-1');
    fd.set('copy', 'new copy');
    fd.set('assetId', 'cross-model');
    const res = await editAndApprovePost(null, fd);
    expect(res?.error).toMatch(/Asset not found/);
    expect(prismaMock.post.update).not.toHaveBeenCalled();
  });

  it('refuses to edit a non-PENDING post', async () => {
    prismaMock.post.findFirst.mockResolvedValue({
      status: 'SCHEDULED',
      copy: 'old',
      assetIds: ['x'],
      accountId: 'a-1',
      generationMeta: {},
      account: { modelId: 'm-1' },
    });

    const { editAndApprovePost } = await import('./actions');
    const fd = new FormData();
    fd.set('id', 'p-1');
    fd.set('copy', 'new copy');
    fd.set('assetId', 'x');
    const res = await editAndApprovePost(null, fd);
    expect(res?.error).toMatch(/no longer pending/);
  });
});
