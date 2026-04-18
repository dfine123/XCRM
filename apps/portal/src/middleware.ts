import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC = ['/login', '/api/auth', '/_next', '/favicon.ico'];
const SESSION_COOKIE = 'xcrm_portal_session';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  // Session validity is re-checked server-side on each page render.
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
