import { canAccess } from '@/lib/access';
import { requireSession } from '@/lib/auth-session';
import { getCurrentFilialIds } from '@/lib/current-filial';
import { getIngredientPrices } from '@/lib/ingredient-prices';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await requireSession();
  if (!canAccess(session.role, 'analytics.purchases')) {
    return Response.json({ error: 'Доступ запрещен для вашей роли' }, { status: 403 });
  }
  const ids = await getCurrentFilialIds();
  if (ids.length === 0) return Response.json({ data: null });

  const sp = new URL(req.url).searchParams;
  const from = sp.get('from');
  const to = sp.get('to');
  if (!from || !to) return Response.json({ error: 'from, to required' }, { status: 400 });

  const threshold = Number(sp.get('threshold')) || 10;

  try {
    const data = await getIngredientPrices(ids[0], from, to, threshold);
    return Response.json({ data });
  } catch (e) {
    return Response.json({ data: null, error: e instanceof Error ? e.message : 'iiko failed' });
  }
}
