import { requireSession } from '@/lib/auth-session';
import { getCurrentFilialIds } from '@/lib/current-filial';
import { getMenuAnalytics } from '@/lib/menu-analytics';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await requireSession();
  if (!['admin', 'director', 'manager'].includes(session.role.split(':')[0])) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  const ids = await getCurrentFilialIds();
  if (ids.length === 0) return Response.json({ data: null });

  const sp = new URL(req.url).searchParams;
  const from = sp.get('from');
  const to = sp.get('to');
  if (!from || !to) return Response.json({ error: 'from, to required' }, { status: 400 });

  try {
    const data = await getMenuAnalytics(ids[0], from, to);
    return Response.json({ data });
  } catch (e) {
    return Response.json({ data: null, error: e instanceof Error ? e.message : 'iiko failed' });
  }
}
