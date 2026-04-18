import { cookies } from 'next/headers';
import { prisma } from '@xcrm/db';
import crypto from 'node:crypto';

const SESSION_COOKIE = 'xcrm_portal_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

export interface PortalSession {
  agencyUserId: string;
  agencyId: string;
  email: string;
  name: string;
  role: 'AGENCY_OWNER' | 'AGENCY_STAFF';
}

export async function createSession(agencyUserId: string): Promise<void> {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.agencySession.create({ data: { agencyUserId, token, expiresAt } });
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

export async function currentSession(): Promise<PortalSession | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = await prisma.agencySession.findUnique({
    where: { token },
    include: { agencyUser: true },
  });
  if (!row || row.expiresAt < new Date()) return null;
  const u = row.agencyUser;
  if (u.deletedAt) return null;
  return {
    agencyUserId: u.id,
    agencyId: u.agencyId,
    email: u.email,
    name: u.name,
    role: u.role,
  };
}

export async function destroySession(): Promise<void> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.agencySession.deleteMany({ where: { token } });
  }
  cookies().delete(SESSION_COOKIE);
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
