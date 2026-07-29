import { parseStringPromise } from 'xml2js';
import { withIikoSession, iikoGetText } from '@/lib/iiko';
import { requireSession } from '@/lib/auth-session';
import { getCurrentFilialIds } from '@/lib/current-filial';
import { resolveIikoCreds } from '@/lib/filial-iiko';

export const dynamic = 'force-dynamic';

type Employee = { id: string; name: string };

const cache = new Map<number, { data: Employee[]; at: number }>();
const TTL = 5 * 60_000;

export async function GET() {
  await requireSession();
  const ids = await getCurrentFilialIds();
  if (ids.length === 0) return Response.json({ employees: [] });
  const filialId = ids[0];

  const cached = cache.get(filialId);
  if (cached && Date.now() - cached.at < TTL) {
    return Response.json({ employees: cached.data, cached: true });
  }

  const { xml: creds } = await resolveIikoCreds(filialId);

  try {
    const employees = await withIikoSession(async (token) => {
      const empXml = await iikoGetText('employees', token, creds);
      const result: Employee[] = [];
      if (empXml) {
        const parsed = await parseStringPromise(empXml);
        for (const e of parsed?.employees?.employee ?? []) {
          const id = e.id?.[0];
          const name = e.name?.[0];
          if (id && name && e.deleted?.[0] !== 'true') result.push({ id, name });
        }
      }
      result.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
      return result;
    }, creds);

    cache.set(filialId, { data: employees, at: Date.now() });
    return Response.json({ employees });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'iiko request failed', employees: [] },
      { status: 200 }
    );
  }
}
