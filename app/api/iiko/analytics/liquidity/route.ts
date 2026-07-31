import { canAccess } from '@/lib/access';
import { requireSession } from '@/lib/auth-session';
import { getCurrentFilialIds } from '@/lib/current-filial';
import { getLiquidity } from '@/lib/liquidity';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await requireSession();
  if (!canAccess(session.role, 'analytics.liquidity')) {
    return Response.json({ error: 'Доступ запрещен для вашей роли' }, { status: 403 });
  }
  const ids = await getCurrentFilialIds();
  if (ids.length === 0) return Response.json({ data: null });

  const sp = new URL(req.url).searchParams;
  const windowDays = Math.min(Math.max(Number(sp.get('window')) || 30, 7), 180);
  const normDays = Math.min(Math.max(Number(sp.get('norm')) || 30, 1), 180);

  try {
    const data = await getLiquidity(ids[0], windowDays, normDays);
    return Response.json({ data });
  } catch (e) {
    return Response.json({ data: null, error: e instanceof Error ? e.message : 'iiko failed' });
  }
}
