import { sql } from 'drizzle-orm';
import { db } from '@/db/client';

export type WagesStats = {
  periodTotalPaid: number;
  avgDailyPaid: number;
  daysCount: number;
  latestWageDate: string | null;
  days: { date: string; total: number; count: number }[];
  byEmployee: { name: string; total: number; days: number }[];
};

export async function getWagesStats(filialIds: number[], from: string, to: string): Promise<WagesStats> {
  if (filialIds.length === 0) {
    return { periodTotalPaid: 0, avgDailyPaid: 0, daysCount: 0, latestWageDate: null, days: [], byEmployee: [] };
  }

  const filialFilter = sql`filial_id in (${sql.join(filialIds.map((id) => sql`${id}`), sql`, `)})`;
  const dateExpr = sql<string>`coalesce(details->>'selected_date', to_char(created_at at time zone 'Asia/Tashkent', 'YYYY-MM-DD'))`;

  const daysRows = (await db.execute(sql`
    with wage_items as (
      select
        ${dateExpr} as date,
        (w->>'wage')::numeric as wage,
        w->>'name' as name
      from bot_actions, jsonb_array_elements(coalesce(details->'employee_wages', '[]'::jsonb)) as w
      where ${filialFilter} and action_type='cash'
        and ${dateExpr} between ${from} and ${to}
    )
    select date, sum(wage)::bigint as total, count(*)::int as count
    from wage_items
    group by date
    order by date desc
  `)) as unknown as { rows: { date: string; total: string; count: number }[] };

  const days = daysRows.rows.map((r) => ({
    date: r.date,
    total: Number(r.total),
    count: Number(r.count),
  }));

  const employeeRows = (await db.execute(sql`
    with wage_items as (
      select
        w->>'name' as name,
        ${dateExpr} as date,
        (w->>'wage')::numeric as wage
      from bot_actions, jsonb_array_elements(coalesce(details->'employee_wages', '[]'::jsonb)) as w
      where ${filialFilter} and action_type='cash'
        and ${dateExpr} between ${from} and ${to}
    )
    select name, sum(wage)::bigint as total, count(distinct date)::int as days
    from wage_items
    group by name
    order by total desc
  `)) as unknown as { rows: { name: string; total: string; days: number }[] };

  const byEmployee = employeeRows.rows.map((r) => ({
    name: r.name,
    total: Number(r.total),
    days: Number(r.days),
  }));

  const latestRows = (await db.execute(sql`
    select max(${dateExpr}) as last_date
    from bot_actions
    where ${filialFilter} and action_type='cash' and jsonb_array_length(coalesce(details->'employee_wages','[]'::jsonb)) > 0
  `)) as unknown as { rows: { last_date: string | null }[] };

  const periodTotal = days.reduce((s, d) => s + d.total, 0);

  return {
    periodTotalPaid: periodTotal,
    daysCount: days.length,
    avgDailyPaid: days.length > 0 ? Math.round(periodTotal / days.length) : 0,
    latestWageDate: latestRows.rows[0]?.last_date ?? null,
    days,
    byEmployee,
  };
}
