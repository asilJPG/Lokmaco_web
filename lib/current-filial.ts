import { cookies } from 'next/headers';
import { getSession } from './auth-session';

const COOKIE = 'current_filial';

export async function getCurrentFilialIds(): Promise<number[]> {
  const session = await getSession();
  if (!session) return [];
  const raw = cookies().get(COOKIE)?.value;
  if (raw && raw !== 'all') {
    const id = Number(raw);
    if (session.filialIds.includes(id)) return [id];
  }
  return session.filialIds;
}

export async function getCurrentFilialId(): Promise<number | 'all'> {
  const session = await getSession();
  if (!session) return 'all';
  const raw = cookies().get(COOKIE)?.value;
  if (raw && raw !== 'all') {
    const id = Number(raw);
    if (session.filialIds.includes(id)) return id;
  }
  return session.filialIds.length === 1 ? session.filialIds[0] : 'all';
}

export function setCurrentFilialCookie(value: number | 'all') {
  cookies().set(COOKIE, String(value), {
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 3600,
  });
}
