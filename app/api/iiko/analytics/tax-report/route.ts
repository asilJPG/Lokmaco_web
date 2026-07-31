import { canAccess } from '@/lib/access';
import { requireSession } from '@/lib/auth-session';
import { getCurrentFilialIds } from '@/lib/current-filial';
import { resolveIikoCreds } from '@/lib/filial-iiko';
import { getTaxReport } from '@/lib/tax-report';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request) {
  const session = await requireSession();
  if (!canAccess(session.role, 'taxReport')) {
    return Response.json({ error: 'Доступ запрещен для вашей роли' }, { status: 403 });
  }

  const sp = new URL(req.url).searchParams;
  const from = sp.get('from');
  const to = sp.get('to');
  if (!from || !to) return Response.json({ error: 'Укажите даты from и to' }, { status: 400 });

  const ids = await getCurrentFilialIds();
  if (ids.length === 0) return Response.json({ data: null });

  try {
    const { xml: creds } = await resolveIikoCreds(ids[0]);
    return Response.json({ data: await getTaxReport(from, to, creds) });
  } catch (e) {
    return Response.json({ data: null, error: e instanceof Error ? e.message : 'iiko failed' });
  }
}
