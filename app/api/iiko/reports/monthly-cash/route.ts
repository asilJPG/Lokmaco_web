import { canAccess } from '@/lib/access';
import { sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { withIikoSession } from '@/lib/iiko';
import { requireSession } from '@/lib/auth-session';
import { getCurrentFilialIds } from '@/lib/current-filial';
import { resolveIikoCreds } from '@/lib/filial-iiko';

export const dynamic = 'force-dynamic';

const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const RU_WEEKDAY = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

export type MonthlyCashDay = {
  date: string;
  weekday: string;
  cashGross: number;
  cashFiscal: number;
  humo: number;
  uzcard: number;
  rahmat: number;
  uzum: number;
  yandex: number;
  online: number;
  total: number;
  iikoRevenue: number;
  diff: number;
  hasCash: boolean;
  cashiers: string[];
};

export type MonthlyCashTotals = Omit<MonthlyCashDay, 'date' | 'weekday' | 'hasCash' | 'cashiers'>;

function pad(n: number) { return String(n).padStart(2, '0'); }
function isoDay(y: number, m: number, d: number) { return `${y}-${pad(m)}-${pad(d)}`; }
function daysInMonth(year: number, month: number) { return new Date(year, month, 0).getDate(); }

type CashRow = {
  day: string;
  cash: string; encashment: string; humo: string; uzcard: string;
  rahmat: string; uzum: string; yandex: string; online: string;
  total_expenses: string; cashiers: string[] | null;
};

export async function GET(req: Request) {
  const session = await requireSession();
  if (!canAccess(session.role, 'reconciliation')) {
    return Response.json({ error: 'Доступ запрещен для вашей роли' }, { status: 403 });
  }

  const monthParam = new URL(req.url).searchParams.get('month') || '';
  if (!/^\d{4}-\d{2}$/.test(monthParam)) {
    return Response.json({ error: 'Missing or invalid month parameter (YYYY-MM)' }, { status: 400 });
  }

  const ids = await getCurrentFilialIds();
  if (ids.length === 0) return Response.json({ data: null });

  const [yStr, mStr] = monthParam.split('-');
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10);
  const lastDay = daysInMonth(year, month);
  const dateFrom = isoDay(year, month, 1);
  const dateTo = isoDay(year, month, lastDay);

  // iiko OLAP wants an exclusive upper boundary: includeHigh=false with the
  // next day, otherwise the last day of the month is dropped.
  const dateToNext = (() => {
    const d = new Date(`${dateTo}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().split('T')[0];
  })();

  const filialFilter = sql`filial_id in (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`;
  // The cashier picks the shift date by hand (`selected_date`); only reports
  // saved before that field existed fall back to the row timestamp, and those
  // were written in UTC — same as the legacy site reads them.
  const dayExpr = sql`coalesce(details->>'selected_date', to_char(created_at at time zone 'UTC', 'YYYY-MM-DD'))`;

  const cashRows = ((await db.execute(sql`
    select
      ${dayExpr} as day,
      coalesce(sum((details->'payments'->>'cash')::numeric), 0)::bigint       as cash,
      coalesce(sum((details->'payments'->>'encashment')::numeric), 0)::bigint as encashment,
      coalesce(sum((details->'payments'->>'humo')::numeric), 0)::bigint       as humo,
      coalesce(sum((details->'payments'->>'uzcard')::numeric), 0)::bigint     as uzcard,
      coalesce(sum((details->'payments'->>'rahmat')::numeric), 0)::bigint     as rahmat,
      coalesce(sum((details->'payments'->>'uzum')::numeric), 0)::bigint       as uzum,
      coalesce(sum((details->'payments'->>'yandex')::numeric), 0)::bigint     as yandex,
      coalesce(sum((details->'payments'->>'online')::numeric), 0)::bigint     as online,
      coalesce(sum((details->>'total_expenses')::numeric), 0)::bigint         as total_expenses,
      array_remove(array_agg(distinct coalesce(details->>'cashier_name', user_name)), null) as cashiers
    from bot_actions
    where ${filialFilter}
      and action_type = 'cash'
      and ${dayExpr} between ${dateFrom} and ${dateTo}
    group by 1
  `)) as unknown as { rows: CashRow[] }).rows;

  const cashByDay = new Map(cashRows.map((r) => [r.day, r]));

  // iiko revenue per day — the whole day's sales, not split by payment type.
  let iikoByDay: Record<string, number> = {};
  let iikoError: string | null = null;
  try {
    const { xml: creds } = await resolveIikoCreds(ids[0]);
    iikoByDay = await withIikoSession(async (token) => {
      const res = await fetch(`${creds.server}/resto/api/v2/reports/olap`, {
        method: 'POST',
        headers: { Cookie: `key=${token}`, 'Content-Type': 'application/json', 'User-Agent': BROWSER_UA },
        body: JSON.stringify({
          reportType: 'SALES',
          buildSummary: 'false',
          groupByRowFields: ['OpenDate.Typed'],
          groupByColFields: [],
          aggregateFields: ['DishDiscountSumInt'],
          filters: {
            'OpenDate.Typed': {
              filterType: 'DateRange',
              periodType: 'CUSTOM',
              from: dateFrom,
              to: dateToNext,
              includeLow: 'true',
              includeHigh: 'false',
            },
            DeletedWithWriteoff: { filterType: 'ExcludeValues', values: ['DELETED_WITHOUT_WRITEOFF'] },
          },
        }),
      });
      const map: Record<string, number> = {};
      if (res.ok) {
        const json = await res.json();
        for (const row of (json?.data ?? []) as Record<string, unknown>[]) {
          const day = String(row['OpenDate.Typed'] ?? '').slice(0, 10);
          if (!day) continue;
          map[day] = (map[day] || 0) + Math.abs(parseFloat(String(row['DishDiscountSumInt'] ?? 0)));
        }
      }
      return map;
    }, creds);
  } catch (e) {
    iikoError = e instanceof Error ? e.message : 'iiko failed';
  }

  const days: MonthlyCashDay[] = [];
  for (let d = 1; d <= lastDay; d++) {
    const date = isoDay(year, month, d);
    const weekday = RU_WEEKDAY[new Date(`${date}T00:00:00Z`).getUTCDay()];
    const c = cashByDay.get(date);
    const iikoRevenue = iikoByDay[date] || 0;

    const cashFiscal = Number(c?.cash ?? 0);
    const encashment = Number(c?.encashment ?? 0);
    const expenses = Number(c?.total_expenses ?? 0);
    // «Наличные -» — весь вал нала, прошедший через кассу: фискальный нал +
    // инкассация + расходы, которые кассир оплатил прямо из ящика (базар,
    // такси, аренда). Эти расходы тоже были выручкой налом, просто вышли до
    // сдачи. Проверено на реальных днях: без expenses разница с продажами
    // iiko равна ровно сумме expenses, с ними — нулю.
    const cashGross = cashFiscal + encashment + expenses;

    const humo = Number(c?.humo ?? 0);
    const uzcard = Number(c?.uzcard ?? 0);
    const rahmat = Number(c?.rahmat ?? 0);
    const uzum = Number(c?.uzum ?? 0);
    const yandex = Number(c?.yandex ?? 0);
    const online = Number(c?.online ?? 0);

    const hasCash = !!c;
    const total = hasCash ? cashGross + humo + uzcard + rahmat + uzum + yandex + online : 0;
    const diff = hasCash ? total - iikoRevenue : 0;

    days.push({
      date, weekday, cashGross, cashFiscal, humo, uzcard, rahmat, uzum, yandex, online,
      total, iikoRevenue, diff, hasCash, cashiers: c?.cashiers ?? [],
    });
  }

  const totals = days.reduce<MonthlyCashTotals>((acc, d) => ({
    cashGross: acc.cashGross + d.cashGross,
    cashFiscal: acc.cashFiscal + d.cashFiscal,
    humo: acc.humo + d.humo,
    uzcard: acc.uzcard + d.uzcard,
    rahmat: acc.rahmat + d.rahmat,
    uzum: acc.uzum + d.uzum,
    yandex: acc.yandex + d.yandex,
    online: acc.online + d.online,
    total: acc.total + d.total,
    iikoRevenue: acc.iikoRevenue + d.iikoRevenue,
    diff: acc.diff + d.diff,
  }), { cashGross: 0, cashFiscal: 0, humo: 0, uzcard: 0, rahmat: 0, uzum: 0, yandex: 0, online: 0, total: 0, iikoRevenue: 0, diff: 0 });

  return Response.json(
    { data: { month: monthParam, days, totals }, error: iikoError },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
