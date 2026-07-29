import { withIikoWebSession, iikoWebFetch } from '@/lib/iiko-web';
import { requireSession } from '@/lib/auth-session';
import { getCurrentFilialIds } from '@/lib/current-filial';
import { resolveIikoCreds } from '@/lib/filial-iiko';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  await requireSession();
  const sp = new URL(req.url).searchParams;
  const id = sp.get('id');
  const type = sp.get('type');
  if (!id || !type) return Response.json({ error: 'id, type required' }, { status: 400 });

  const ids = await getCurrentFilialIds();
  if (ids.length === 0) return Response.json({ data: null });
  const { web: creds } = await resolveIikoCreds(ids[0]);

  try {
    const data = await withIikoWebSession(async (cookies, url) => {
      const res = await iikoWebFetch(`${url}/api/documents/get/${id}?type=${type}`, { cookies });
      if (!res.ok) throw new Error(`iikoWeb ${res.status}`);
      return res.json();
    }, creds);

    return Response.json({ data });
  } catch (e) {
    return Response.json({ data: null, error: e instanceof Error ? e.message : 'iiko failed' });
  }
}
