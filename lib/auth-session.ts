import { cookies } from 'next/headers';
import { verifySession, signSession, type SessionPayload } from './auth';

const COOKIE = 'session_token';

export async function getSession(): Promise<SessionPayload | null> {
  return verifySession(cookies().get(COOKIE)?.value);
}

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
