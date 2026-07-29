import { withIikoSession } from '@/lib/iiko';
import { requireSession } from '@/lib/auth-session';
import { getCurrentFilialIds } from '@/lib/current-filial';
import { resolveIikoCreds } from '@/lib/filial-iiko';

export const dynamic = 'force-dynamic';

type OlapTransRow = {
  'Account.Name'?: string;
  'DateTime.Typed'?: string;
  Document?: string;
  Comment?: string;
  'Counteragent.Name'?: string;
  'Contr-Product.Name'?: string;
  'Sum.ResignedSum'?: string | number;
};

type DetailRow = { date: string; document: string; description: string; amount: number };

export async function GET(req: Request) {
  const session = await requireSession();
  if (!['admin', 'director'].includes(session.role.split(':')[0])) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const ids = await getCurrentFilialIds();
  if (ids.length === 0) return Response.json({ data: [] });

  const sp = new URL(req.url).searchParams;
  const category = sp.get('category');
  const from = sp.get('from');
  const to = sp.get('to');
  if (!category || !from || !to) {
    return Response.json({ error: 'category, from, to required' }, { status: 400 });
  }

  const { xml: creds } = await resolveIikoCreds(ids[0]);

  let toNext = to;
  let includeHigh = 'true';
  try {
    const d = new Date(to);
    d.setDate(d.getDate() + 1);
    toNext = d.toISOString().slice(0, 10);
    includeHigh = 'false';
  } catch {}

  try {
    const data = await withIikoSession(async (token) => {
      const res = await fetch(`${creds.server}/resto/api/v2/reports/olap`, {
        method: 'POST',
        headers: {
          Cookie: `key=${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        body: JSON.stringify({
          reportType: 'TRANSACTIONS',
          buildSummary: 'true',
          groupByRowFields: ['Account.Name', 'Account.Type', 'DateTime.Typed', 'Document', 'Comment', 'Counteragent.Name', 'Contr-Product.Name'],
          groupByColFields: [],
          aggregateFields: ['Sum.ResignedSum'],
          filters: {
            'DateTime.DateTyped': {
              filterType: 'DateRange',
              periodType: 'CUSTOM',
              from,
              to: toNext,
              includeLow: 'true',
              includeHigh,
            },
            'Account.Name': {
              filterType: 'IncludeValues',
              values: [category],
            },
          },
        }),
      });

      if (!res.ok) return [];
      const json = await res.json();
      const rawRows = (json.data ?? []) as OlapTransRow[];

      type Group = { date: string; document: string; totalAmount: number; items: Set<string> };
      const groups = new Map<string, Group>();

      for (const row of rawRows) {
        const val = parseFloat(String(row['Sum.ResignedSum'] ?? 0));
        if (val <= 0) continue;

        const docNum = row.Document || '';
        const catName = row['Account.Name'] || '';

        // Exclude salary transactions without a document number (clock-in hourly entries)
        if (catName === 'Зарплата' && !docNum) continue;

        const dateRaw = row['DateTime.Typed'] || '';
        const date = dateRaw.split('T')[0] || '';
        const key = docNum ? `${date}_${docNum}` : `${date}_nodoc_${catName}`;

        let grp = groups.get(key);
        if (!grp) {
          grp = { date, document: docNum || '—', totalAmount: 0, items: new Set() };
          groups.set(key, grp);
        }
        grp.totalAmount += val;

        let itemDesc = '';
        if (catName === 'Зарплата') {
          if (row['Contr-Product.Name']) {
            itemDesc = row['Contr-Product.Name'];
            if (row['Counteragent.Name']) itemDesc += ` (${row['Counteragent.Name']})`;
          } else {
            itemDesc = row['Counteragent.Name'] || row.Comment || '';
          }
        } else {
          itemDesc = row['Contr-Product.Name'] || row.Comment || row['Counteragent.Name'] || '';
        }
        if (itemDesc) grp.items.add(itemDesc);
      }

      const result: DetailRow[] = Array.from(groups.values()).map((grp) => {
        const itemsArr = Array.from(grp.items).filter(Boolean);
        let description = '—';
        if (itemsArr.length > 0) {
          const top3 = itemsArr.slice(0, 3);
          description = top3.join(', ');
          if (itemsArr.length > 3) description += ` + еще ${itemsArr.length - 3}`;
        }
        return { date: grp.date, document: grp.document, description, amount: grp.totalAmount };
      });

      result.sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        return b.amount - a.amount;
      });

      return result;
    }, creds);

    return Response.json({ data });
  } catch (e) {
    return Response.json({ data: [], error: e instanceof Error ? e.message : 'iiko failed' });
  }
}
