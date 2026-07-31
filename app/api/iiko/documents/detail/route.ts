import { withIikoWebSession, iikoWebFetch } from '@/lib/iiko-web';
import { requireSession } from '@/lib/auth-session';
import { getCurrentFilialIds } from '@/lib/current-filial';
import { resolveIikoCreds } from '@/lib/filial-iiko';
import { getNomenclature } from '@/lib/iiko-nomenclature';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(v: unknown): boolean {
  return typeof v === 'string' && UUID_RE.test(v);
}

export async function GET(req: Request) {
  await requireSession();
  const sp = new URL(req.url).searchParams;
  const id = sp.get('id');
  const type = sp.get('type');
  if (!id || !type) return Response.json({ error: 'id, type required' }, { status: 400 });

  const ids = await getCurrentFilialIds();
  if (ids.length === 0) return Response.json({ data: null });
  const { web: creds, xml: xmlCreds } = await resolveIikoCreds(ids[0]);

  try {
    // Названия подставляем на сервере: iikoWeb отдаёт в строках только UUID
    // товара, и в интерфейсе вместо позиций был список идентификаторов.
    const [data, nomenclature] = await Promise.all([
      withIikoWebSession(async (cookies, url) => {
        const res = await iikoWebFetch(`${url}/api/documents/get/${id}?type=${type}`, { cookies });
        if (!res.ok) throw new Error(`iikoWeb ${res.status}`);
        return res.json<any>();
      }, creds),
      getNomenclature(xmlCreds).catch(() => new Map()),
    ]);

    const items = data?.data?.items;
    if (Array.isArray(items)) {
      for (const it of items) {
        const found = typeof it?.product === 'string' ? nomenclature.get(it.product) : undefined;
        it.productName = it.name || found?.name || '';
        it.productCode = it.code || found?.code || '';

        // Единица: `unitName` в актах списания — это UUID, а читаемое название
        // лежит в containers[isMainUnit] («порц»). UUID показывать нельзя.
        const main = Array.isArray(it.containers) ? it.containers.find((c: any) => c?.isMainUnit) : null;
        const unit = main?.name || (isUuid(it.unitName) ? '' : it.unitName) || found?.unit || '';
        it.unitLabel = isUuid(unit) ? '' : unit;

        // В акте списания цена называется costPrice, суммы строки нет вовсе.
        const amount = Number(it.amount ?? 0);
        const price = it.price ?? it.costPrice ?? null;
        it.priceValue = price != null ? Number(price) : null;
        it.sumValue = it.sum != null ? Number(it.sum)
          : it.cost != null ? Number(it.cost)
          : price != null ? Number(price) * amount
          : null;
      }
    }

    return Response.json({ data });
  } catch (e) {
    return Response.json({ data: null, error: e instanceof Error ? e.message : 'iiko failed' });
  }
}
