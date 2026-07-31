import { cookies } from 'next/headers';
import { verifySession, signSession, type SessionPayload } from './auth';

const COOKIE = 'session_token';

export async function getSession(): Promise<SessionPayload | null> {
  return verifySession(cookies().get(COOKIE)?.value);
}

/**
 * Настоящий заслон от неавторизованных — middleware: он отвечает 401 на любой
 * /api/* без валидной куки, поэтому сюда без сессии не доходят. Бросок ниже —
 * страховка на случай, если matcher в middleware когда-нибудь сузят: Next не
 * перехватывает throw new Response, так что это будет 500, но не пропуск.
 */
export async function requireSession(): Promise<SessionPayload> {
  const s = await getSession();
  if (!s) throw new Response('Unauthorized', { status: 401 });
  return s;
}

export async function setSessionCookie(payload: Omit<SessionPayload, 'exp'>): Promise<void> {
  const token = await signSession(payload);
  cookies().set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 3600,
  });
}

export function clearSessionCookie(): void {
  cookies().delete(COOKIE);
}
