import { google, type drive_v3 } from 'googleapis';
import { JWT } from 'google-auth-library';

let cached: drive_v3.Drive | null = null;

/**
 * Build an authenticated Drive v3 client using a service-account JSON
 * supplied via GOOGLE_SERVICE_ACCOUNT_JSON. The env var is a base64
 * encoding of the JSON blob to avoid newline-escape bugs in the
 * private key when pasted into Railway.
 */
export function getDriveClient(): drive_v3.Drive {
  if (cached) return cached;

  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not set');
  }
  const decoded = Buffer.from(raw, 'base64').toString('utf8');
  let creds: { client_email: string; private_key: string };
  try {
    creds = JSON.parse(decoded);
  } catch (e) {
    throw new Error(`GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON: ${(e as Error).message}`);
  }
  if (!creds.client_email || !creds.private_key) {
    throw new Error('Service account JSON missing client_email or private_key');
  }

  const auth = new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  cached = google.drive({ version: 'v3', auth });
  return cached;
}
