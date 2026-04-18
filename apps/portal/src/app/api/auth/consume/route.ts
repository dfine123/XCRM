import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@xcrm/db';
import { createSession, hashToken } from '@/lib/session';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('t');
  if (!token) return NextResponse.redirect(new URL('/login', req.url));

  const link = await prisma.agencyMagicLink.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!link || link.usedAt || link.expiresAt < new Date()) {
    return NextResponse.redirect(new URL('/login?error=expired', req.url));
  }

  await prisma.agencyMagicLink.update({
    where: { id: link.id },
    data: { usedAt: new Date() },
  });
  await createSession(link.agencyUserId);
  return NextResponse.redirect(new URL('/overview', req.url));
}
