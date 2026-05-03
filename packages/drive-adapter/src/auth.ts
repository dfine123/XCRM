import { google, type drive_v3 } from 'googleapis';
import { JWT } from 'google-auth-library';

let cached: drive_v3.Drive | null = null;
let cachedJwt: JWT | null = null;
let cachedEmailPrefix: string | null = null;

/**
 * Service-account JSON we expect from `GOOGLE_SERVICE_ACCOUNT_JSON`. The
 * full object has many fields; these are the two we use, plus
 * `client_email` for logging.
 */
type ServiceAccountCreds = {
  client_email: string;
  private_key: string;
};

/**
 * Parse `GOOGLE_SERVICE_ACCOUNT_JSON` into typed creds.
 *
 * We standardise on **plain JSON** going forward, but accept base64-encoded
 * JSON as a fallback so values pasted under the old convention keep working.
 * Detection is "try plain JSON first; if that throws, try base64+JSON".
 *
 * Throws with an actionable message if the env var is missing or neither
 * format parses.
 */
export function parseServiceAccountCreds(): ServiceAccountCreds {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw || raw.trim() === '') {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_JSON is not set. Paste the service-account JSON (plain, minified) into the env var on the ops + worker services.',
    );
  }

  const trimmed = raw.trim();
  let creds: unknown;
  let parsedVia: 'plain' | 'base64';

  // Plain JSON first — that's the canonical format.
  try {
    creds = JSON.parse(trimmed);
    parsedVia = 'plain';
  } catch (plainErr) {
    // Fallback: maybe it's still base64-encoded from the old convention.
    try {
      const decoded = Buffer.from(trimmed, 'base64').toString('utf8');
      creds = JSON.parse(decoded);
      parsedVia = 'base64';
    } catch (b64Err) {
      const plainMsg = plainErr instanceof Error ? plainErr.message : String(plainErr);
      const b64Msg = b64Err instanceof Error ? b64Err.message : String(b64Err);
      throw new Error(
        `GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON (tried plain: "${plainMsg}"; tried base64→JSON: "${b64Msg}"). Paste the service-account JSON as a single minified line.`,
      );
    }
  }

  if (!creds || typeof creds !== 'object') {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON parsed to a non-object value.');
  }
  const c = creds as Record<string, unknown>;
  if (typeof c.client_email !== 'string' || !c.client_email) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is missing client_email.');
  }
  if (typeof c.private_key !== 'string' || !c.private_key) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is missing private_key.');
  }
  // Surface common Railway paste pitfalls early.
  if (!c.private_key.includes('-----BEGIN')) {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_JSON private_key looks malformed (no -----BEGIN header). Paste the full JSON with newlines encoded as \\n, not stripped.',
    );
  }

  if (parsedVia === 'base64') {
    console.log(
      '[drive-adapter] parsed GOOGLE_SERVICE_ACCOUNT_JSON as base64 (legacy). Plain JSON is the canonical format — consider re-pasting the raw JSON to simplify future rotations.',
    );
  }

  return { client_email: c.client_email, private_key: c.private_key };
}

/**
 * Build an authenticated Drive v3 client using a service-account JSON
 * supplied via GOOGLE_SERVICE_ACCOUNT_JSON.
 */
export function getDriveClient(): drive_v3.Drive {
  if (cached) return cached;

  const creds = parseServiceAccountCreds();

  const auth = new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  cached = google.drive({ version: 'v3', auth });
  cachedJwt = auth;

  // Log just enough to verify the right key loaded. The prefix is not a
  // secret — service-account emails are already visible on the folder's
  // share list — but we cap at 20 chars to stay conservative.
  cachedEmailPrefix = creds.client_email.slice(0, 20);
  console.log(
    `[drive-adapter] auth loaded — client_email starts with "${cachedEmailPrefix}…" (length ${creds.client_email.length})`,
  );

  return cached;
}

/**
 * Returns the JWT credential the Drive client uses, building it lazily
 * if needed. Exposed so callers (like the thumbnail-fetch helper) can
 * make raw HTTP requests against Google endpoints — `lh3.googleusercontent.com`
 * for thumbnailLink in particular — that aren't covered by the typed
 * Drive v3 SDK methods.
 */
export function getDriveJwt(): JWT {
  if (!cachedJwt) {
    // Force the cached pair to populate together.
    getDriveClient();
  }
  return cachedJwt!;
}

/**
 * Parse-only validation of the env var. Safe to call at server startup
 * (from apps/ops/src/instrumentation.ts) so misconfigurations surface in
 * Deploy Logs before the first "Sync now" click — no JWT construction,
 * no Google network call.
 */
export function validateServiceAccountEnv(): void {
  try {
    const creds = parseServiceAccountCreds();
    const prefix = creds.client_email.slice(0, 20);
    console.log(
      `[drive-adapter] env validated — GOOGLE_SERVICE_ACCOUNT_JSON ok, client_email starts with "${prefix}…"`,
    );
  } catch (err) {
    console.error(
      `[drive-adapter] env validation FAILED:`,
      err instanceof Error ? err.message : String(err),
    );
  }
}
