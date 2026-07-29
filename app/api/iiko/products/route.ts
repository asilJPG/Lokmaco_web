import { withIikoSession, iikoGet } from '@/lib/iiko';
import { requireSession } from '@/lib/auth-session';
import { getCurrentFilialIds } from '@/lib/current-filial';
import { resolveIikoCreds } from '@/lib/filial-iiko';

export const dynamic = 'force-dynamic';

const UNIT_MAP: Record<string, string> = {
  '7ba81c3a-8de5-8f9d-fb9f-e39efcbc57cc': 'кг',
  '69859c74-db72-b006-cba5-326cf6f4fc6e': 'л',
  'cd19b5ea-1b32-a6e5-1df7-5d2784a0549a': 'шт',
  '109fb602-70ad-473d-ba1f-f037b6e72887': 'шт',
};

type IikoProduct = { id: string; name: string; type?: string; code?: string; num?: string; mainUnit?: string };
type Cached = { data: unknown; at: number };
const cache = new Map<number, Cached>();
const TTL = 5 * 60_000;

export async function GET() {
  await requireSession();
  const ids = await getCurrentFilialIds();
  if (ids.length === 0) return Response.json({ products: [] });

  const filialId = ids[0];
  const cached = cache.get(filialId);
  if (cached && Date.now() - cached.at < TTL) {
    return Response.json({ products: cached.data, cached: true });
  }

  const { xml: creds } = await resolveIikoCreds(filialId);

  try {
    const products = await withIikoSession(async (token) => {
      const data = (await iikoGet<IikoProduct[]>('v2/entities/products/list', token, creds)) || [];
      return data
        .filter((p) => p.type === 'GOODS' || p.type === 'PREPARED')
        .map((p) => ({
          id: p.id,
          name: p.name,
          type: p.type,
          code: p.code || '',
          num: p.num || '',
          mainUnit: p.mainUnit ? UNIT_MAP[p.mainUnit] || 'шт' : 'шт',
        }));
    }, creds);
    cache.set(filialId, { data: products, at: Date.now() });
    return Response.json({ products });
  } catch (e) {
    return Response.json({ products: [], error: e instanceof Error ? e.message : 'iiko failed' });
  }
}
