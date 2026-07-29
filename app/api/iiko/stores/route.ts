import { withIikoSession, iikoGetText } from '@/lib/iiko';
import { requireSession } from '@/lib/auth-session';
import { getCurrentFilialIds } from '@/lib/current-filial';
import { resolveIikoCreds } from '@/lib/filial-iiko';

export const dynamic = 'force-dynamic';

function tag(xml: string, name: string): string {
  const m = xml.match(new RegExp(`<${name}>([^<]*)</${name}>`));
  return m ? m[1].trim() : '';
}

const cache = new Map<number, { data: { id: string; name: string }[]; at: number }>();
const TTL = 5 * 60_000;

export async function GET() {
  await requireSession();
  const ids = await getCurrentFilialIds();
  if (ids.length === 0) return Response.json({ stores: [] });
  const filialId = ids[0];
  const cached = cache.get(filialId);
  if (cached && Date.now() - cached.at < TTL) {
    return Response.json({ stores: cached.data, cached: true });
  }
  const { xml: creds } = await resolveIikoCreds(filialId);

  try {
    const stores = await withIikoSession(async (token) => {
      const xml = await iikoGetText('corporation/stores', token, creds);
      if (!xml) return [];
      const results: { id: string; name: string }[] = [];
      const regex = /<corporateItemDto>([\s\S]*?)<\/corporateItemDto>/g;
      let m: RegExpExecArray | null;
      while ((m = regex.exec(xml)) !== null) {
        const id = tag(m[1], 'id');
        const name = tag(m[1], 'name');
        const type = tag(m[1], 'type');
        if (id && name && type === 'STORE') results.push({ id, name });
      }
      return results;
    }, creds);

    cache.set(filialId, { data: stores, at: Date.now() });
    return Response.json({ stores });
  } catch (e) {
    return Response.json({ stores: [], error: e instanceof Error ? e.message : 'iiko failed' });
  }
}
