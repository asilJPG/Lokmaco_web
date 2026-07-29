import { sql } from 'drizzle-orm';
import { db, schema } from '@/db/client';

export type SafeStats = {
  allTimeBalance: number;
  periodCashIn: number;
  periodAdminExpenses: number;
  daily: { date: string; cashIn: number; expense: number }[];
};

export async function getSafeStats(filialIds: number[], from: string, to: string): Promise<SafeStats> {
  if (filialIds.length === 0) {
    return { allTimeBalance: 0, periodCashIn: 0, periodAdminExpenses: 0, daily: [] };
  }

  const filialFilter = sql`${schema.botActions.filialId} in (${sql.join(filialIds.map((id) => sql`${id}`), sql`, `)})`;
  const dateExpr = sql<string>`coalesce(${schema.botActions.details}->>'selected_date', to_char(${schema.botActions.createdAt} at time zone 'Asia/Tashkent', 'YYYY-MM-DD'))`;

  const allTime = (await db.execute(sql`
    select
      coalesce(sum(case when action_type='cash' then (details->'payments'->>'cash')::numeric end), 0)::bigint as cash_total,
      coalesce(sum(case when action_type='admin_expense' then (details->>'amount')::numeric end), 0)::bigint as admin_total
    from bot_actions
    where ${filialFilter}
      and coalesce(details->>'selected_date', to_char(created_at at time zone 'Asia/Tashkent', 'YYYY-MM-DD')) <= ${to}
  `)) as unknown as { rows: { cash_total: string; admin_total: string }[] };

  const cashTotal = Number(allTime.rows[0]?.cash_total ?? 0);
  const adminTotal = Number(allTime.rows[0]?.admin_total ?? 0);

  const periodRows = (await db.execute(sql`
    select
      ${dateExpr} as date,
      sum(case when action_type='cash' then (details->'payments'->>'cash')::numeric else 0 end)::bigint as cash_in,
      sum(case when action_type='admin_expense' then (details->>'amount')::numeric else 0 end)::bigint as expense
    from bot_actions
    where ${filialFilter}
      and coalesce(details->>'selected_date', to_char(created_at at time zone 'Asia/Tashkent', 'YYYY-MM-DD')) between ${from} and ${to}
    group by ${dateExpr}
    order by date desc
  `)) as unknown as { rows: { date: string; cash_in: string; expense: string }[] };

  const daily = periodRows.rows.map((r) => ({
    date: r.date,
    cashIn: Number(r.cash_in),
    expense: Number(r.expense),
  }));

  return {
    allTimeBalance: cashTotal - adminTotal,
    periodCashIn: daily.reduce((s, d) => s + d.cashIn, 0),
    periodAdminExpenses: daily.reduce((s, d) => s + d.expense, 0),
    daily,
  };
}
