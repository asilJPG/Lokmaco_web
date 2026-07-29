/**
 * Аналитические скиллы агента.
 *
 * Формулы и маппинги перенесены один в один со старого сайта: повторный вопрос
 * должен давать те же цифры, поэтому расчёты не «улучшаем» без сверки — разные
 * версии одного показателя путают владельца.
 */
import { withIikoSession, type IikoCreds } from '@/lib/iiko';

const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** Посадочные места: зал 39 + VIP 3 + улица 9. График 10:00–23:00. */
export const SEATS = 51;
export const WORK_HOURS = 13;

/**
 * Места приготовления → укрупнённые направления. Владелец подтвердил, что
 * фрукты, пицца и цеха логически входят в «Кухню».
 */
const MAP_PLACE: Record<string, string> = {
  '1.1 Кухня': 'Кухня',
  '1.6 Кухня + Фрукты': 'Кухня',
  '1.4 Фрук': 'Кухня',
  '1.7 Горячий цех': 'Кухня',
  '1.8 Холодный цех': 'Кухня',
  '1.9 Пицца': 'Кухня',
  '1.2 Бар': 'Бар',
  '1.3 Мороженое': 'Мороженое',
};

type Row = Record<string, unknown>;
type Filters = Record<string, unknown>;

const num = (v: unknown): number => {
  const n = parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
};

const str = (v: unknown): string => String(v ?? '');

