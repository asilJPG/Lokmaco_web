import { requireSession } from '@/lib/auth-session';
import { setCurrentFilialCookie } from '@/lib/current-filial';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const session = await requireSession();
  const { id } = await req.json();
  if (id === 'all') {
    setCurrentFilialCookie('all');
    return Response.json({ success: true, value: 'all' });
  }
  const n = Number(id);
  if (!session.filialIds.includes(n)) {
    return Response.json({ error: 'Filial access denied' }, { status: 403 });
  }
  setCurrentFilialCookie(n);
  return Response.json({ success: true, value: n });
}
