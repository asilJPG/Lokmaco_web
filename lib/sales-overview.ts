import { withIikoSession, type IikoCreds } from '@/lib/iiko';
import { resolveIikoCreds } from '@/lib/filial-iiko';

const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export type DayPoint = { date: string; revenue: number; guests: number; orders: number };
export type SharePoint = { name: string; value: number; share: number };
export type HeatCell = { weekday: number; hour: number; value: number };

export type WeakDay = { weekday: number; label: string; avgRevenue: number; gap: number };

export type Kpi = {
  value: number;
  /** Change against the previous period of the same length, %. Null when there is nothing to compare with. */
  deltaPercent: number | null;
};

export type SalesOverview = {
  days: DayPoint[];
  /** Previous period, aligned day-by-day for the comparison line. */
  prevDays: DayPoint[];
  kpi: {
    revenue: Kpi;
    guests: Kpi;
    orders: Kpi;
    avgPerGuest: Kpi;
    avgPerOrder: Kpi;
    revenuePerDay: Kpi;
  };
  categories: SharePoint[];
  payTypes: SharePoint[];
  stores: SharePoint[];
  heatmap: HeatCell[];
  peak: { weekday: number; hour: number; value: number } | null;
  weakDays: WeakDay[];
  /** Money a week gains if the weak weekdays are lifted to the daily average. */
  weakDayPotential: number;
};

const WEEKDAYS = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

// iiko returns weekday names in Russian; map them onto Monday-first indexes.
const WEEKDAY_INDEX: Record<string, number> = {
  'понедельник': 0, 'вторник': 1, 'среда': 2, 'четверг': 3, 'пятница': 4, 'суббота': 5, 'воскресенье': 6,
  'monday': 0, 'tuesday': 1, 'wednesday': 2, 'thursday': 3, 'friday': 4, 'saturday': 5, 'sunday': 6,
};

/** iiko prefixes weekday names with their order — "1. Понедельник". */
function parseWeekday(raw: unknown): number | null {
  const name = String(raw ?? '').replace(/^\s*\d+\s*\.\s*/, '').trim().toLowerCase();
  const idx = WEEKDAY_INDEX[name];
  return idx === undefined ? null : idx;
}

function num(v: unknown): number {
  const n = parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
}

function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 1;
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

