import { requireSession } from '@/lib/auth-session';
import { getCurrentFilialIds } from '@/lib/current-filial';
import { resolveIikoCreds } from '@/lib/filial-iiko';
import { submitDocument } from '@/lib/iiko-web-docs';
import { logAction } from '@/lib/log-action';

export const dynamic = 'force-dynamic';

// Роли и ограничение по складу — дословно из легаси
// (app/api/iiko/transfer/route.js).
const ALLOWED_ROLES = ['admin', 'director', 'supplier', 'kitchen', 'prep_chef', 'bar', 'hall'];

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
  if (!b.store_from || !b.store_to || !Array.isArray(b.items) || b.items.length === 0) {
    return Response.json({ error: 'store_from, store_to, items required' }, { status: 400 });
  }
  if (userStoreId && b.store_from !== userStoreId && b.store_to !== userStoreId) {
    return Response.json({ error: 'Вы можете перемещать товары только со своего или на свой склад' }, { status: 403 });
  }

  const { web: creds } = await resolveIikoCreds(filialId);
  const result = await submitDocument({
    type: 'INTERNAL_TRANSFER',
    storeFrom: b.store_from,
    storeTo: b.store_to,
    items: b.items,
    comment: b.comment || `Создал: ${session.name}`,
  }, creds);

  if (!result.success) return Response.json({ error: result.error || 'iiko failed' }, { status: 502 });

  await logAction({
    filialId,
    tgId: session.tgId,
    userName: session.name,
    actionType: 'transfer',
    documentNumber: result.documentNumber,
    details: {
      store_from: b.store_from,
      store_from_name: b.store_from_name,
      store_to: b.store_to,
      store_to_name: b.store_to_name,
      items: b.items,
      comment: b.comment || '',
    },
  });

  return Response.json({ success: true, documentNumber: result.documentNumber });
}
