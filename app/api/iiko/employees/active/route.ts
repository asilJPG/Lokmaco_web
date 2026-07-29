import { parseStringPromise } from 'xml2js';
import { withIikoSession, iikoGetText } from '@/lib/iiko';
import { withIikoWebSession, iikoWebFetch } from '@/lib/iiko-web';
import { requireSession } from '@/lib/auth-session';
import { getCurrentFilialIds } from '@/lib/current-filial';
import { resolveIikoCreds } from '@/lib/filial-iiko';

export const dynamic = 'force-dynamic';

type ActiveEmployee = { id: string; name: string; defaultWage: number };

export async function GET(req: Request) {
  await requireSession();
  const date = new URL(req.url).searchParams.get('date');
  if (!date) return Response.json({ error: 'date required' }, { status: 400 });

  const filialIds = await getCurrentFilialIds();
  if (filialIds.length === 0) return Response.json({ error: 'no filial', employees: [] });
  const filialId = filialIds[0];

  const { xml: xmlCreds, web: webCreds } = await resolveIikoCreds(filialId);

  try {
    const { empMap, activeIds } = await withIikoSession(async (token) => {
      const empXml = await iikoGetText('employees', token, xmlCreds);
      const attXml = await iikoGetText(`employees/attendance?from=${date}&to=${date}`, token, xmlCreds);
      const empMap = new Map<string, string>();
      const activeIds = new Set<string>();
      if (empXml) {
        const parsed = await parseStringPromise(empXml);
        for (const e of parsed?.employees?.employee ?? []) {
          const id = e.id?.[0];
          const name = e.name?.[0];
          if (id && name && e.deleted?.[0] !== 'true') empMap.set(id, name);
        }
      }
      if (attXml) {
        const parsed = await parseStringPromise(attXml);
        for (const a of parsed?.attendances?.attendance ?? []) {
          const id = a.employeeId?.[0];
          if (id) activeIds.add(id);
        }
      }
      return { empMap, activeIds };
    }, xmlCreds);

    const wageMap = new Map<string, number>();
    try {
      await withIikoWebSession(async (cookies, url) => {
        const res = await iikoWebFetch(`${url}/api/labor/employee/wage/list?from=${date}&to=${date}`, { cookies });
        if (res.ok) {
          const json = await res.json<any>();
          for (const w of json.data ?? []) {
            if (w.employeeId) wageMap.set(w.employeeId, w.payment ?? 0);
          }
        }
      }, webCreds);
    } catch {}

    const employees: ActiveEmployee[] = [];
    for (const id of activeIds) {
      const name = empMap.get(id);
      if (name) employees.push({ id, name, defaultWage: wageMap.get(id) ?? 0 });
    }
    employees.sort((a, b) => a.name.localeCompare(b.name, 'ru'));

    return Response.json({ employees });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'iiko request failed', employees: [] },
      { status: 200 }
    );
  }
}