function delta(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

type OlapQuery = {
  groupByRowFields: string[];
  aggregateFields: string[];
  from: string;
  to: string;
};

async function olap(token: string, creds: IikoCreds, q: OlapQuery): Promise<Record<string, unknown>[]> {
  // iiko treats the range end as exclusive when includeHigh is false; shifting
  // by a day keeps the last day of the period in the report.
  const res = await fetch(`${creds.server}/resto/api/v2/reports/olap`, {
    method: 'POST',
    headers: { Cookie: `key=${token}`, 'Content-Type': 'application/json', 'User-Agent': BROWSER_UA },
    body: JSON.stringify({
      reportType: 'SALES',
      buildSummary: 'false',
      groupByRowFields: q.groupByRowFields,
      groupByColFields: [],
      aggregateFields: q.aggregateFields,
      filters: {
        'OpenDate.Typed': {
          filterType: 'DateRange',
          periodType: 'CUSTOM',
          from: q.from,
          to: shiftDate(q.to, 1),
          includeLow: 'true',
          includeHigh: 'false',
        },
        DeletedWithWriteoff: { filterType: 'ExcludeValues', values: ['DELETED_WITHOUT_WRITEOFF'] },
      },
    }),
  });
  if (!res.ok) throw new Error(`iiko olap ${res.status}`);
  const json = await res.json();
  return (json.data ?? []) as Record<string, unknown>[];
}

function toDayPoints(rows: Record<string, unknown>[]): DayPoint[] {
  return rows
    .map((r) => ({
      date: String(r['OpenDate.Typed'] ?? '').slice(0, 10),
      revenue: num(r.DishDiscountSumInt),
      guests: num(r.GuestNum),
      orders: num(r['UniqOrderId.OrdersCount']),
    }))
    .filter((d) => d.date)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function toShare(rows: Record<string, unknown>[], key: string): SharePoint[] {
  const total = rows.reduce((s, r) => s + num(r.DishDiscountSumInt), 0);
  return rows
    .map((r) => {
      const value = num(r.DishDiscountSumInt);
      return {
        name: String(r[key] ?? '—') || '—',
        value,
        share: total > 0 ? (value / total) * 100 : 0,
      };
    })
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);
}

export async function getSalesOverview(filialId: number, from: string, to: string): Promise<SalesOverview> {
  const { xml: creds } = await resolveIikoCreds(filialId);

  const length = daysBetween(from, to);
  const prevTo = shiftDate(from, -1);
  const prevFrom = shiftDate(prevTo, -(length - 1));

  return withIikoSession(async (token) => {
    const dayFields = ['DishDiscountSumInt', 'GuestNum', 'UniqOrderId.OrdersCount'];
    const [dayRows, prevRows, heatRows, groupRows, payRows, storeRows] = await Promise.all([
      olap(token, creds, { groupByRowFields: ['OpenDate.Typed'], aggregateFields: dayFields, from, to }),
      olap(token, creds, { groupByRowFields: ['OpenDate.Typed'], aggregateFields: dayFields, from: prevFrom, to: prevTo }),
      olap(token, creds, { groupByRowFields: ['DayOfWeekOpen', 'HourOpen'], aggregateFields: ['DishAmountInt'], from, to }),
      // DishGroup, not DishCategory: accounting categories are optional in iiko
      // and go unused here, while every dish belongs to a menu group.
      olap(token, creds, { groupByRowFields: ['DishGroup'], aggregateFields: ['DishDiscountSumInt'], from, to }),
      olap(token, creds, { groupByRowFields: ['PayTypes'], aggregateFields: ['DishDiscountSumInt'], from, to }),
      olap(token, creds, { groupByRowFields: ['Store.Name'], aggregateFields: ['DishDiscountSumInt'], from, to }),
    ]);

    const days = toDayPoints(dayRows);
    const prevDays = toDayPoints(prevRows);

    const sum = (list: DayPoint[], pick: (d: DayPoint) => number) => list.reduce((s, d) => s + pick(d), 0);
    const revenue = sum(days, (d) => d.revenue);
    const guests = sum(days, (d) => d.guests);
    const orders = sum(days, (d) => d.orders);
    const prevRevenue = sum(prevDays, (d) => d.revenue);
    const prevGuests = sum(prevDays, (d) => d.guests);
    const prevOrders = sum(prevDays, (d) => d.orders);

    // Averaged over days that actually had sales — closed days would otherwise
    // drag the figure down and make periods of different length incomparable.
    const activeDays = days.filter((d) => d.revenue > 0).length || 1;
    const prevActiveDays = prevDays.filter((d) => d.revenue > 0).length || 1;

    const avgPerGuest = guests > 0 ? revenue / guests : 0;
    const avgPerOrder = orders > 0 ? revenue / orders : 0;
    const prevAvgPerGuest = prevGuests > 0 ? prevRevenue / prevGuests : 0;
    const prevAvgPerOrder = prevOrders > 0 ? prevRevenue / prevOrders : 0;

    const heatmap: HeatCell[] = [];
    for (const r of heatRows) {
      const weekday = parseWeekday(r.DayOfWeekOpen);
      if (weekday === null) continue;
      const hour = parseInt(String(r.HourOpen ?? '').slice(0, 2), 10);
      if (!Number.isFinite(hour)) continue;
      heatmap.push({ weekday, hour, value: num(r.DishAmountInt) });
    }
    const peak = heatmap.length > 0 ? heatmap.reduce((a, b) => (b.value > a.value ? b : a)) : null;

    // Weekday averages expose days that are quietly under-performing; the gap to
    // the overall daily average is what a promotion on those days could recover.
    const byWeekday = new Map<number, { total: number; count: number }>();
    for (const d of days) {
      if (d.revenue <= 0) continue;
      const js = new Date(`${d.date}T00:00:00Z`).getUTCDay();
      const weekday = (js + 6) % 7;
      const acc = byWeekday.get(weekday) || { total: 0, count: 0 };
      acc.total += d.revenue;
      acc.count++;
      byWeekday.set(weekday, acc);
    }
    const dailyAvg = revenue / activeDays;
    const weakDays: WeakDay[] = [...byWeekday.entries()]
      .map(([weekday, acc]) => {
        const avgRevenue = acc.total / acc.count;
        return { weekday, label: WEEKDAYS[weekday], avgRevenue, gap: Math.max(0, dailyAvg - avgRevenue) };
      })
      .filter((w) => w.gap > 0)
      .sort((a, b) => b.gap - a.gap);

    return {
      days,
      prevDays,
      kpi: {
        revenue: { value: revenue, deltaPercent: delta(revenue, prevRevenue) },
        guests: { value: guests, deltaPercent: delta(guests, prevGuests) },
        orders: { value: orders, deltaPercent: delta(orders, prevOrders) },
        avgPerGuest: { value: avgPerGuest, deltaPercent: delta(avgPerGuest, prevAvgPerGuest) },
        avgPerOrder: { value: avgPerOrder, deltaPercent: delta(avgPerOrder, prevAvgPerOrder) },
        revenuePerDay: { value: dailyAvg, deltaPercent: delta(dailyAvg, prevRevenue / prevActiveDays) },
      },
      categories: toShare(groupRows, 'DishGroup'),
      payTypes: toShare(payRows, 'PayTypes'),
      stores: toShare(storeRows, 'Store.Name'),
      heatmap,
      peak,
      weakDays,
      weakDayPotential: weakDays.reduce((s, w) => s + w.gap, 0),
    };
  }, creds);
}
