import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { authConfig } from './auth.config';

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = ['/login', '/style', '/api/auth', '/_next', '/favicon.ico'];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return;

  // Any missing piece of the session (auth failure, mis-config, cold JWT)
  // should bounce to /login rather than crash with
  // "cannot read properties of undefined (reading 'role')".
  const role = req.auth?.user?.role;
  if (!role) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  const isVA = role === 'VA_T1' || role === 'VA_T2' || role === 'VA_T3';

  // VAs see only /va/* (spec §2.3).
  if (isVA && !pathname.startsWith('/va')) {
    return NextResponse.redirect(new URL('/va', req.url));
  }
  if (!isVA && pathname.startsWith('/va')) {
    return NextResponse.redirect(new URL('/console', req.url));
  }
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
