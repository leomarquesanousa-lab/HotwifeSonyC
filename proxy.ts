import { NextResponse, type NextRequest } from 'next/server';
import { getSessionFromToken, SESSION_COOKIE_NAME } from '@/src/lib/auth/session';
import { getAdministrativeMembership } from '@/src/lib/auth/admin-access';

export async function proxy(request: NextRequest) {
  const api = request.nextUrl.pathname.startsWith('/api/');
  try {
    const auth = await getSessionFromToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);
    if (!auth) return api
      ? NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
      : NextResponse.redirect(new URL('/login', request.url));
    if (!await getAdministrativeMembership(auth.user.id)) return api
      ? NextResponse.json({ error: 'ADMIN_ACCESS_REQUIRED' }, { status: 403, headers: { 'Cache-Control': 'no-store' } })
      : NextResponse.redirect(new URL('/account', request.url));
    return NextResponse.next();
  } catch {
    return NextResponse.json({ error: 'ACCESS_CHECK_FAILED' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
export const config = {
  matcher: [
    '/app/:path*', '/:locale/app/:path*',
    '/api/admin/:path*', '/api/ai/:path*', '/api/dashboard/:path*',
    '/api/distribution/:path*', '/api/media/:path*', '/api/onboarding/:path*',
    '/api/performer-library/:path*', '/api/performers/:path*',
    '/api/platforms/:path*', '/api/store/:path*',
  ],
};
