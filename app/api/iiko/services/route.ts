import { requireSession } from '@/lib/auth-session';
import { getCurrentFilialIds } from '@/lib/current-filial';
import { resolveIikoCreds } from '@/lib/filial-iiko';
import { withIikoSession, iikoPostXml, escapeXml } from '@/lib/iiko';
import { logAction } from '@/lib/log-action';

export const dynamic = 'force-dynamic';

// Услуга проводится как приходная накладная с единственной строкой: контрагент
// «Представительские», товар «Транспорт расходы», количество 1, цена = сумма.
// Счёт затрат iiko этим документом не задаётся, поэтому он уходит в комментарий —
// так сделано в легаси и так эти документы потом ищут в iiko.
const SUPPLIER_DEFAULT = 'f94a2411-4e2a-4d0a-a3c5-f5a4d4e0042d'; // Представительские
const SERVICE_PRODUCT = '69aab99f-deeb-4bf1-804b-0b13373910a0'; // Транспорт расходы

function pad(n: number) { return String(n).padStart(2, '0'); }

export async function POST(req: Request) {
  const session = await requireSession();
  const [baseRole, userStoreId] = session.role.split(':');
  if (!['admin', 'director', 'supplier'].includes(baseRole)) {
    return Response.json({ error: 'Доступ запрещен для вашей роли' }, { status: 403 });
  }

  const filialIds = await getCurrentFilialIds();
  if (filialIds.length === 0) return Response.json({ error: 'no filial' }, { status: 400 });
  const filialId = filialIds[0];

  const b = await req.json();
  const storeId: string = b.store_id || userStoreId || '';
  if (userStoreId && storeId !== userStoreId) {
    return Response.json({ error: 'Вы можете оформлять акты только на свой склад' }, { status: 403 });
  }
  if (!storeId || !b.account_id || !b.sum) {
    return Response.json({ error: 'Не все обязательные поля заполнены' }, { status: 400 });
  }
  const sum = parseFloat(b.sum) || 0;
  if (sum <= 0) return Response.json({ error: 'Сумма услуги должна быть больше нуля' }, { status: 400 });

  // Роль «поставщик» всегда пишется на «Представительские», выбор ей недоступен.
  const supplierId = baseRole === 'supplier' ? SUPPLIER_DEFAULT : (b.supplier_id || SUPPLIER_DEFAULT);
  const supplierName = baseRole === 'supplier' ? 'Представительские' : (b.supplier_name || 'Представительские');

  const t = new Date(Date.now() + 5 * 60 * 60 * 1000);
  const dateStr = `${pad(t.getUTCDate())}.${pad(t.getUTCMonth() + 1)}.${t.getUTCFullYear()} ${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}:${pad(t.getUTCSeconds())}`;

  const comment = `[Счет: ${b.account_name}] ${b.comment || ''} (Создал: ${session.name}) (Сгенерировано через сайт)`.trim();
  const itemXml = `<item><num>1</num><product>${escapeXml(SERVICE_PRODUCT)}</product><amount>1</amount><price>${escapeXml(String(sum))}</price><sum>${escapeXml(String(sum))}</sum><store>${escapeXml(storeId)}</store></item>`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?><document><dateIncoming>${dateStr}</dateIncoming><useDefaultDocumentTime>false</useDefaultDocumentTime><defaultStore>${escapeXml(storeId)}</defaultStore><supplier>${escapeXml(supplierId)}</supplier><comment>${escapeXml(comment)}</comment><items>${itemXml}</items></document>`;

  const { xml: creds } = await resolveIikoCreds(filialId);
  const ok = await withIikoSession((token) => iikoPostXml('documents/import/incomingInvoice', xml, token, creds), creds);

  const details = {
    supplier_id: supplierId, supplier_name: supplierName,
    store_id: storeId, store_name: b.store_name || '',
    account_id: b.account_id, account_name: b.account_name || '',
    sum, comment,
  };

  await logAction({
    filialId,
    tgId: session.tgId,
    userName: session.name,
    actionType: 'services',
    documentNumber: ok ? 'Автоматический' : 'СБОЙ',
    details,
  });

  if (!ok) return Response.json({ error: 'iiko отклонил документ' }, { status: 502 });
  return Response.json({ success: true, documentNumber: 'Автоматический' });
}