async function olap(token: string, creds: IikoCreds, body: Record<string, unknown>): Promise<Row[]> {
  const res = await fetch(`${creds.server}/resto/api/v2/reports/olap`, {
    method: 'POST',
    headers: { Cookie: `key=${token}`, 'Content-Type': 'application/json', 'User-Agent': BROWSER_UA },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`OLAP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  return (json?.data ?? []) as Row[];
}

/** SALES-отчёт. Дата-поле — OpenDate.Typed. */
function sales(token: string, creds: IikoCreds, from: string, to: string, groupBy: string[], aggregates: string[]) {
  return olap(token, creds, {
    reportType: 'SALES',
    buildSummary: 'false',
    groupByRowFields: groupBy,
    aggregateFields: aggregates,
    filters: {
      'OpenDate.Typed': { filterType: 'DateRange', periodType: 'CUSTOM', from, to, includeLow: 'true', includeHigh: 'false' },
      DeletedWithWriteoff: { filterType: 'ExcludeValues', values: ['DELETED_WITHOUT_WRITEOFF'] },
    },
  });
}

/** TRANSACTIONS-отчёт. Дата-поле — DateTime.Typed, единственное рабочее. */
function transactions(token: string, creds: IikoCreds, from: string, to: string, groupBy: string[], extraFilters: Filters = {}) {
  return olap(token, creds, {
    reportType: 'TRANSACTIONS',
    buildSummary: 'false',
    groupByRowFields: groupBy,
    aggregateFields: ['Sum.ResignedSum'],
    filters: {
      'DateTime.Typed': { filterType: 'DateRange', periodType: 'CUSTOM', from, to, includeLow: 'true', includeHigh: 'false' },
      ...extraFilters,
    },
  });
}

export type Period = { from: string; to: string };

/** Средний чек, наценка, маржа и food cost по направлениям. */
export async function avgCheckByPlace({ from, to }: Period, creds: IikoCreds) {
  return withIikoSession(async (token) => {
    const rows = await sales(token, creds, from, to,
      ['CookingPlace', 'OpenDate.Typed', 'OrderNum'],
      ['DishDiscountSumInt', 'DishAmountInt', 'ProductCostBase.ProductCost']);

    const places: Record<string, { sum: number; orders: number; dishes: number; cost: number }> = {};
    for (const r of rows) {
      const raw = str(r['CookingPlace']);
      const p = MAP_PLACE[raw] || raw || '(не указано)';
      if (!places[p]) places[p] = { sum: 0, orders: 0, dishes: 0, cost: 0 };
      places[p].sum += num(r['DishDiscountSumInt']);
      places[p].orders += 1;
      places[p].dishes += num(r['DishAmountInt']);
      places[p].cost += num(r['ProductCostBase.ProductCost']);
    }

    const totalRevenue = Object.values(places).reduce((s, v) => s + v.sum, 0);
    const totalCost = Object.values(places).reduce((s, v) => s + v.cost, 0);

    return {
      period: { from, to },
      breakdown: Object.entries(places)
        .filter(([, v]) => v.orders > 0)
        .sort((a, b) => b[1].sum - a[1].sum)
        .map(([place, v]) => ({
          place,
          orders: v.orders,
          revenue: v.sum,
          cost: v.cost,
          avg_check: v.sum / v.orders,
          dishes_per_check: v.dishes / v.orders,
          food_cost_pct: v.sum ? (v.cost / v.sum) * 100 : null,
          markup_pct: v.cost ? ((v.sum - v.cost) / v.cost) * 100 : null,
          margin_pct: v.sum ? ((v.sum - v.cost) / v.sum) * 100 : null,
          revenue_share_pct: totalRevenue ? (v.sum / totalRevenue) * 100 : 0,
        })),
      total: {
        revenue: totalRevenue,
        cost: totalCost,
        food_cost_pct: totalRevenue ? (totalCost / totalRevenue) * 100 : null,
        markup_pct: totalCost ? ((totalRevenue - totalCost) / totalCost) * 100 : null,
        margin_pct: totalRevenue ? ((totalRevenue - totalCost) / totalRevenue) * 100 : null,
      },
      note:
        'Один чек может попадать в несколько направлений (стол заказал и с кухни, и с бара) — ' +
        'чек считается для каждого направления отдельно, поэтому сумма чеков по направлениям ' +
        'больше общего числа чеков.',
    };
  }, creds);
}

/** ⚠️ «Гости» = уникальные (день, OrderNum) = столы/чеки, а не живые люди. */
export async function guestsPerDay({ from, to }: Period, creds: IikoCreds) {
  return withIikoSession(async (token) => {
    const rows = await sales(token, creds, from, to, ['OpenDate.Typed', 'OrderNum'], ['DishDiscountSumInt', 'DishAmountInt']);

    const days: Record<string, { orders: Set<string>; sum: number; dishes: number }> = {};
    for (const r of rows) {
      const day = str(r['OpenDate.Typed']).slice(0, 10);
      if (!day) continue;
      if (!days[day]) days[day] = { orders: new Set(), sum: 0, dishes: 0 };
      days[day].orders.add(str(r['OrderNum']));
      days[day].sum += num(r['DishDiscountSumInt']);
      days[day].dishes += num(r['DishAmountInt']);
    }

    const list = Object.entries(days)
      .map(([day, v]) => ({ day, tables: v.orders.size, revenue: v.sum, dishes: v.dishes }))
      .sort((a, b) => a.tables - b.tables);

    if (list.length === 0) return { period: { from, to }, days_count: 0, error: 'За период данных нет' };

    const n = list.length;
    const totalTables = list.reduce((s, r) => s + r.tables, 0);
    const totalDishes = list.reduce((s, r) => s + r.dishes, 0);
    const totalRevenue = list.reduce((s, r) => s + r.revenue, 0);

    return {
      period: { from, to },
      days_count: n,
      worst: { day: list[0].day, tables: list[0].tables },
      median_tables: list[Math.floor(n / 2)].tables,
      avg_tables: totalTables / n,
      peak: { day: list[n - 1].day, tables: list[n - 1].tables },
      dishes_per_table: totalTables ? totalDishes / totalTables : 0,
      avg_check: totalTables ? totalRevenue / totalTables : 0,
      total_tables: totalTables,
      total_revenue: totalRevenue,
      warning:
        'ВАЖНО: кассиры не пробивают реальное число гостей (95.5% чеков имеют GuestNum=1 по ' +
        'умолчанию). Эти цифры — количество СТОЛОВ (чеков), а не живых людей. Обязательно ' +
        'предупреди об этом в ответе, если пользователь не задал свой коэффициент человек/стол.',
    };
  }, creds);
}

/** Оборачиваемость посадочных мест. */
export async function turnover({ from, to }: Period, creds: IikoCreds) {
  return withIikoSession(async (token) => {
    const rows = await sales(token, creds, from, to, ['OpenDate.Typed', 'OrderNum'], ['DishDiscountSumInt']);

    const days: Record<string, { orders: Set<string>; sum: number }> = {};
    for (const r of rows) {
      const day = str(r['OpenDate.Typed']).slice(0, 10);
      if (!day) continue;
      if (!days[day]) days[day] = { orders: new Set(), sum: 0 };
      days[day].orders.add(str(r['OrderNum']));
      days[day].sum += num(r['DishDiscountSumInt']);
    }

    const list = Object.entries(days)
      .map(([day, v]) => ({ day, tables: v.orders.size, revenue: v.sum }))
      .sort((a, b) => a.tables - b.tables);

    if (list.length === 0) return { period: { from, to }, error: 'За период данных нет' };

    const n = list.length;
    const totalRevenue = list.reduce((s, r) => s + r.revenue, 0);
    const avgTables = list.reduce((s, r) => s + r.tables, 0) / n;

    return {
      period: { from, to },
      days_count: n,
      seats: SEATS,
      work_hours: WORK_HOURS,
      turns_per_seat_avg: avgTables / SEATS,
      turns_per_seat_peak: { day: list[n - 1].day, value: list[n - 1].tables / SEATS },
      turns_per_seat_worst: { day: list[0].day, value: list[0].tables / SEATS },
      tables_per_seat_per_hour: avgTables / SEATS / WORK_HOURS,
      revenue_per_seat_per_day: totalRevenue / n / SEATS,
      revenue_per_seat_period: totalRevenue / SEATS,
    };
  }, creds);
}

/** Выручка и чеки по дням. */
export async function dailyRevenue({ from, to }: Period, creds: IikoCreds) {
  return withIikoSession(async (token) => {
    const rows = await sales(token, creds, from, to, ['OpenDate.Typed', 'OrderNum'], ['DishDiscountSumInt', 'DishAmountInt']);

    const days: Record<string, { sum: number; orders: Set<string>; dishes: number }> = {};
    for (const r of rows) {
      const day = str(r['OpenDate.Typed']).slice(0, 10);
      if (!day) continue;
      if (!days[day]) days[day] = { sum: 0, orders: new Set(), dishes: 0 };
      days[day].sum += num(r['DishDiscountSumInt']);
      days[day].orders.add(str(r['OrderNum']));
      days[day].dishes += num(r['DishAmountInt']);
    }

    const list = Object.keys(days).sort().map((day) => {
      const v = days[day];
      const tables = v.orders.size;
      return { day, tables, dishes: v.dishes, revenue: v.sum, avg_check: tables ? v.sum / tables : 0 };
    });

    const totalRevenue = list.reduce((s, r) => s + r.revenue, 0);
    const totalTables = list.reduce((s, r) => s + r.tables, 0);

    return {
      period: { from, to },
      days: list,
      total: {
        tables: totalTables,
        dishes: list.reduce((s, r) => s + r.dishes, 0),
        revenue: totalRevenue,
        avg_check: totalTables ? totalRevenue / totalTables : 0,
      },
    };
  }, creds);
}

/** Топ блюд по выручке и по количеству. */
export async function topDishes({ from, to, limit = 20 }: Period & { limit?: number }, creds: IikoCreds) {
  return withIikoSession(async (token) => {
    const rows = await sales(token, creds, from, to, ['DishName', 'DishGroup'], ['DishDiscountSumInt', 'DishAmountInt']);

    const mapped = rows.map((r) => ({
      dish: str(r['DishName']),
      group: r['DishGroup'] ? str(r['DishGroup']) : null,
      revenue: num(r['DishDiscountSumInt']),
      amount: num(r['DishAmountInt']),
    }));

    return {
      period: { from, to },
      by_revenue: [...mapped].sort((a, b) => b.revenue - a.revenue).slice(0, limit),
      by_amount: [...mapped].sort((a, b) => b.amount - a.amount).slice(0, limit),
      positions_total: mapped.length,
    };
  }, creds);
}

/** Доходы и расходы по счетам учёта. */
export async function expensesBreakdown({ from, to }: Period, creds: IikoCreds) {
  return withIikoSession(async (token) => {
    const rows = await transactions(token, creds, from, to, ['Account.Type', 'Account.Name']);

    const byType: Record<string, { sum: number; accounts: { name: string; sum: number }[] }> = {};
    for (const r of rows) {
      const type = str(r['Account.Type']) || '(нет)';
      if (!byType[type]) byType[type] = { sum: 0, accounts: [] };
      const val = num(r['Sum.ResignedSum']);
      byType[type].sum += val;
      byType[type].accounts.push({ name: str(r['Account.Name']) || '(без имени)', sum: val });
    }
    for (const t of Object.values(byType)) t.accounts.sort((a, b) => Math.abs(b.sum) - Math.abs(a.sum));

    const pick = (t: string) => byType[t]?.sum || 0;
    const revenue = pick('INCOME');
    const cogs = pick('COST_OF_GOODS_SOLD');
    const expenses = pick('EXPENSES');
    const otherExpenses = pick('OTHER_EXPENSES');

    return {
      period: { from, to },
      by_type: Object.entries(byType)
        .sort((a, b) => Math.abs(b[1].sum) - Math.abs(a[1].sum))
        .map(([type, v]) => ({ type, total: v.sum, accounts: v.accounts })),
      summary: { revenue, cogs, expenses, other_expenses: otherExpenses, profit: revenue - cogs - expenses - otherExpenses },
      warning:
        'Агрегация по TRANSACTIONS может расходиться с суммой по документам. Прецедент: счёт ' +
        '«Налог» агрегацией дал 45 995 700, а пересчётом по документам — 70 246 235 (разница ' +
        '24.3 млн). ПЕРЕД тем как назвать владельцу финальную цифру по спорной статье — ' +
        'обязательно перепроверь её инструментом verify_expense_account.',
    };
  }, creds);
}

/** Пересчёт одной статьи расходов по отдельным документам. */
export async function verifyExpenseAccount({ from, to, account_name }: Period & { account_name: string }, creds: IikoCreds) {
  return withIikoSession(async (token) => {
    const rows = await transactions(token, creds, from, to, ['DateTime.Typed', 'Document'], {
      'Account.Name': { filterType: 'IncludeValues', values: [account_name] },
    });

    const docs = rows
      .map((r) => ({
        date: str(r['DateTime.Typed']).slice(0, 10),
        document: str(r['Document']) || '—',
        sum: num(r['Sum.ResignedSum']),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      period: { from, to },
      account_name,
      documents_count: docs.length,
      documents: docs,
      total: docs.reduce((s, d) => s + d.sum, 0),
      note:
        'Это пересчёт по отдельным документам — более надёжный источник, чем агрегация. ' +
        'Если расходится с expenses_breakdown, покажи владельцу ОБЕ цифры и объясни расхождение.',
    };
  }, creds);
}

/** Сырой OLAP — для разрезов, которых нет в скиллах. */
export async function rawOlap(
  input: { report_type: 'SALES' | 'TRANSACTIONS'; group_by: string[]; aggregate_fields: string[]; extra_filters?: Filters } & Period,
  creds: IikoCreds
) {
  const { report_type, group_by, aggregate_fields, from, to, extra_filters } = input;
  return withIikoSession(async (token) => {
    const dateField = report_type === 'TRANSACTIONS' ? 'DateTime.Typed' : 'OpenDate.Typed';

    const filters: Filters = {
      [dateField]: { filterType: 'DateRange', periodType: 'CUSTOM', from, to, includeLow: 'true', includeHigh: 'false' },
    };
    if (report_type === 'SALES') {
      filters.DeletedWithWriteoff = { filterType: 'ExcludeValues', values: ['DELETED_WITHOUT_WRITEOFF'] };
    }
    if (extra_filters && typeof extra_filters === 'object') Object.assign(filters, extra_filters);

    const rows = await olap(token, creds, {
      reportType: report_type,
      buildSummary: 'false',
      groupByRowFields: group_by,
      aggregateFields: aggregate_fields,
      filters,
    });

    // Отрезаем гигантские выборки, чтобы не сжечь контекст агента.
    const LIMIT = 400;
    return {
      period: { from, to },
      date_field_used: dateField,
      rows_total: rows.length,
      rows: rows.slice(0, LIMIT),
      truncated: rows.length > LIMIT ? `Показаны первые ${LIMIT} из ${rows.length} строк` : null,
    };
  }, creds);
}
