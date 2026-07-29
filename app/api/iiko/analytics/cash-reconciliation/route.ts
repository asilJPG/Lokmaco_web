import { sql } from 'drizzle-orm';
import { db, schema } from '@/db/client';
import { withIikoSession } from '@/lib/iiko';
import { requireSession } from '@/lib/auth-session';
import { getCurrentFilialIds } from '@/lib/current-filial';
import { resolveIikoCreds } from '@/lib/filial-iiko';

export const dynamic = 'force-dynamic';

const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export type PaymentField = 'cash' | 'encashment' | 'uzcard' | 'humo' | 'online' | 'rahmat' | 'uzum' | 'yandex' | 'other';

export type ReconciliationRow = {
  field: PaymentField;
  label: string;
  iikoAmount: number;
  cashierExpenses: number;
  calculatedBalance: number;
  cashierFact: number;
  diff: number;
};

type OlapPayRow = { PayTypes?: string; DishDiscountSumInt?: string | number };

const ROW_DEFS: { field: PaymentField; label: string }[] = [
  { field: 'cash', label: '💵 Наличные' },
  { field: 'encashment', label: '💵 Наличные-' },
  { field: 'uzcard', label: '💳 Uzcard' },
  { field: 'humo', label: '💳 Humo' },
  { field: 'online', label: '📱 Click / Payme' },
  { field: 'rahmat', label: '💳 RAHMAT' },
  { field: 'uzum', label: '💳 Uzum' },
  { field: 'yandex', label: '🛵 Яндекс Еда' },
];

// Maps an iiko PayTypes name to our internal payment field. «Наличные» and
// «Наличные-» are two DISTINCT iiko payment types (fiscal cash register vs.
// the non-fiscal cash channel used for encashment/withdrawals) — they must
// each be compared against their own counterpart in the cashier's report,
// never against each other.
function mapIikoToField(iikoName: string): PaymentField {
  const name = iikoName.toLowerCase();
  if ((name.includes('нал') || name.includes('cash')) && name.includes('-')) return 'encashment';
  if (name.includes('нал') || name.includes('cash')) return 'cash';
  if (name.includes('uzcard')) return 'uzcard';
  if (name.includes('humo')) return 'humo';
  if (name.includes('click') || name.includes('payme') || name.includes('онлайн')) return 'online';
  if (name.includes('rahmat') || name.includes('рахмат')) return 'rahmat';
  if (name.includes('uzum') || name.includes('узум')) return 'uzum';
  if (name.includes('yandex') || name.includes('яндекс') || name.includes('янндекс')) return 'yandex';
  return 'other';
}

