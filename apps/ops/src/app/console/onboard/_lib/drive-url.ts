/**
 * Accept a Drive folder URL OR a raw folder ID. Returns the ID or null
 * if we can't parse one.
 *
 * Accepted URL shapes:
 *   https://drive.google.com/drive/folders/<ID>
 *   https://drive.google.com/drive/u/0/folders/<ID>
 *   https://drive.google.com/drive/folders/<ID>?usp=sharing
 *   https://drive.google.com/open?id=<ID>
 *
 * Raw IDs: anything 10+ chars of [A-Za-z0-9_-] with no slashes/spaces.
 */
export function parseDriveFolderId(input: string): string | null {
  const s = input.trim();
  if (!s) return null;

  const folderMatch = s.match(/\/folders\/([A-Za-z0-9_-]+)/);
  if (folderMatch) return folderMatch[1]!;

  const openIdMatch = s.match(/[?&]id=([A-Za-z0-9_-]+)/);
  if (openIdMatch) return openIdMatch[1]!;

  if (/^[A-Za-z0-9_-]{10,}$/.test(s)) return s;

  return null;
}
