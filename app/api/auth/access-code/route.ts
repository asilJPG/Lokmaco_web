import { rateLimit } from '@/lib/rate-limit';
import { setSessionCookie } from '@/lib/auth-session';
import { getUserByAccessCode, getUserPasskeys, getUserFilials, updateLastLogin } from '@/lib/users';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
  const limit = rateLimit(ip);
  if (!limit.allowed) {
    return Response.json(
      { error: `Слишком много попыток. Подождите ${Math.ceil(limit.retryAfterMs / 1000)} сек.` },
      { status: 429 }
    );
  }

  const { code } = await req.json();
  if (!code || String(code).length < 4) {
    limit.increment();
    return Response.json({ error: 'Код должен быть не менее 4 символов' }, { status: 400 });
  }

  const user = await getUserByAccessCode(String(code));
  if (!user) {
    limit.increment();
    return Response.json({ error: 'Пользователь не найден' }, { status: 401 });
  }

  const [baseRole] = (user.role || '').split(':');
  if (baseRole === 'director') {
    const passkeys = await getUserPasskeys(user.id);
    if (passkeys.length > 0) {
      limit.increment();
      return Response.json({ error: 'Используйте Face ID / Touch ID' }, { status: 403 });
    }
  }

  const filialIds = await getUserFilials(user.id);
  await setSessionCookie({ id: user.id, tgId: user.tgId, name: user.name, role: user.role, filialIds });
  await updateLastLogin(user.id, 'access_code').catch(() => {});

  return Response.json({
    success: true,
    user: { id: user.id, name: user.name, role: user.role, filialIds },
  });
}
