import { requireSession } from '@/lib/auth-session';
import { getCurrentFilialIds } from '@/lib/current-filial';
import { resolveIikoCreds } from '@/lib/filial-iiko';
import { withIikoSession, type IikoCreds } from '@/lib/iiko';
import { canAccess } from '@/lib/access';
import { todayTashkent } from '@/lib/period';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function olap(token: string, creds: IikoCreds, body: unknown): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${creds.server}/resto/api/v2/reports/olap`, {
    method: 'POST',
    headers: { Cookie: `key=${token}`, 'Content-Type': 'application/json', 'User-Agent': BROWSER_UA },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`OLAP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return ((await res.json()) as { data?: Record<string, unknown>[] })?.data || [];
}

const dateFilter = (from: string, to: string) => ({
  filterType: 'DateRange',
  periodType: 'CUSTOM',
  from,
  to,
  includeLow: 'true',
  includeHigh: 'false',
});

/**
 * Какие места приготовления кормит каждый склад — база для процента.
 * Склады, которых здесь нет (Основной склад, Заготовочный цех, Посуда, Зал,
 * Хоз товары), обслуживают заведение целиком, поэтому считаются от всей выручки.
 */
const STORE_TO_PLACES: Record<string, string[]> = {
  'Кухня главная': ['1.1 Кухня', '1.3 Мороженое', '1.4 Фрук', '1.6 Кухня + Фрукты'],
  'Кухня подвал': ['1.7 Горячий цех', '1.8 Холодный цех', '1.9 Пицца'],
  Бар: ['1.2 Бар'],
};

/**
 * История инвентаризаций с расхождениями. Порт
 * `app/api/iiko/reports/inventories/route.js` из легаси.
 *
 * ⚠️ Проводки инвентаризации идут двойной записью, поэтому суммировать документ
 * целиком бессмысленно — дебет гасит кредит и выходит ноль. Реальные величины
 * лежат на счетах «Излишки инвентаризации» и «Недостача инвентаризации».
 */
export async function GET(req: Request) {
  const session = await requireSession();
  if (!canAccess(session.role, 'reconciliation')) {
    return Response.json({ error: 'Доступ только для администратора' }, { status: 403 });
  }

  const filialIds = await getCurrentFilialIds();
  if (filialIds.length === 0) return Response.json({ success: true, items: [], totals: null });

  const sp = new URL(req.url).searchParams;
  const from = sp.get('from') || '2026-01-01';
  const to = sp.get('to') || todayTashkent();

  const { xml: creds } = await resolveIikoCreds(filialIds[0]);

  try {
    const data = await withIikoSession(async (token) => {
      const [invRows, salesRows] = await Promise.all([
        olap(token, creds, {
          reportType: 'TRANSACTIONS',
          buildSummary: 'false',
          groupByRowFields: ['DateTime.Typed', 'Document', 'Store', 'Account.Name'],
          aggregateFields: ['Sum.ResignedSum'],
          filters: {
            'DateTime.Typed': dateFilter(from, to),
            TransactionType: { filterType: 'IncludeValues', values: ['INVENTORY_CORRECTION'] },
            'Account.Name': {
              filterType: 'IncludeValues',
              values: ['Излишки инвентаризации', 'Недостача инвентаризации'],
            },
          },
        }),
        olap(token, creds, {
          reportType: 'SALES',
          buildSummary: 'false',
          groupByRowFields: ['CookingPlace', 'OpenDate.Typed'],
          aggregateFields: ['DishDiscountSumInt'],
          filters: {
            'OpenDate.Typed': dateFilter(from, to),
            DeletedWithWriteoff: { filterType: 'ExcludeValues', values: ['DELETED_WITHOUT_WRITEOFF'] },
          },
        }),
      ]);

      const revByMonthPlace: Record<string, Record<string, number>> = {};
      const revByMonthTotal: Record<string, number> = {};
      for (const r of salesRows) {
        const m = String(r['OpenDate.Typed'] || '').slice(0, 7);
        if (!m) continue;
        const place = String(r.CookingPlace || '(не указано)');
        const v = Math.abs(parseFloat(String(r['DishDiscountSumInt'] ?? 0)) || 0);
        revByMonthPlace[m] = revByMonthPlace[m] || {};
        revByMonthPlace[m][place] = (revByMonthPlace[m][place] || 0) + v;
        revByMonthTotal[m] = (revByMonthTotal[m] || 0) + v;
      }

      /** База процента для склада за месяц: выручка его направления, иначе — вся. */
      const baseFor = (store: string, month: string) => {
        const places = STORE_TO_PLACES[store];
        if (!places) return { revenue: revByMonthTotal[month] || 0, scope: 'вся выручка' };
        const byPlace = revByMonthPlace[month] || {};
        return { revenue: places.reduce((s, p) => s + (byPlace[p] || 0), 0), scope: places.join(' + ') };
      };

      const docs = new Map<string, { date: string; document: string; store: string; surplus: number; shortage: number }>();
      for (const r of invRows) {
        const date = String(r['DateTime.Typed'] || '').slice(0, 10);
        const doc = String(r.Document || '—');
        const store = String(r.Store || '—');
        const key = `${date}|${doc}|${store}`;
        let d = docs.get(key);
        if (!d) { d = { date, document: doc, store, surplus: 0, shortage: 0 }; docs.set(key, d); }
        const v = Math.abs(parseFloat(String(r['Sum.ResignedSum'] ?? 0)) || 0);
        if (r['Account.Name'] === 'Излишки инвентаризации') d.surplus += v;
        else d.shortage += v;
      }

      const items = [...docs.values()]
        .map((d) => {
          const month = d.date.slice(0, 7);
          const { revenue, scope } = baseFor(d.store, month);
          return {
            ...d,
            net: d.shortage - d.surplus,
            base_revenue: revenue,
            base_scope: scope,
            surplus_pct: revenue ? (d.surplus / revenue) * 100 : null,
            shortage_pct: revenue ? (d.shortage / revenue) * 100 : null,
          };
        })
        .sort((a, b) => b.date.localeCompare(a.date) || a.store.localeCompare(b.store));

      const totalSurplus = items.reduce((s, i) => s + i.surplus, 0);
      const totalShortage = items.reduce((s, i) => s + i.shortage, 0);
      // Итоговый процент — против суммы баз, а не против общей выручки:
      // склады пересчитываются в разные месяцы и разного объёма.
      const totalBase = items.reduce((s, i) => s + i.base_revenue, 0);

      return {
        period: { from, to },
        items,
        totals: {
          count: items.length,
          surplus: totalSurplus,
          shortage: totalShortage,
          net: totalShortage - totalSurplus,
          base_revenue: totalBase,
          surplus_pct: totalBase ? (totalSurplus / totalBase) * 100 : null,
          shortage_pct: totalBase ? (totalShortage / totalBase) * 100 : null,
        },
      };
    }, creds);

    return Response.json({ success: true, ...data });
  } catch (e) {
    return Response.json({ success: false, error: e instanceof Error ? e.message : 'iiko failed' }, { status: 502 });
  }
}
