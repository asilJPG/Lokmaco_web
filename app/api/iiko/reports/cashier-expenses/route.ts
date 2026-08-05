import { and, eq, inArray, sql } from 'drizzle-orm';
import { db, schema } from '@/db/client';
import { requireSession } from '@/lib/auth-session';
import { getCurrentFilialIds } from '@/lib/current-filial';
import { canAccess } from '@/lib/access';

export const dynamic = 'force-dynamic';

type Expense = { name?: string; amount?: number | string };

/**
 * Расходы кассира из кассы, сведённые по месяцам: строки — назначение расхода,
 * колонки — месяцы. Порт `app/api/iiko/reports/cashier-expenses/route.js` из
 * легаси; отличие только в источнике — своя БД вместо Supabase REST.
 */
export async function GET(req: Request) {
  const session = await requireSession();
  if (!canAccess(session.role, 'reconciliation')) {
    return Response.json({ error: 'Доступ только для администратора' }, { status: 403 });
  }

  const filialIds = await getCurrentFilialIds();
  if (filialIds.length === 0) return Response.json({ success: true, months: [], items: [] });

  const sp = new URL(req.url).searchParams;
  const from = sp.get('from');
  const to = sp.get('to');

  const dayExpr = sql<string>`coalesce(${schema.botActions.details}->>'selected_date', to_char(${schema.botActions.createdAt} at time zone 'Asia/Tashkent', 'YYYY-MM-DD'))`;

  const rows = await db
    .select({ day: dayExpr, userName: schema.botActions.userName, details: schema.botActions.details })
    .from(schema.botActions)
    .where(and(
      inArray(schema.botActions.filialId, filialIds),
      eq(schema.botActions.actionType, 'cash'),
      from ? sql`${dayExpr} >= ${from}` : sql`true`,
      to ? sql`${dayExpr} <= ${to}` : sql`true`
    ));

  const monthsSet = new Set<string>();
  const items = new Map<string, { name: string; byMonth: Record<string, number>; total: number; entries: { date: string; amount: number; cashier: string | null }[] }>();
  const monthTotals: Record<string, number> = {};
  let grandTotal = 0;
  let entriesCount = 0;

  for (const row of rows) {
    const day = row.day;
    if (!day) continue;
    const month = day.slice(0, 7);
    monthsSet.add(month);

    const details = (row.details || {}) as { expenses?: Expense[]; cashier_name?: string };
    for (const e of Array.isArray(details.expenses) ? details.expenses : []) {
      const amount = parseFloat(String(e?.amount ?? 0)) || 0;
      if (!amount) continue;

      // Названия кассир вбивает руками — «Базар» и «БАЗАР » должны попасть в
      // одну строку, но показываем то написание, что встретилось первым.
      const raw = String(e?.name || '').trim() || '(без названия)';
      const key = raw.toUpperCase().replace(/\s+/g, ' ');

      let item = items.get(key);
      if (!item) {
        item = { name: raw, byMonth: {}, total: 0, entries: [] };
        items.set(key, item);
      }
      item.byMonth[month] = (item.byMonth[month] || 0) + amount;
      item.total += amount;
      item.entries.push({ date: day, amount, cashier: details.cashier_name || row.userName || null });

      monthTotals[month] = (monthTotals[month] || 0) + amount;
      grandTotal += amount;
      entriesCount += 1;
    }
  }

  const list = [...items.values()].sort((a, b) => b.total - a.total);
  for (const it of list) it.entries.sort((a, b) => b.date.localeCompare(a.date));

  return Response.json({
    success: true,
    months: [...monthsSet].sort(),
    items: list,
    month_totals: monthTotals,
    grand_total: grandTotal,
    entries_count: entriesCount,
    distinct_names: list.length,
  });
}
