import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { requireSession } from '@/lib/auth-session';
import { getCurrentFilialIds } from '@/lib/current-filial';
import { db, schema } from '@/db/client';

export const dynamic = 'force-dynamic';

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: Request) {
  await requireSession();
  const filialIds = await getCurrentFilialIds();
  const sp = new URL(req.url).searchParams;
  const from = sp.get('from') || '1970-01-01';
  const to = sp.get('to') || '9999-12-31';

  if (filialIds.length === 0) return new Response('', { status: 200 });

  const dateExpr = sql<string>`coalesce(${schema.botActions.details}->>'selected_date', to_char(${schema.botActions.createdAt} at time zone 'Asia/Tashkent', 'YYYY-MM-DD'))`;

  const rows = await db
    .select({
      date: dateExpr,
      documentNumber: schema.botActions.documentNumber,
      userName: schema.botActions.userName,
      cash: sql<string>`(${schema.botActions.details}->'payments'->>'cash')`,
      uzcard: sql<string>`(${schema.botActions.details}->'payments'->>'uzcard')`,
      humo: sql<string>`(${schema.botActions.details}->'payments'->>'humo')`,
      encashment: sql<string>`(${schema.botActions.details}->'payments'->>'encashment')`,
      totalSales: sql<string>`(${schema.botActions.details}->>'total_sales')`,
      totalExpenses: sql<string>`(${schema.botActions.details}->>'total_expenses')`,
      surplus: sql<string>`(${schema.botActions.details}->>'surplus')`,
      shortage: sql<string>`(${schema.botActions.details}->>'shortage')`,
      comment: sql<string>`(${schema.botActions.details}->>'comment')`,
    })
    .from(schema.botActions)
    .where(
      and(
        inArray(schema.botActions.filialId, filialIds),
        eq(schema.botActions.actionType, 'cash'),
        sql`${dateExpr} between ${from} and ${to}`
      )
    )
    .orderBy(desc(dateExpr));

  const header = ['Дата', 'Документ', 'Кассир', 'Наличные', 'Uzcard', 'Humo', 'Инкасса', 'Выручка', 'Расходы', 'Излишек', 'Недостача', 'Комментарий'];
  const lines = [header.join(';')];
  for (const r of rows) {
    lines.push([
      r.date,
      r.documentNumber,
      r.userName,
      r.cash || 0,
      r.uzcard || 0,
      r.humo || 0,
      r.encashment || 0,
      r.totalSales || 0,
      r.totalExpenses || 0,
      r.surplus || 0,
      r.shortage || 0,
      r.comment || '',
    ].map(csvCell).join(';'));
  }

  return new Response('﻿' + lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="history_${from}_${to}.csv"`,
    },
  });
}
