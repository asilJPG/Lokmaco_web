import { requireSession } from '@/lib/auth-session';
import { submitCashReport } from '@/lib/cashier';
import { getUserFilialIds } from '@/lib/current-filial';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const session = await requireSession();
  if (!['admin', 'director', 'cashier'].includes(session.role.split(':')[0])) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  // ⚠️ Список филиалов — живой, а не из токена: иначе кассир не смог бы
  // закрыть смену по филиалу, назначенному ему сегодня (см. lib/current-filial).
  const allowed = await getUserFilialIds();
  const filialId = Number(body.filialId ?? allowed[0]);
  if (!filialId || !allowed.includes(filialId)) {
    return Response.json({ error: 'Filial access denied' }, { status: 403 });
  }
  if (!body.date) return Response.json({ error: 'date required' }, { status: 400 });

  const result = await submitCashReport({
    filialId,
    date: body.date,
    payments: body.payments || {},
    expenses: Array.isArray(body.expenses) ? body.expenses : [],
    surplus: body.surplus,
    shortage: body.shortage,
    comment: body.comment || '',
    employeeWages: Array.isArray(body.employeeWages) ? body.employeeWages : [],
    userId: session.id,
    userName: session.name,
    userTgId: session.tgId,
  });

  return Response.json({ success: true, ...result });
}
