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

/** How far a dish's food cost sits above the target. */
export type FcSeverity = 'ok' | 'above' | 'critical' | 'urgent';

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
  /** ABC по выручке. */
  abc: AbcClass;
  /** ABC по количеству проданных порций. */
  abcAmount: AbcClass;
  /** ABC по прибыли. */
  abcProfit: AbcClass;
  severity: FcSeverity;
  /** Сколько денег вернётся, если довести food cost до целевого. */
  potential: number;
};

export type MenuAnalytics = {
  dishes: MenuDish[];
  totals: { revenue: number; cost: number; profit: number; fcPercent: number; dishCount: number };
  /** Целевой food cost, от которого считается потенциал. */
  targetFc: number;
  /** Суммарный потенциал по всем блюдам выше цели. */
  totalPotential: number;
  /** Топ-5 блюд по потенциалу — с них начинать. */
  topPotential: MenuDish[];
  severityBuckets: { severity: FcSeverity; count: number; revenue: number }[];
};

function num(v: unknown): number {
  const n = parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Assigns A/B/C by cumulative share of `pick`, Pareto-style: A covers the top
 * 80%, B the next 15%, C the tail.
 */
function classifyAbc(dishes: MenuDish[], pick: (d: MenuDish) => number, assign: (d: MenuDish, c: AbcClass) => void): void {
  const total = dishes.reduce((s, d) => s + Math.max(0, pick(d)), 0);
  if (total <= 0) {
    for (const d of dishes) assign(d, 'C');
    return;
  }
  let cumulative = 0;
  for (const d of [...dishes].sort((a, b) => pick(b) - pick(a))) {
    cumulative += (Math.max(0, pick(d)) / total) * 100;
    assign(d, cumulative <= 80 ? 'A' : cumulative <= 95 ? 'B' : 'C');
  }
}

function severityOf(fcPercent: number, targetFc: number): FcSeverity {
  const over = fcPercent - targetFc;
  if (over <= 0) return 'ok';
  if (over <= 5) return 'above';
  if (over <= 15) return 'critical';
  return 'urgent';
}

export async function getMenuAnalytics(filialId: number, from: string, to: string, targetFc = 25): Promise<MenuAnalytics> {
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
        abcAmount: 'C',
        abcProfit: 'C',
        severity: 'ok',
        potential: 0,
      });
    }

    dishes.sort((a, b) => b.revenue - a.revenue);

    const totalRevenue = dishes.reduce((s, d) => s + d.revenue, 0);
    const totalCost = dishes.reduce((s, d) => s + d.cost, 0);

    for (const d of dishes) {
      d.revenueShare = totalRevenue > 0 ? (d.revenue / totalRevenue) * 100 : 0;
      d.severity = severityOf(d.fcPercent, targetFc);
      // Money that comes back if this dish is brought down to the target food
      // cost — the share of its revenue currently eaten by the excess.
      d.potential = d.fcPercent > targetFc ? d.revenue * ((d.fcPercent - targetFc) / 100) : 0;
    }

    // A dish can be a bestseller by count yet a laggard by profit, so all three
    // rankings are reported rather than revenue alone.
    classifyAbc(dishes, (d) => d.revenue, (d, c) => { d.abc = c; });
    classifyAbc(dishes, (d) => d.amount, (d, c) => { d.abcAmount = c; });
    classifyAbc(dishes, (d) => d.profit, (d, c) => { d.abcProfit = c; });

    const severities: FcSeverity[] = ['urgent', 'critical', 'above', 'ok'];
    const severityBuckets = severities.map((severity) => {
      const rows = dishes.filter((d) => d.severity === severity);
      return { severity, count: rows.length, revenue: rows.reduce((s, d) => s + d.revenue, 0) };
    });

    return {
      dishes,
      totals: {
        revenue: totalRevenue,
        cost: totalCost,
        profit: totalRevenue - totalCost,
        fcPercent: totalRevenue > 0 ? (totalCost / totalRevenue) * 100 : 0,
        dishCount: dishes.length,
      },
      targetFc,
      totalPotential: dishes.reduce((s, d) => s + d.potential, 0),
      topPotential: [...dishes].sort((a, b) => b.potential - a.potential).filter((d) => d.potential > 0).slice(0, 5),
      severityBuckets,
    };
  }, creds);
}
