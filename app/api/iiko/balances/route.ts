import { withIikoWebSession, iikoWebFetch } from '@/lib/iiko-web';
import { requireSession } from '@/lib/auth-session';
import { getCurrentFilialIds } from '@/lib/current-filial';
import { resolveIikoCreds } from '@/lib/filial-iiko';

export const dynamic = 'force-dynamic';

export async function GET() {
  await requireSession();
  const ids = await getCurrentFilialIds();
  if (ids.length === 0) return Response.json({ balances: [] });
  const { web: creds } = await resolveIikoCreds(ids[0]);

  try {
    const data = await withIikoWebSession(async (cookies, url) => {
      const res = await iikoWebFetch(`${url}/api/lite-stock/store-balance?limit=10000&offset=0`, { cookies });
      if (!res.ok) throw new Error(`Stock API: ${res.status}`);
      return res.json();
    }, creds);
    return Response.json(data);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'iiko failed', balances: [] }, { status: 200 });
  }
}
