import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Job } from 'bullmq';

const prismaMock = {
  driveSource: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  driveSync: {
    create: vi.fn(),
    update: vi.fn(),
  },
  contentAsset: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
};

const listFilesMock = vi.fn();
const enqueueDriveSyncMock = vi.fn();
const enqueueAssetAutoTagMock = vi.fn();

vi.mock('@xcrm/db', () => ({
  prisma: prismaMock,
  AssetTagStatus: { PENDING: 'PENDING', TAGGED: 'TAGGED', FAILED: 'FAILED' },
  DriveSyncStatus: { RUNNING: 'RUNNING', SUCCEEDED: 'SUCCEEDED', FAILED: 'FAILED' },
  DriveSourceStatus: { ACTIVE: 'ACTIVE', DISCONNECTED: 'DISCONNECTED' },
}));

vi.mock('@xcrm/drive-adapter', () => ({
  listFiles: listFilesMock,
  mapMimeToAssetType: (mime: string) => {
    if (mime.startsWith('image/gif')) return 'GIF';
    if (mime.startsWith('image/')) return 'PHOTO';
    if (mime.startsWith('video/')) return 'VIDEO';
    return null;
  },
}));

vi.mock('../enqueue', () => ({
  enqueueDriveSync: enqueueDriveSyncMock,
  enqueueAssetAutoTag: enqueueAssetAutoTagMock,
}));

function makeJob(name: string, data: unknown): Job {
  return { name, data } as unknown as Job;
}

const sampleFile = {
  id: 'file-1',
  name: 'a.jpg',
  mimeType: 'image/jpeg',
  md5Checksum: 'checksum-v1',
  modifiedTime: '2026-04-21T00:00:00Z',
  webContentLink: 'https://drive/x',
  thumbnailLink: 'https://drive/thumb',
  size: 123,
};

