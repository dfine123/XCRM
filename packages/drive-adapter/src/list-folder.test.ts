import { describe, it, expect, vi, beforeEach } from 'vitest';

const list = vi.fn();

vi.mock('./auth', () => ({
  getDriveClient: () => ({
    files: { list },
  }),
}));

describe('listFiles', () => {
  beforeEach(() => list.mockReset());

  it('filters non-media mimetypes out of the response', async () => {
    list.mockResolvedValue({
      data: {
        nextPageToken: null,
        files: [
          { id: '1', name: 'a.jpg', mimeType: 'image/jpeg', modifiedTime: 't' },
          { id: '2', name: 'b.mp4', mimeType: 'video/mp4', modifiedTime: 't' },
          { id: '3', name: 'c.gif', mimeType: 'image/gif', modifiedTime: 't' },
          { id: '4', name: 'readme.txt', mimeType: 'text/plain', modifiedTime: 't' },
          { id: '5', name: 'missing.jpg', mimeType: 'image/jpeg' }, // no modifiedTime
        ],
      },
    });
    const { listFiles } = await import('./list-folder');
    const result = await listFiles('folder-123');
    expect(result.files).toHaveLength(4);
    expect(result.files.map((f) => f.id)).toEqual(['1', '2', '3', '5']);
    expect(result.nextPageToken).toBeNull();
  });

  it('passes pageToken through', async () => {
    list.mockResolvedValue({ data: { nextPageToken: null, files: [] } });
    const { listFiles } = await import('./list-folder');
    await listFiles('folder-1', { pageToken: 'abc' });
    expect(list.mock.calls[0]![0].pageToken).toBe('abc');
  });

  it('returns nextPageToken for pagination', async () => {
    list.mockResolvedValue({ data: { nextPageToken: 'next-page', files: [] } });
    const { listFiles } = await import('./list-folder');
    const result = await listFiles('folder-1');
    expect(result.nextPageToken).toBe('next-page');
  });

  it('skips files without required fields', async () => {
    list.mockResolvedValue({
      data: {
        nextPageToken: null,
        files: [
          { id: '1', name: 'a.jpg', mimeType: 'image/jpeg', modifiedTime: 't' },
          { id: null, name: 'b.jpg', mimeType: 'image/jpeg', modifiedTime: 't' },
          { id: '3', name: null, mimeType: 'image/jpeg', modifiedTime: 't' },
        ],
      },
    });
    const { listFiles } = await import('./list-folder');
    const result = await listFiles('folder-1');
    expect(result.files.map((f) => f.id)).toEqual(['1']);
  });
});
