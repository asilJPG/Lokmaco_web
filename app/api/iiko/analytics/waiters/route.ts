import { withIikoWebSession, iikoWebFetch } from '@/lib/iiko-web';
import { requireSession } from '@/lib/auth-session';
import { getCurrentFilialIds } from '@/lib/current-filial';
import { resolveIikoCreds } from '@/lib/filial-iiko';

export const dynamic = 'force-dynamic';

const STORE_NUM = Number(process.env.IIKO_STORE_NUM || '170243');

export async function GET(req: Request) {
  const session = await requireSession();
  if (!['admin', 'director', 'manager'].includes(session.role.split(':')[0])) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  const ids = await getCurrentFilialIds();
  if (ids.length === 0) return Response.json({ data: [] });

  const sp = new URL(req.url).searchParams;
  const from = sp.get('from');
  const to = sp.get('to');
  if (!from || !to) return Response.json({ error: 'from, to required' }, { status: 400 });

  const { web: creds } = await resolveIikoCreds(ids[0]);

  try {
    const data = await withIikoWebSession(async (cookies, url) => {
      const res = await iikoWebFetch(`${url}/api/kpi/dashboard/get-data`, {
        method: 'POST',
        cookies,
        body: JSON.stringify({
          dateFrom: from,
          dateTo: to,
          dataType: 'DATA_DETAILS_BY_METRIC',
          metricCodes: ['SALES_GROSS_BY_WAITERS', 'AVERAGE_SPEND_GROSS_BY_WAITERS', 'TRN_BY_WAITERS', 'REFUND_TRN_BY_WAITERS'],
          storeIds: [STORE_NUM],
        }),
      });
      if (!res.ok) return [];
      const json = await res.json<any>();
      if (json.error || !json.data) return [];
      const sales = json.data.SALES_GROSS_BY_WAITERS || {};
      const orders = json.data.TRN_BY_WAITERS || {};
      const avg = json.data.AVERAGE_SPEND_GROSS_BY_WAITERS || {};
      const refunds = json.data.REFUND_TRN_BY_WAITERS || {};
      const emap = json.decoration?.employee || {};
      const list: { name: string; sales: number; orders: number; refunds: number; avgCheck: number }[] = [];
      for (const uuid of Object.keys(sales)) {
        list.push({
          name: emap[uuid]?.name || 'Без имени',
          sales: parseFloat(sales[uuid] || 0),
          orders: parseInt(orders[uuid] || 0, 10),
          refunds: parseInt(refunds[uuid] || 0, 10),
          avgCheck: Math.round(parseFloat(avg[uuid] || 0)),
        });
      }
      list.sort((a, b) => b.sales - a.sales);
      return list;
    }, creds);

    return Response.json({ data });
  } catch (e) {
    return Response.json({ data: [], error: e instanceof Error ? e.message : 'iiko failed' });
  }
}
