import { sql } from 'drizzle-orm';
import { db } from '@/db/client';

export type PnLStats = {
  revenue: number;
  cashierExpenses: number;
  wages: number;
  adminExpenses: number;
  netProfit: number;
  daily: { date: string; revenue: number; expenses: number; wages: number; admin: number }[];
};

export async function getPnLStats(filialIds: number[], from: string, to: string): Promise<PnLStats> {
  if (filialIds.length === 0) {
    return { revenue: 0, cashierExpenses: 0, wages: 0, adminExpenses: 0, netProfit: 0, daily: [] };
  }

  const filialFilter = sql`filial_id in (${sql.join(filialIds.map((id) => sql`${id}`), sql`, `)})`;
  const dateExpr = sql<string>`coalesce(details->>'selected_date', to_char(created_at at time zone 'Asia/Tashkent', 'YYYY-MM-DD'))`;

  const rows = (await db.execute(sql`
    select
      ${dateExpr} as date,
      sum(case when action_type='cash' then (details->>'total_sales')::numeric else 0 end)::bigint as revenue,
      sum(case when action_type='cash' then (details->>'total_expenses')::numeric else 0 end)::bigint as cashier_expenses,
      sum(case when action_type='cash' then (
        select coalesce(sum((w->>'wage')::numeric),0)
        from jsonb_array_elements(coalesce(details->'employee_wages','[]'::jsonb)) as w
      ) else 0 end)::bigint as wages,
      sum(case when action_type='admin_expense' then (details->>'amount')::numeric else 0 end)::bigint as admin
    from bot_actions
    where ${filialFilter} and ${dateExpr} between ${from} and ${to}
    group by ${dateExpr}
    order by date desc
  `)) as unknown as { rows: { date: string; revenue: string; cashier_expenses: string; wages: string; admin: string }[] };

  const daily = rows.rows.map((r) => ({
    date: r.date,
    revenue: Number(r.revenue),
    expenses: Number(r.cashier_expenses),
    wages: Number(r.wages),
    admin: Number(r.admin),
  }));

  const revenue = daily.reduce((s, d) => s + d.revenue, 0);
  const cashierExpenses = daily.reduce((s, d) => s + d.expenses, 0);
  const wages = daily.reduce((s, d) => s + d.wages, 0);
  const adminExpenses = daily.reduce((s, d) => s + d.admin, 0);

  return {
    revenue,
    cashierExpenses,
    wages,
    adminExpenses,
    netProfit: revenue - cashierExpenses - wages - adminExpenses,
    daily,
  };
}
