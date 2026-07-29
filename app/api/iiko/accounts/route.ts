import { requireSession } from '@/lib/auth-session';
import { getCurrentFilialIds } from '@/lib/current-filial';
import { resolveIikoCreds } from '@/lib/filial-iiko';
import { getAccounts } from '@/lib/iiko';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await requireSession();
  if (!['admin', 'director'].includes(session.role.split(':')[0])) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  const ids = await getCurrentFilialIds();
  if (ids.length === 0) return Response.json({ data: [] });

  try {
    const { xml: creds } = await resolveIikoCreds(ids[0]);
    return Response.json({ data: await getAccounts(creds) });
  } catch (e) {
    return Response.json({ data: [], error: e instanceof Error ? e.message : 'iiko failed' });
  }
}
