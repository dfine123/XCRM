import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = {
  driveSource: {
    findUnique: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
};

vi.mock('@xcrm/db', () => ({
  prisma: prismaMock,
  DriveSourceStatus: { ACTIVE: 'ACTIVE', DISCONNECTED: 'DISCONNECTED' },
}));

// The module is a server-actions file; its imports transitively hit
// next/cache and next/navigation. Mock them to no-ops so the action runs
// as a plain async function inside vitest.
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('@/lib/session', () => ({
  requireUser: vi.fn(async () => ({
    id: 'u-1',
    email: 'test@x.com',
    name: 'Test',
    role: 'FOUNDER',
  })),
}));
vi.mock('@/lib/drive-sync', () => ({
  runDriveSync: vi.fn(async () => ({
    ok: true,
    filesSeen: 0,
    filesIngested: 0,
    filesSkipped: 0,
    taggingQueued: 0,
  })),
}));

beforeEach(() => {
  prismaMock.driveSource.findUnique.mockReset();
  prismaMock.driveSource.update.mockReset();
  prismaMock.driveSource.create.mockReset();
});

describe('upsertDriveSource — bug #1 regression', () => {
  it('creates a new DriveSource when no row exists for (modelId, folderId)', async () => {
    prismaMock.driveSource.findUnique.mockResolvedValue(null);
    prismaMock.driveSource.create.mockResolvedValue({ id: 'src-1' });

    const { upsertDriveSource } = await import('./actions');
    const res = await upsertDriveSource({
      modelId: 'm-1',
      folderId: 'folder-abc',
      folderName: 'Primary',
      userId: 'u-1',
    });

    expect(res).toEqual({ sourceId: 'src-1', reactivated: false });
    expect(prismaMock.driveSource.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.driveSource.update).not.toHaveBeenCalled();
  });

  it('reactivates a DISCONNECTED row on reconnect (the bug fix)', async () => {
    // Simulate: same folderId was previously connected and then disconnected.
    prismaMock.driveSource.findUnique.mockResolvedValue({
      id: 'src-existing',
      status: 'DISCONNECTED',
    });

    const { upsertDriveSource } = await import('./actions');
    const res = await upsertDriveSource({
      modelId: 'm-1',
      folderId: 'folder-abc',
      folderName: 'Primary (reconnected)',
      userId: 'u-1',
    });

    expect(res).toEqual({ sourceId: 'src-existing', reactivated: true });
    expect(prismaMock.driveSource.create).not.toHaveBeenCalled();
    expect(prismaMock.driveSource.update).toHaveBeenCalledWith({
      where: { id: 'src-existing' },
      data: {
        status: 'ACTIVE',
        disconnectedAt: null,
        folderName: 'Primary (reconnected)',
      },
    });
  });

  it('rejects a second connect while the row is still ACTIVE', async () => {
    prismaMock.driveSource.findUnique.mockResolvedValue({
      id: 'src-existing',
      status: 'ACTIVE',
    });

    const { upsertDriveSource } = await import('./actions');
    await expect(
      upsertDriveSource({
        modelId: 'm-1',
        folderId: 'folder-abc',
        folderName: 'Primary',
        userId: 'u-1',
      }),
    ).rejects.toThrow(/already connected/i);

    expect(prismaMock.driveSource.create).not.toHaveBeenCalled();
    expect(prismaMock.driveSource.update).not.toHaveBeenCalled();
  });

  it('full flow: create → disconnect → reconnect', async () => {
    // Step 1: fresh connect
    prismaMock.driveSource.findUnique.mockResolvedValueOnce(null);
    prismaMock.driveSource.create.mockResolvedValueOnce({ id: 'src-full' });

    const { upsertDriveSource } = await import('./actions');
    const first = await upsertDriveSource({
      modelId: 'm-1',
      folderId: 'folder-xyz',
      folderName: 'Main',
      userId: 'u-1',
    });
    expect(first).toEqual({ sourceId: 'src-full', reactivated: false });

    // Step 2: simulated disconnect happens out-of-band — row is now DISCONNECTED.
    // Step 3: reconnect with the same folderId must reactivate, not collide.
    prismaMock.driveSource.findUnique.mockResolvedValueOnce({
      id: 'src-full',
      status: 'DISCONNECTED',
    });

    const third = await upsertDriveSource({
      modelId: 'm-1',
      folderId: 'folder-xyz',
      folderName: 'Main',
      userId: 'u-1',
    });
    expect(third).toEqual({ sourceId: 'src-full', reactivated: true });
    // create called exactly once across the three operations
    expect(prismaMock.driveSource.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.driveSource.update).toHaveBeenCalledTimes(1);
  });
});
