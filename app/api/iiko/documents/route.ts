import { withIikoWebSession, iikoWebFetch } from '@/lib/iiko-web';
import { requireSession } from '@/lib/auth-session';
import { getCurrentFilialIds } from '@/lib/current-filial';
import { resolveIikoCreds } from '@/lib/filial-iiko';

export const dynamic = 'force-dynamic';

const STORE_NUM = process.env.IIKO_STORE_NUM || '170243';

function todayMinus(days: number): string {
  const d = new Date(Date.now() + 5 * 3600_000 - days * 86400_000);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  await requireSession();
  const ids = await getCurrentFilialIds();
  if (ids.length === 0) return Response.json({ documents: [] });
  const { web: creds } = await resolveIikoCreds(ids[0]);

  const sp = new URL(req.url).searchParams;
  const dateFrom = sp.get('dateFrom') || todayMinus(30);
  const dateTo = sp.get('dateTo') || todayMinus(-1);
  const store = sp.get('store') || STORE_NUM;

  try {
    const data = await withIikoWebSession(async (cookies, url) => {
      const qs = new URLSearchParams({ dateFrom, dateTo, store }).toString();
      const res = await iikoWebFetch(`${url}/api/documents/list?${qs}`, { cookies });
      if (!res.ok) throw new Error(`iikoWeb ${res.status}`);
      const payload = await res.json<any>();
      let docs: unknown[] = [];
      if (Array.isArray(payload)) docs = payload;
      else if (payload?.data?.documents && Array.isArray(payload.data.documents)) docs = payload.data.documents;
      else if (Array.isArray(payload?.data)) docs = payload.data;
      else if (Array.isArray(payload?.documents)) docs = payload.documents;
      return docs;
    }, creds);

    return Response.json({ documents: data, dateFrom, dateTo });
  } catch (e) {
    return Response.json({ documents: [], error: e instanceof Error ? e.message : 'iiko failed' });
  }
}
