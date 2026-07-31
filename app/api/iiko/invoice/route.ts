import { requireSession } from '@/lib/auth-session';
import { getCurrentFilialIds } from '@/lib/current-filial';
import { resolveIikoCreds } from '@/lib/filial-iiko';
import { submitDocument } from '@/lib/iiko-web-docs';
import { logAction } from '@/lib/log-action';

export const dynamic = 'force-dynamic';

// Список ролей и ограничение по складу — дословно из легаси
// (app/api/iiko/invoice/route.js): роут пишет документ в iiko, и без проверки
// приход мог оформить любой залогиненный.
const ALLOWED_ROLES = ['admin', 'director', 'supplier'];

export async function POST(req: Request) {
  const session = await requireSession();
  const [baseRole, userStoreId] = session.role.split(':');
  if (!ALLOWED_ROLES.includes(baseRole)) {
    return Response.json({ error: 'Доступ запрещен для вашей роли' }, { status: 403 });
  }

  const filialIds = await getCurrentFilialIds();
  if (filialIds.length === 0) return Response.json({ error: 'no filial' }, { status: 400 });
  const filialId = filialIds[0];

  const b = await req.json();
  if (!b.supplier_id || !b.store_id || !Array.isArray(b.items) || b.items.length === 0) {
    return Response.json({ error: 'supplier_id, store_id, items required' }, { status: 400 });
  }
  if (userStoreId && b.store_id !== userStoreId) {
    return Response.json({ error: 'Вы можете оформлять приходы только на свой склад' }, { status: 403 });
  }

  const { web: creds } = await resolveIikoCreds(filialId);
  const result = await submitDocument({
    type: 'INCOMING_INVOICE',
    supplier: b.supplier_id,
    storeId: b.store_id,
    items: b.items,
    comment: b.comment || `Создал: ${session.name}`,
  }, creds);

  if (!result.success) return Response.json({ error: result.error || 'iiko failed' }, { status: 502 });

  await logAction({
    filialId,
    tgId: session.tgId,
    userName: session.name,
    actionType: 'invoice',
    documentNumber: result.documentNumber,
    details: {
      supplier_id: b.supplier_id,
      supplier_name: b.supplier_name,
      store_id: b.store_id,
      store_name: b.store_name,
      items: b.items,
      comment: b.comment || '',
    },
  });

  return Response.json({ success: true, documentNumber: result.documentNumber });
}
