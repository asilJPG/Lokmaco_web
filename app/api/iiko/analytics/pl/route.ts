import { canAccess } from '@/lib/access';
import { withIikoSession } from '@/lib/iiko';
import { requireSession } from '@/lib/auth-session';
import { getCurrentFilialIds } from '@/lib/current-filial';
import { resolveIikoCreds } from '@/lib/filial-iiko';

export const dynamic = 'force-dynamic';

type OlapSalesRow = { DishDiscountSumInt?: string | number };
type OlapTransRow = { 'Account.Name'?: string; 'Account.Type'?: string; Document?: string; 'Sum.ResignedSum'?: string | number };

export async function GET(req: Request) {
  const session = await requireSession();
  if (!canAccess(session.role, 'analytics.pl')) {
    return Response.json({ error: 'Доступ запрещен для вашей роли' }, { status: 403 });
  }
  const ids = await getCurrentFilialIds();
  if (ids.length === 0) return Response.json({ data: null });

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
    const data = await withIikoSession(async (token) => {
      const dateFilter = {
        filterType: 'DateRange',
        periodType: 'CUSTOM',
        from,
        to: toNext,
        includeLow: 'true',
        includeHigh,
      };

      const [salesRes, transRes] = await Promise.all([
        fetch(`${creds.server}/resto/api/v2/reports/olap`, {
          method: 'POST',
          headers: { Cookie: `key=${token}`, 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
          body: JSON.stringify({
            reportType: 'SALES',
            buildSummary: 'true',
            groupByRowFields: [],
            groupByColFields: [],
            aggregateFields: ['DishDiscountSumInt'],
            filters: {
              'OpenDate.Typed': dateFilter,
              DeletedWithWriteoff: { filterType: 'ExcludeValues', values: ['DELETED_WITHOUT_WRITEOFF'] },
            },
          }),
        }),
        fetch(`${creds.server}/resto/api/v2/reports/olap`, {
          method: 'POST',
          headers: { Cookie: `key=${token}`, 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
          body: JSON.stringify({
            reportType: 'TRANSACTIONS',
            buildSummary: 'true',
            groupByRowFields: ['Account.Name', 'Account.Type', 'Document'],
            groupByColFields: [],
            aggregateFields: ['Sum.ResignedSum'],
            filters: { 'DateTime.DateTyped': dateFilter },
          }),
        }),
      ]);

      let revenue = 0;
      let cogs = 0;
      let expensesSum = 0;
      const expensesMap = new Map<string, number>();

      if (salesRes.ok) {
        const json = await salesRes.json();
        for (const row of (json.data ?? []) as OlapSalesRow[]) {
          revenue += parseFloat(String(row.DishDiscountSumInt ?? 0));
        }
      }

      if (transRes.ok) {
        const json = await transRes.json();
        for (const row of (json.data ?? []) as OlapTransRow[]) {
          const actType = row['Account.Type'] || '';
          const val = parseFloat(String(row['Sum.ResignedSum'] ?? 0));
          if (actType === 'COST_OF_GOODS_SOLD') {
            cogs += val;
          } else if ((actType === 'EXPENSES' || actType === 'OTHER_EXPENSES') && val > 0) {
            const name = row['Account.Name'] || 'Прочие расходы';
            const doc = row.Document || '';
            if (name === 'Зарплата' && !doc) continue;
            expensesSum += val;
            expensesMap.set(name, (expensesMap.get(name) || 0) + val);
          }
        }
      }

      const expensesDetail = Array.from(expensesMap, ([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount);
      const netProfit = revenue - cogs - expensesSum;
      const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

      return { revenue, cogs, expensesSum, netProfit, margin, expensesDetail };
    }, creds);

    return Response.json({ data });
  } catch (e) {
    return Response.json({ data: null, error: e instanceof Error ? e.message : 'iiko failed' });
  }
}
