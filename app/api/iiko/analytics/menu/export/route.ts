import { canAccess } from '@/lib/access';
import { requireSession } from '@/lib/auth-session';
import { getCurrentFilialIds } from '@/lib/current-filial';
import { getMenuAnalytics } from '@/lib/menu-analytics';

export const dynamic = 'force-dynamic';

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function round(n: number): string {
  return String(Math.round(n));
}

export async function GET(req: Request) {
  const session = await requireSession();
  if (!canAccess(session.role, 'analytics.abc')) {
    return Response.json({ error: 'Доступ запрещен для вашей роли' }, { status: 403 });
  }
  const ids = await getCurrentFilialIds();
  const sp = new URL(req.url).searchParams;
  const from = sp.get('from') || '';
  const to = sp.get('to') || '';
  if (ids.length === 0 || !from || !to) return new Response('', { status: 200 });

  const targetFc = Number(sp.get('targetFc')) || 25;
  const data = await getMenuAnalytics(ids[0], from, to, targetFc);

  const lines = ['Блюдо;Категория;ABC шт;ABC выручка;ABC прибыль;Количество;Выручка;Себестоимость;Себест. порции;Food cost %;Наценка %;Прибыль;Доля выручки %;Потенциал'];
  for (const d of data.dishes) {
    lines.push([
      d.name,
      d.category,
      d.abcAmount,
      d.abc,
      d.abcProfit,
      round(d.amount),
      round(d.revenue),
      round(d.cost),
      round(d.costPerItem),
      d.fcPercent.toFixed(1),
      d.markupPercent.toFixed(1),
      round(d.profit),
      d.revenueShare.toFixed(2),
      round(d.potential),
    ].map(csvCell).join(';'));
  }

  return new Response('﻿' + lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="menu_analytics_${from}_${to}.csv"`,
    },
  });
}
