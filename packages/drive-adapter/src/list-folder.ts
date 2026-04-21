import { getDriveClient } from './auth';
import { mapMimeToAssetType, type DriveFile } from './types';

export type ListFilesOptions = {
  pageToken?: string;
  /** Page size for the underlying Drive API. Default 100, max 1000. */
  pageSize?: number;
};

export type ListFilesResult = {
  files: DriveFile[];
  nextPageToken: string | null;
};

const FIELDS =
  'nextPageToken, files(id, name, mimeType, md5Checksum, modifiedTime, webContentLink, thumbnailLink, size)';

/**
 * List images and videos in a Drive folder, paginating through the Drive
 * API. Returns the caller's own pageToken for next call — we persist that
 * on `DriveSource.cursor`.
 *
 * Filters to image/* and video/* mimes. Non-media and trashed files are
 * skipped server-side.
 */
export async function listFiles(
  folderId: string,
  options: ListFilesOptions = {},
): Promise<ListFilesResult> {
  const drive = getDriveClient();
  const q = [
    `'${folderId}' in parents`,
    `trashed = false`,
    `(mimeType contains 'image/' or mimeType contains 'video/')`,
  ].join(' and ');

  const res = await drive.files.list({
    q,
    fields: FIELDS,
    pageSize: options.pageSize ?? 100,
    pageToken: options.pageToken,
    orderBy: 'modifiedTime desc',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const rawFiles = res.data.files ?? [];
  const files: DriveFile[] = [];
  for (const f of rawFiles) {
    if (!f.id || !f.name || !f.mimeType) continue;
    if (mapMimeToAssetType(f.mimeType) === null) continue;
    files.push({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      md5Checksum: f.md5Checksum ?? null,
      modifiedTime: f.modifiedTime ?? new Date(0).toISOString(),
      webContentLink: f.webContentLink ?? null,
      thumbnailLink: f.thumbnailLink ?? null,
      size: f.size ? Number(f.size) : null,
    });
  }

  return {
    files,
    nextPageToken: res.data.nextPageToken ?? null,
  };
}
