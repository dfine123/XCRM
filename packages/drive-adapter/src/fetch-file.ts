import { getDriveClient } from './auth';

export type FetchFileResult = {
  bytes: Buffer;
  mime: string;
};

/**
 * Download a Drive file's bytes via the Drive API (not the webContentLink,
 * which requires OAuth browser cookies). Service-account auth on the
 * Drive client handles everything.
 */
export async function fetchFileBytes(fileId: string): Promise<FetchFileResult> {
  const drive = getDriveClient();

  const meta = await drive.files.get({
    fileId,
    fields: 'mimeType',
    supportsAllDrives: true,
  });
  const mime = meta.data.mimeType;
  if (!mime) throw new Error(`Drive file ${fileId} has no mimeType`);

  const res = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'arraybuffer' },
  );

  const bytes = Buffer.from(res.data as ArrayBuffer);
  return { bytes, mime };
}
