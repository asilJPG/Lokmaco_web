import { clearSessionCookie } from '@/lib/auth-session';

export async function POST() {
  clearSessionCookie();
  return Response.json({ ok: true });
}
