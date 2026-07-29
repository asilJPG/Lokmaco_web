import { withIikoSession } from '@/lib/iiko';
import { requireSession } from '@/lib/auth-session';
import { getCurrentFilialIds } from '@/lib/current-filial';
import { resolveIikoCreds } from '@/lib/filial-iiko';

export const dynamic = 'force-dynamic';

type OlapRow = { DishCategory?: string; DishName?: string; DishAmountInt?: string | number; DishDiscountSumInt?: string | number };

export async function GET(req: Request) {
  const session = await requireSession();
  if (!['admin', 'director', 'manager'].includes(session.role.split(':')[0])) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  const ids = await getCurrentFilialIds();
  if (ids.length === 0) return Response.json({ data: [] });

  const sp = new URL(req.url).searchParams;
  const from = sp.get('from');
  const to = sp.get('to');
  if (!from || !to) return Response.json({ error: 'from, to required' }, { status: 400 });

  const { xml: creds } = await resolveIikoCreds(ids[0]);

  let toNext = to;
  let includeHigh = 'true';
  try {
    const d = new Date(to);
    d.setDate(d.getDate() + 1);
    toNext = d.toISOString().slice(0, 10);
    includeHigh = 'false';
  } catch {}

  try {
    const categories = await withIikoSession(async (token) => {
      const res = await fetch(`${creds.server}/resto/api/v2/reports/olap`, {
        method: 'POST',
        headers: { Cookie: `key=${token}`, 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
        body: JSON.stringify({
          reportType: 'SALES',
          buildSummary: 'true',
          groupByRowFields: ['DishCategory', 'DishName'],
          groupByColFields: [],
          aggregateFields: ['DishAmountInt', 'DishDiscountSumInt'],
          filters: {
            'OpenDate.Typed': { filterType: 'DateRange', periodType: 'CUSTOM', from, to: toNext, includeLow: 'true', includeHigh },
            DeletedWithWriteoff: { filterType: 'ExcludeValues', values: ['DELETED_WITHOUT_WRITEOFF'] },
          },
        }),
      });
      if (!res.ok) return [];
      const json = await res.json();
      const map = new Map<string, { name: string; amount: number; revenue: number }[]>();
      for (const row of (json.data ?? []) as OlapRow[]) {
        const cat = row.DishCategory || 'Без категории';
        const amount = parseFloat(String(row.DishAmountInt ?? 0));
        const revenue = parseFloat(String(row.DishDiscountSumInt ?? 0));
        if (amount > 0) {
          const arr = map.get(cat) || [];
          arr.push({ name: row.DishName || '—', amount, revenue });
          map.set(cat, arr);
        }
      }
      const list = [];
      for (const [name, dishes] of map) {
        dishes.sort((a, b) => b.amount - a.amount);
        const totalRevenue = dishes.reduce((s, d) => s + d.revenue, 0);
        const totalAmount = dishes.reduce((s, d) => s + d.amount, 0);
        list.push({ name, totalRevenue, totalAmount, dishes });
      }
      list.sort((a, b) => b.totalRevenue - a.totalRevenue);
      return list;
    }, creds);

    return Response.json({ data: categories });
  } catch (e) {
    return Response.json({ data: [], error: e instanceof Error ? e.message : 'iiko failed' });
  }
}