describe('driveSyncHandler', () => {
  beforeEach(() => {
    Object.values(prismaMock).forEach((ns) => {
      if (typeof ns === 'function') return;
      Object.values(ns).forEach((fn) => (fn as ReturnType<typeof vi.fn>).mockReset?.());
    });
    prismaMock.$transaction.mockImplementation(async (ops: Promise<unknown>[]) =>
      Promise.all(ops),
    );
    listFilesMock.mockReset();
    enqueueDriveSyncMock.mockReset();
    enqueueAssetAutoTagMock.mockReset();
  });

  it('fan-out enqueues one sync-source per active DriveSource', async () => {
    prismaMock.driveSource.findMany.mockResolvedValue([
      { id: 'src-1' },
      { id: 'src-2' },
      { id: 'src-3' },
    ]);
    const { driveSyncHandler } = await import('./drive-sync');
    const result = (await driveSyncHandler(
      makeJob('recurring:driveSync', {}),
    )) as { enqueued: number };
    expect(result.enqueued).toBe(3);
    expect(enqueueDriveSyncMock).toHaveBeenCalledTimes(3);
    expect(enqueueDriveSyncMock.mock.calls.map((c) => c[0])).toEqual([
      'src-1',
      'src-2',
      'src-3',
    ]);
  });

  it('per-source ingests a new file once and enqueues tagging', async () => {
    prismaMock.driveSource.findUnique.mockResolvedValue({
      id: 'src-1',
      modelId: 'model-1',
      folderId: 'folder-1',
      cursor: null,
      status: "ACTIVE",
    });
    prismaMock.driveSync.create.mockResolvedValue({ id: 'sync-1' });
    listFilesMock.mockResolvedValue({ files: [sampleFile], nextPageToken: null });
    prismaMock.contentAsset.findUnique.mockResolvedValue(null);
    prismaMock.contentAsset.create.mockResolvedValue({ id: 'asset-1' });

    const { driveSyncHandler } = await import('./drive-sync');
    const result = (await driveSyncHandler(
      makeJob('sync-source', { driveSourceId: 'src-1' }),
    )) as { filesSeen: number; filesIngested: number; filesSkipped: number };

    expect(result).toEqual({ filesSeen: 1, filesIngested: 1, filesSkipped: 0 });
    expect(prismaMock.contentAsset.create).toHaveBeenCalledTimes(1);
    expect(enqueueAssetAutoTagMock).toHaveBeenCalledWith('asset-1');
  });

  it('second run against unchanged file skips (idempotent upsert)', async () => {
    prismaMock.driveSource.findUnique.mockResolvedValue({
      id: 'src-1',
      modelId: 'model-1',
      folderId: 'folder-1',
      cursor: null,
      status: "ACTIVE",
    });
    prismaMock.driveSync.create.mockResolvedValue({ id: 'sync-2' });
    listFilesMock.mockResolvedValue({ files: [sampleFile], nextPageToken: null });
    prismaMock.contentAsset.findUnique.mockResolvedValue({
      id: 'asset-1',
      driveChecksum: 'checksum-v1',
      tagStatus: 'TAGGED',
    });

    const { driveSyncHandler } = await import('./drive-sync');
    const result = (await driveSyncHandler(
      makeJob('sync-source', { driveSourceId: 'src-1' }),
    )) as { filesIngested: number; filesSkipped: number };

    expect(result.filesSkipped).toBe(1);
    expect(result.filesIngested).toBe(0);
    expect(prismaMock.contentAsset.create).not.toHaveBeenCalled();
    expect(prismaMock.contentAsset.update).not.toHaveBeenCalled();
    expect(enqueueAssetAutoTagMock).not.toHaveBeenCalled();
  });

  it('checksum change triggers an UPDATE + re-enqueues tagging', async () => {
    prismaMock.driveSource.findUnique.mockResolvedValue({
      id: 'src-1',
      modelId: 'model-1',
      folderId: 'folder-1',
      cursor: null,
      status: "ACTIVE",
    });
    prismaMock.driveSync.create.mockResolvedValue({ id: 'sync-3' });
    listFilesMock.mockResolvedValue({
      files: [{ ...sampleFile, md5Checksum: 'checksum-v2' }],
      nextPageToken: null,
    });
    prismaMock.contentAsset.findUnique.mockResolvedValue({
      id: 'asset-1',
      driveChecksum: 'checksum-v1',
      tagStatus: 'TAGGED',
    });

    const { driveSyncHandler } = await import('./drive-sync');
    const result = (await driveSyncHandler(
      makeJob('sync-source', { driveSourceId: 'src-1' }),
    )) as { filesIngested: number };

    expect(result.filesIngested).toBe(1);
    expect(prismaMock.contentAsset.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.contentAsset.update.mock.calls[0]![0].data.tagStatus).toBe('PENDING');
    expect(enqueueAssetAutoTagMock).toHaveBeenCalledWith('asset-1');
  });

  it('listFiles failure marks the DriveSync FAILED and rethrows', async () => {
    prismaMock.driveSource.findUnique.mockResolvedValue({
      id: 'src-1',
      modelId: 'model-1',
      folderId: 'folder-1',
      cursor: null,
      status: "ACTIVE",
    });
    prismaMock.driveSync.create.mockResolvedValue({ id: 'sync-4' });
    listFilesMock.mockRejectedValue(new Error('Drive 403: no permission'));

    const { driveSyncHandler } = await import('./drive-sync');
    await expect(
      driveSyncHandler(makeJob('sync-source', { driveSourceId: 'src-1' })),
    ).rejects.toThrow('Drive 403');

    const failUpdate = prismaMock.driveSync.update.mock.calls.find(
      (c) => c[0]?.data?.status === 'FAILED',
    );
    expect(failUpdate).toBeTruthy();
    expect(failUpdate![0].data.error).toContain('Drive 403');

    const sourceFailUpdate = prismaMock.driveSource.update.mock.calls.find(
      (c) => c[0]?.data?.lastSyncStatus === 'FAILED',
    );
    expect(sourceFailUpdate).toBeTruthy();
  });

  it('no-ops when source is inactive or deleted', async () => {
    prismaMock.driveSource.findUnique.mockResolvedValue({
      id: 'src-1',
      modelId: 'model-1',
      folderId: 'folder-1',
      cursor: null,
      status: "DISCONNECTED",
    });
    const { driveSyncHandler } = await import('./drive-sync');
    const result = (await driveSyncHandler(
      makeJob('sync-source', { driveSourceId: 'src-1' }),
    )) as { filesSeen: number };
    expect(result.filesSeen).toBe(0);
    expect(prismaMock.driveSync.create).not.toHaveBeenCalled();
  });
});