export async function GET(req: Request) {
  const session = await requireSession();
  if (session.role.split(':')[0] !== 'admin') {
    return Response.json({ error: 'Доступ запрещен' }, { status: 403 });
  }

  const ids = await getCurrentFilialIds();
  if (ids.length === 0) return Response.json({ data: null });

  const sp = new URL(req.url).searchParams;
  const from = sp.get('from');
  const to = sp.get('to');
  if (!from || !to) return Response.json({ error: 'from, to required' }, { status: 400 });

  const { xml: creds } = await resolveIikoCreds(ids[0]);

  let toNext = to;
  let includeHigh = 'true';
  try {
    const d = new Date(to);
    d.setDate(d.getDate() + 1);
    toNext = d.toISOString().slice(0, 10);
    includeHigh = 'false';
  } catch {}

  // 1. Cashier-reported totals for the period, straight from bot_actions.
  const filialFilter = sql`${schema.botActions.filialId} in (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`;
  const dateExpr = sql`coalesce(${schema.botActions.details}->>'selected_date', to_char(${schema.botActions.createdAt} at time zone 'Asia/Tashkent', 'YYYY-MM-DD'))`;

  const cashierRow = (await db.execute(sql`
    select
      coalesce(sum((details->'payments'->>'cash')::numeric), 0)::bigint as cash,
      coalesce(sum((details->'payments'->>'encashment')::numeric), 0)::bigint as encashment,
      coalesce(sum((details->'payments'->>'uzcard')::numeric), 0)::bigint as uzcard,
      coalesce(sum((details->'payments'->>'humo')::numeric), 0)::bigint as humo,
      coalesce(sum((details->'payments'->>'online')::numeric), 0)::bigint as online,
      coalesce(sum((details->'payments'->>'rahmat')::numeric), 0)::bigint as rahmat,
      coalesce(sum((details->'payments'->>'uzum')::numeric), 0)::bigint as uzum,
      coalesce(sum((details->'payments'->>'yandex')::numeric), 0)::bigint as yandex,
      coalesce(sum((details->>'total_expenses')::numeric), 0)::bigint as total_expenses,
      count(*)::int as reports_count
    from bot_actions
    where ${filialFilter}
      and action_type = 'cash'
      and ${dateExpr} between ${from} and ${to}
  `)) as unknown as {
    rows: {
      cash: string; encashment: string; uzcard: string; humo: string; online: string;
      rahmat: string; uzum: string; yandex: string; total_expenses: string; reports_count: number;
    }[];
  };

  const c = cashierRow.rows[0];
  const cashierTotals: Record<PaymentField, number> = {
    cash: Number(c?.cash ?? 0),
    encashment: Number(c?.encashment ?? 0),
    uzcard: Number(c?.uzcard ?? 0),
    humo: Number(c?.humo ?? 0),
    online: Number(c?.online ?? 0),
    rahmat: Number(c?.rahmat ?? 0),
    uzum: Number(c?.uzum ?? 0),
    yandex: Number(c?.yandex ?? 0),
    other: 0,
  };
  const totalExpenses = Number(c?.total_expenses ?? 0);
  const reportsCount = c?.reports_count ?? 0;

  // 2. iiko revenue split by payment type (same OLAP SALES report used for P&L,
  // but grouped by PayTypes instead of summarized).
  let iikoPayments: Record<PaymentField, number> = {
    cash: 0, encashment: 0, uzcard: 0, humo: 0, online: 0, rahmat: 0, uzum: 0, yandex: 0, other: 0,
  };
  let iikoError: string | null = null;

  try {
    iikoPayments = await withIikoSession(async (token) => {
      const res = await fetch(`${creds.server}/resto/api/v2/reports/olap`, {
        method: 'POST',
        headers: { Cookie: `key=${token}`, 'Content-Type': 'application/json', 'User-Agent': BROWSER_UA },
        body: JSON.stringify({
          reportType: 'SALES',
          buildSummary: 'true',
          groupByRowFields: ['PayTypes'],
          groupByColFields: [],
          aggregateFields: ['DishDiscountSumInt'],
          filters: {
            'OpenDate.Typed': {
              filterType: 'DateRange',
              periodType: 'CUSTOM',
              from,
              to: toNext,
              includeLow: 'true',
              includeHigh,
            },
            DeletedWithWriteoff: { filterType: 'ExcludeValues', values: ['DELETED_WITHOUT_WRITEOFF'] },
          },
        }),
      });

      const totals: Record<PaymentField, number> = {
        cash: 0, encashment: 0, uzcard: 0, humo: 0, online: 0, rahmat: 0, uzum: 0, yandex: 0, other: 0,
      };
      if (res.ok) {
        const json = await res.json();
        for (const row of (json.data ?? []) as OlapPayRow[]) {
          const amount = Math.abs(parseFloat(String(row.DishDiscountSumInt ?? 0)));
          if (amount <= 0) continue;
          const field = mapIikoToField(row.PayTypes || '');
          totals[field] += amount;
        }
      }
      return totals;
    }, creds);
  } catch (e) {
    iikoError = e instanceof Error ? e.message : 'iiko failed';
  }

  // 3. Build the reconciliation table. Each payment type reconciles ONLY
  // against itself (iiko.cash vs cashier.cash, iiko.encashment vs
  // cashier.encashment, etc). Cashier expenses are cash that physically left
  // the drawer during the shift — they reduce the calculated cash balance
  // exactly once, on the «Наличные» row only, never on any other row.
  const rows: ReconciliationRow[] = ROW_DEFS.map(({ field, label }) => {
    const iikoAmount = iikoPayments[field] || 0;
    const cashierExpenses = field === 'cash' ? totalExpenses : 0;
    const calculatedBalance = iikoAmount - cashierExpenses;
    const cashierFact = cashierTotals[field] || 0;
    const diff = cashierFact - calculatedBalance;
    return { field, label, iikoAmount, cashierExpenses, calculatedBalance, cashierFact, diff };
  });

  if (iikoPayments.other > 0) {
    const calculatedBalance = iikoPayments.other;
    rows.push({
      field: 'other',
      label: '⚙️ Другие оплаты (iiko)',
      iikoAmount: iikoPayments.other,
      cashierExpenses: 0,
      calculatedBalance,
      cashierFact: 0,
      diff: 0 - calculatedBalance,
    });
  }

  const totals = rows.reduce(
    (acc, r) => ({
      iikoAmount: acc.iikoAmount + r.iikoAmount,
      cashierExpenses: acc.cashierExpenses + r.cashierExpenses,
      calculatedBalance: acc.calculatedBalance + r.calculatedBalance,
      cashierFact: acc.cashierFact + r.cashierFact,
      diff: acc.diff + r.diff,
    }),
    { iikoAmount: 0, cashierExpenses: 0, calculatedBalance: 0, cashierFact: 0, diff: 0 }
  );

  return Response.json({
    data: { rows, totals, reportsCount },
    error: iikoError,
  });
}
