import { sql } from 'drizzle-orm';
import { requireSession } from '@/lib/auth-session';
import { getCurrentFilialIds } from '@/lib/current-filial';
import { db } from '@/db/client';

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

  const rows = (await db.execute(sql`
    with wage_items as (
      select
        coalesce(details->>'selected_date', to_char(created_at at time zone 'Asia/Tashkent', 'YYYY-MM-DD')) as date,
        w->>'name' as name,
        (w->>'wage')::numeric as wage
      from bot_actions, jsonb_array_elements(coalesce(details->'employee_wages', '[]'::jsonb)) as w
      where filial_id in (${sql.join(filialIds.map((id) => sql`${id}`), sql`, `)})
        and action_type='cash'
        and coalesce(details->>'selected_date', to_char(created_at at time zone 'Asia/Tashkent', 'YYYY-MM-DD')) between ${from} and ${to}
    )
    select date, name, wage from wage_items order by date desc, name asc
  `)) as unknown as { rows: { date: string; name: string; wage: string }[] };

  const lines = ['Дата;Сотрудник;Сумма'];
  for (const r of rows.rows) {
    lines.push([r.date, r.name, r.wage].map(csvCell).join(';'));
  }

  return new Response('﻿' + lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="wages_${from}_${to}.csv"`,
    },
  });
}
