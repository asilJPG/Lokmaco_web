import { NextResponse, type NextRequest } from 'next/server';
import { verifySession } from '@/lib/auth';

const PUBLIC_API = new Set([
  '/api/auth/passkey/login/options',
  '/api/auth/passkey/login/verify',
  '/api/auth/access-code',
]);

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  if (path.startsWith('/api/')) {
    if (PUBLIC_API.has(path)) return NextResponse.next();
    const session = await verifySession(req.cookies.get('session_token')?.value);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const h = new Headers(req.headers);
    h.set('x-user-id', String(session.id));
    h.set('x-user-role', session.role);
    h.set('x-user-name', encodeURIComponent(session.name));
    h.set('x-user-tg-id', String(session.tgId ?? ''));
    h.set('x-user-filials', session.filialIds.join(','));
    return NextResponse.next({ request: { headers: h } });
  }

  if (path === '/login' || path === '/') return NextResponse.next();

  const session = await verifySession(req.cookies.get('session_token')?.value);
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
