import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Job } from 'bullmq';

const prismaMock = {
  contentAsset: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
};

const fetchFileBytesMock = vi.fn();
const tagAssetMock = vi.fn();

vi.mock('@xcrm/db', () => ({
  prisma: prismaMock,
  AssetTagStatus: { PENDING: 'PENDING', TAGGED: 'TAGGED', FAILED: 'FAILED' },
}));

vi.mock('@xcrm/drive-adapter', () => ({
  fetchFileBytes: fetchFileBytesMock,
  isTaggableImageMime: (mime: string) =>
    ['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(mime),
}));

vi.mock('@xcrm/ai', () => ({
  tagAsset: tagAssetMock,
}));

function makeJob(opts: { assetId: string; attemptsMade?: number; attempts?: number }): Job {
  return {
    name: 'tag-asset',
    data: { assetId: opts.assetId },
    attemptsMade: opts.attemptsMade ?? 0,
    opts: { attempts: opts.attempts ?? 3 },
  } as unknown as Job;
}

describe('assetAutoTaggerHandler', () => {
  beforeEach(() => {
    prismaMock.contentAsset.findUnique.mockReset();
    prismaMock.contentAsset.update.mockReset();
    fetchFileBytesMock.mockReset();
    tagAssetMock.mockReset();
  });

  it('tags an image asset and flips tagStatus TAGGED', async () => {
    prismaMock.contentAsset.findUnique.mockResolvedValue({
      id: 'asset-1',
      driveFileId: 'file-1',
      tagStatus: 'PENDING',
      deletedAt: null,
    });
    fetchFileBytesMock.mockResolvedValue({
      bytes: Buffer.from('fake'),
      mime: 'image/jpeg',
    });
    tagAssetMock.mockResolvedValue({
      setting: 'beach',
      nsfwRating: 'SFW',
    });

    const { assetAutoTaggerHandler } = await import('./asset-auto-tagger');
    const result = await assetAutoTaggerHandler(makeJob({ assetId: 'asset-1' }));

    expect(result).toEqual({ tagged: true });
    expect(prismaMock.contentAsset.update).toHaveBeenCalledWith({
      where: { id: 'asset-1' },
      data: { tagStatus: 'TAGGED', autoTags: { setting: 'beach', nsfwRating: 'SFW' } },
    });
  });

  it('skips non-taggable mimes (video) with empty autoTags + TAGGED', async () => {
    prismaMock.contentAsset.findUnique.mockResolvedValue({
      id: 'asset-2',
      driveFileId: 'file-2',
      tagStatus: 'PENDING',
      deletedAt: null,
    });
    fetchFileBytesMock.mockResolvedValue({
      bytes: Buffer.from('fake'),
      mime: 'video/mp4',
    });

    const { assetAutoTaggerHandler } = await import('./asset-auto-tagger');
    const result = (await assetAutoTaggerHandler(
      makeJob({ assetId: 'asset-2' }),
    )) as { skipped: string };

    expect(result.skipped).toBe('not-a-taggable-image-mime');
    expect(tagAssetMock).not.toHaveBeenCalled();
    expect(prismaMock.contentAsset.update).toHaveBeenCalledWith({
      where: { id: 'asset-2' },
      data: { tagStatus: 'TAGGED', autoTags: {} },
    });
  });

  it('non-final attempt failure rethrows without flipping FAILED', async () => {
    prismaMock.contentAsset.findUnique.mockResolvedValue({
      id: 'asset-3',
      driveFileId: 'file-3',
      tagStatus: 'PENDING',
      deletedAt: null,
    });
    fetchFileBytesMock.mockRejectedValue(new Error('Drive 500'));

    const { assetAutoTaggerHandler } = await import('./asset-auto-tagger');
    await expect(
      assetAutoTaggerHandler(makeJob({ assetId: 'asset-3', attemptsMade: 0, attempts: 3 })),
    ).rejects.toThrow('Drive 500');
    expect(prismaMock.contentAsset.update).not.toHaveBeenCalled();
  });

  it('final attempt failure flips tagStatus FAILED then rethrows', async () => {
    prismaMock.contentAsset.findUnique.mockResolvedValue({
      id: 'asset-4',
      driveFileId: 'file-4',
      tagStatus: 'PENDING',
      deletedAt: null,
    });
    fetchFileBytesMock.mockRejectedValue(new Error('Drive 500'));

    const { assetAutoTaggerHandler } = await import('./asset-auto-tagger');
    await expect(
      assetAutoTaggerHandler(makeJob({ assetId: 'asset-4', attemptsMade: 2, attempts: 3 })),
    ).rejects.toThrow('Drive 500');
    expect(prismaMock.contentAsset.update).toHaveBeenCalledWith({
      where: { id: 'asset-4' },
      data: { tagStatus: 'FAILED' },
    });
  });

  it('skips when asset is deleted or missing', async () => {
    prismaMock.contentAsset.findUnique.mockResolvedValue(null);
    const { assetAutoTaggerHandler } = await import('./asset-auto-tagger');
    const result = (await assetAutoTaggerHandler(
      makeJob({ assetId: 'asset-gone' }),
    )) as { skipped: string };
    expect(result.skipped).toBe('asset-not-found-or-deleted');
    expect(fetchFileBytesMock).not.toHaveBeenCalled();
  });

  it('skips when asset has no driveFileId (portal upload)', async () => {
    prismaMock.contentAsset.findUnique.mockResolvedValue({
      id: 'asset-5',
      driveFileId: null,
      tagStatus: 'PENDING',
      deletedAt: null,
    });
    const { assetAutoTaggerHandler } = await import('./asset-auto-tagger');
    const result = (await assetAutoTaggerHandler(
      makeJob({ assetId: 'asset-5' }),
    )) as { skipped: string };
    expect(result.skipped).toBe('no-drive-file-id');
    expect(fetchFileBytesMock).not.toHaveBeenCalled();
  });
});
