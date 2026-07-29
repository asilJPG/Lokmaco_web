import { withIikoSession, iikoGetText } from '@/lib/iiko';
import { requireSession } from '@/lib/auth-session';
import { getCurrentFilialIds } from '@/lib/current-filial';
import { resolveIikoCreds } from '@/lib/filial-iiko';
import { parseStringPromise } from 'xml2js';

export const dynamic = 'force-dynamic';

type Supplier = { id: string; name: string };
type Cached = { data: Supplier[]; at: number };
const cache = new Map<number, Cached>();
const TTL = 5 * 60_000;

function first(v: unknown): string {
  if (Array.isArray(v)) return typeof v[0] === 'string' ? v[0] : '';
  return typeof v === 'string' ? v : '';
}

// Рекурсивно ищем объекты-контрагенты с признаком supplier=true (аналог легаси-бота)
function findSuppliers(obj: unknown, results: Supplier[] = []): Supplier[] {
  if (!obj || typeof obj !== 'object') return results;
  if (Array.isArray(obj)) {
    for (const item of obj) findSuppliers(item, results);
    return results;
  }
  const o = obj as Record<string, unknown>;
  const id = first(o.id);
  const name = first(o.name);
  const supplier = first(o.supplier);
  const deleted = first(o.deleted);

  if (id && name) {
    const supplierOk = !supplier || supplier === 'true';
    const deletedOk = !deleted || deleted === 'false';
    if (supplierOk && deletedOk && !results.find((r) => r.id === id.trim())) {
      results.push({ id: id.trim(), name: name.trim() });
    }
  }

  for (const key of Object.keys(o)) {
    findSuppliers(o[key], results);
  }
  return results;
}

export async function GET() {
  await requireSession();
  const ids = await getCurrentFilialIds();
  if (ids.length === 0) return Response.json({ suppliers: [] });
  const filialId = ids[0];
  const cached = cache.get(filialId);
  if (cached && Date.now() - cached.at < TTL) {
    return Response.json({ suppliers: cached.data, cached: true });
  }
  const { xml: creds } = await resolveIikoCreds(filialId);

  try {
    const suppliers = await withIikoSession(async (token) => {
      const xml = await iikoGetText('suppliers', token, creds);
      if (!xml) return [];
      try {
        const parsed = await parseStringPromise(xml, { explicitArray: true, ignoreAttrs: false });
        return findSuppliers(parsed);
      } catch {
        return [];
      }
    }, creds);

    cache.set(filialId, { data: suppliers, at: Date.now() });
    return Response.json({ suppliers });
  } catch (e) {
    return Response.json({ suppliers: [], error: e instanceof Error ? e.message : 'iiko failed' });
  }
}
