import { requireSession } from '@/lib/auth-session';
import { getUserFilialIds, setCurrentFilialCookie } from '@/lib/current-filial';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  await requireSession();
  const { id } = await req.json();
  if (id === 'all') {
    setCurrentFilialCookie('all');
    return Response.json({ success: true, value: 'all' });
  }
  const n = Number(id);
  // ⚠️ Сверяемся с живым списком из базы, а не с тем, что лежит в токене.
  // Список в JWT фиксируется при входе и живёт неделю: филиал, добавленный
  // сотруднику сегодня, отбивался здесь как «доступ запрещён», переключатель
  // молча возвращался назад — и выглядело это как «на этом компьютере не
  // работает», хотя дело было в старой сессии.
  const allowed = await getUserFilialIds();
  if (!allowed.includes(n)) {
    return Response.json({ error: 'Этот филиал вам не назначен' }, { status: 403 });
  }
  setCurrentFilialCookie(n);
  return Response.json({ success: true, value: n });
}
