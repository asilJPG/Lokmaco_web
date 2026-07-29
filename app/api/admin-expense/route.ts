import { requireSession } from '@/lib/auth-session';
import { createAdminExpense, deleteAdminExpense } from '@/lib/admin-expense';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const session = await requireSession();
  if (!['admin', 'director'].includes(session.role.split(':')[0])) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  const body = await req.json();
  const filialId = Number(body.filialId ?? session.filialIds[0]);
  if (!filialId || !session.filialIds.includes(filialId)) {
    return Response.json({ error: 'Filial access denied' }, { status: 403 });
  }
  if (!body.date || !body.name || !body.amount) {
    return Response.json({ error: 'date, name, amount required' }, { status: 400 });
  }
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return Response.json({ error: 'amount must be > 0' }, { status: 400 });
  }
  const result = await createAdminExpense({
    filialId,
    date: String(body.date),
    name: String(body.name),
    amount,
    userId: session.id,
    userName: session.name,
    userTgId: session.tgId,
  });
  return Response.json({ success: true, ...result });
}

export async function DELETE(req: Request) {
  const session = await requireSession();
  if (!['admin', 'director'].includes(session.role.split(':')[0])) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  const id = Number(new URL(req.url).searchParams.get('id'));
  if (!id) return Response.json({ error: 'id required' }, { status: 400 });
  const deleted = await deleteAdminExpense(id, session.filialIds);
  return Response.json({ success: deleted > 0 });
}
