import { withIikoSession } from '@/lib/iiko';
import { resolveIikoCreds } from '@/lib/filial-iiko';

const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

type OlapRow = {
  DishCategory?: string;
  DishName?: string;
  DishAmountInt?: string | number;
  DishDiscountSumInt?: string | number;
  'ProductCostBase.ProductCost'?: string | number;
};

export type AbcClass = 'A' | 'B' | 'C';

export type MenuDish = {
  category: string;
  name: string;
  amount: number;
  revenue: number;
  cost: number;
  /** Себестоимость одной порции. */
  costPerItem: number;
  /** Food cost, % от выручки. */
  fcPercent: number;
  profit: number;
  /** Наценка к себестоимости, %. */
  markupPercent: number;
  /** Доля блюда в общей выручке, %. */
  revenueShare: number;
  abc: AbcClass;
};

export type MenuAnalytics = {
  dishes: MenuDish[];
  totals: { revenue: number; cost: number; profit: number; fcPercent: number; dishCount: number };
};

function num(v: unknown): number {
  const n = parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
}

export async function getMenuAnalytics(filialId: number, from: string, to: string): Promise<MenuAnalytics> {
  const { xml: creds } = await resolveIikoCreds(filialId);

  // iiko treats the range end as exclusive when includeHigh is false; shifting
  // by a day keeps the last day of the period in the report.
  let toNext = to;
  let includeHigh = 'true';
  try {
    const d = new Date(to);
    d.setDate(d.getDate() + 1);
    toNext = d.toISOString().slice(0, 10);
    includeHigh = 'false';
  } catch {}

  return withIikoSession(async (token) => {
    const res = await fetch(`${creds.server}/resto/api/v2/reports/olap`, {
      method: 'POST',
      headers: { Cookie: `key=${token}`, 'Content-Type': 'application/json', 'User-Agent': BROWSER_UA },
      body: JSON.stringify({
        reportType: 'SALES',
        buildSummary: 'false',
        groupByRowFields: ['DishCategory', 'DishName'],
        groupByColFields: [],
        aggregateFields: ['DishAmountInt', 'DishDiscountSumInt', 'ProductCostBase.ProductCost'],
        filters: {
          'OpenDate.Typed': { filterType: 'DateRange', periodType: 'CUSTOM', from, to: toNext, includeLow: 'true', includeHigh },
          DeletedWithWriteoff: { filterType: 'ExcludeValues', values: ['DELETED_WITHOUT_WRITEOFF'] },
        },
      }),
    });
    if (!res.ok) throw new Error(`iiko olap ${res.status}`);
    const json = await res.json();

    const dishes: MenuDish[] = [];
    for (const row of (json.data ?? []) as OlapRow[]) {
      const amount = num(row.DishAmountInt);
      const revenue = num(row.DishDiscountSumInt);
      if (amount <= 0) continue;
      const cost = num(row['ProductCostBase.ProductCost']);
      const profit = revenue - cost;
      dishes.push({
        category: row.DishCategory || 'Без категории',
        name: row.DishName || '—',
        amount,
        revenue,
        cost,
        costPerItem: cost / amount,
        // Food cost is meaningless without revenue (e.g. giveaways) — report 0
        // rather than dividing by zero.
        fcPercent: revenue > 0 ? (cost / revenue) * 100 : 0,
        profit,
        markupPercent: cost > 0 ? (profit / cost) * 100 : 0,
        revenueShare: 0,
        abc: 'C',
      });
    }

    dishes.sort((a, b) => b.revenue - a.revenue);

    const totalRevenue = dishes.reduce((s, d) => s + d.revenue, 0);
    const totalCost = dishes.reduce((s, d) => s + d.cost, 0);

    // ABC: dishes are already sorted by revenue, so walking the cumulative share
    // once assigns A to the top 80% of revenue, B to the next 15%.
    let cumulative = 0;
    for (const d of dishes) {
      d.revenueShare = totalRevenue > 0 ? (d.revenue / totalRevenue) * 100 : 0;
      cumulative += d.revenueShare;
      d.abc = cumulative <= 80 ? 'A' : cumulative <= 95 ? 'B' : 'C';
    }

    return {
      dishes,
      totals: {
        revenue: totalRevenue,
        cost: totalCost,
        profit: totalRevenue - totalCost,
        fcPercent: totalRevenue > 0 ? (totalCost / totalRevenue) * 100 : 0,
        dishCount: dishes.length,
      },
    };
  }, creds);
}
