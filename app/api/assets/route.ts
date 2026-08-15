import { eq, desc, inArray } from 'drizzle-orm';
import { db, schema } from '@/db/client';
import { requireSession } from '@/lib/auth-session';
import { getCurrentFilialIds } from '@/lib/current-filial';

export const dynamic = 'force-dynamic';

const CAN_EDIT = ['admin', 'manager'];

async function logAssetAction(actionType: string, documentNumber: string, details: Record<string, unknown>, session: { tgId: number | null; name: string }) {
  const ids = await getCurrentFilialIds();
  if (ids.length === 0) return;
  await db.insert(schema.botActions).values({
    filialId: ids[0], tgId: session.tgId, userName: session.name, actionType, documentNumber, details,
  });
}

export async function GET(req: Request) {
  const session = await requireSession();
  if (!CAN_EDIT.includes(session.role.split(':')[0])) {
    return Response.json({ error: 'Доступ только для администратора и менеджера' }, { status: 403 });
  }

  const sp = new URL(req.url).searchParams;
  const location = sp.get('location');
  const status = sp.get('status');
  const search = (sp.get('search') || '').toLowerCase().trim();

  let rows = await db.select().from(schema.assets).orderBy(desc(schema.assets.createdAt));

  if (location && location !== 'all') rows = rows.filter((a) => a.location === location);
  if (status && status !== 'all') rows = rows.filter((a) => a.status === status);
  if (search) {
    rows = rows.filter((a) =>
      (a.name || '').toLowerCase().includes(search) ||
      (a.invNumber || '').toLowerCase().includes(search) ||
      (a.responsiblePerson || '').toLowerCase().includes(search) ||
      (a.serialNumber || '').toLowerCase().includes(search)
    );
  }

  // Наклейки и места отдаём вместе со списком: сканеру нужен разбор кода
  // наклейки в карточку, а грузить их отдельным запросом с телефона — лишний
  // круг ожидания перед обходом.
  const [tags, locations] = await Promise.all([
    db.select().from(schema.assetTags),
    db.select().from(schema.assetLocations).orderBy(schema.assetLocations.sortOrder, schema.assetLocations.name),
  ]);

  return Response.json({ data: rows, tags, locations });
}

export async function POST(req: Request) {
  const session = await requireSession();
  if (!CAN_EDIT.includes(session.role.split(':')[0])) {
    return Response.json({ error: 'Доступ только для администратора и менеджера' }, { status: 403 });
  }

  const b = await req.json();
  if (!b.name || !b.location || !b.responsible_person) {
    return Response.json({ error: 'Укажите наименование, место эксплуатации и МОЛ' }, { status: 400 });
  }

  // Инвентарный номер можно не вводить — соберём сами.
  //
  // ⚠️ Два сегмента, а не три. Прежний `INV-<место>-<число>` давал `INV-1-5375`
  // и `INV-INV-2147` (место кириллицей срезалось в пустоту), а трёхсегментный
  // номер читается как «экземпляр партии»: разные предметы слипались в одну
  // строку списка. Место в номере всё равно бесполезно — оно меняется, а номер
  // остаётся.
  let invNumber = String(b.inv_number || '').trim();
  if (!invNumber) {
    invNumber = `INV-${Math.floor(10000 + Math.random() * 90000)}`;
  }

  const [created] = await db.insert(schema.assets).values({
    invNumber,
    name: String(b.name).trim(),
    category: b.category || 'Оборудование',
    location: String(b.location).trim(),
    responsiblePerson: String(b.responsible_person).trim(),
    quantity: parseInt(b.quantity) || 1,
    initialCost: String(parseFloat(b.initial_cost) || 0),
    commissioningDate: b.commissioning_date || new Date().toISOString().split('T')[0],
    status: b.status || 'in_use',
    serialNumber: b.serial_number ? String(b.serial_number).trim() : '',
    notes: b.notes ? String(b.notes).trim() : '',
    photoUrl: b.photo_url || '',
    locationId: b.location_id || null,
    // ⚠️ Заведённого руками в справочнике iiko нет по определению — без этого
    // признака сверка уводила бы такую карточку в архив на первом же проходе.
    source: 'manual',
  }).returning();

  await logAssetAction('asset_create', created.invNumber, { name: created.name, location: created.location, responsible_person: created.responsiblePerson }, session);
  return Response.json({ success: true, data: created });
}

export async function PUT(req: Request) {
  const session = await requireSession();
  const b = await req.json();
  if (!b.id) return Response.json({ error: 'Missing asset id' }, { status: 400 });

  // Отметка «нашли при инвентаризации» доступна любой залогиненной роли:
  // обходят склад и сканируют стикеры не только админы.
  //
  // Отмечаем всю пачку одним запросом. Обход зала — это сотня-другая позиций;
  // запрос на каждую превращал сохранение в минуту ожидания на телефоне, и
  // любой обрыв связи посреди списка оставлял инвентаризацию наполовину
  // сохранённой.
  if (b.action === 'audit') {
    const ids: string[] = Array.isArray(b.ids) ? b.ids.map(String).filter(Boolean) : (b.id ? [String(b.id)] : []);
    if (ids.length === 0) return Response.json({ error: 'Нечего отмечать' }, { status: 400 });

    const now = new Date();
    await db.update(schema.assets)
      .set({ lastInventoriedAt: now, updatedAt: now })
      .where(inArray(schema.assets.id, ids));
    await logAssetAction('asset_audit', String(ids.length), { action: 'inventory_audit', ids }, session);
    return Response.json({ success: true, marked: ids.length });
  }

  if (!CAN_EDIT.includes(session.role.split(':')[0])) {
    return Response.json({ error: 'Доступ только для администратора и менеджера' }, { status: 403 });
  }

  const patch: Partial<typeof schema.assets.$inferInsert> = { updatedAt: new Date() };
  if (b.inv_number !== undefined) patch.invNumber = String(b.inv_number).trim();
  if (b.name !== undefined) patch.name = String(b.name).trim();
  if (b.category !== undefined) patch.category = b.category;
  if (b.location !== undefined) patch.location = String(b.location).trim();
  if (b.responsible_person !== undefined) patch.responsiblePerson = String(b.responsible_person).trim();
  if (b.quantity !== undefined) patch.quantity = parseInt(b.quantity) || 1;
  if (b.initial_cost !== undefined) patch.initialCost = String(parseFloat(b.initial_cost) || 0);
  if (b.commissioning_date !== undefined) patch.commissioningDate = b.commissioning_date || null;
  if (b.status !== undefined) patch.status = b.status;
  if (b.serial_number !== undefined) patch.serialNumber = String(b.serial_number || '').trim();
  if (b.notes !== undefined) patch.notes = String(b.notes || '').trim();
  if (b.photo_url !== undefined) patch.photoUrl = b.photo_url || '';
  if (b.location_id !== undefined) patch.locationId = b.location_id || null;

  await db.update(schema.assets).set(patch).where(eq(schema.assets.id, b.id));
  await logAssetAction('asset_update', String(b.id), patch as Record<string, unknown>, session);
  return Response.json({ success: true });
}

export async function DELETE(req: Request) {
  const session = await requireSession();
  if (!CAN_EDIT.includes(session.role.split(':')[0])) {
    return Response.json({ error: 'Доступ только для администратора и менеджера' }, { status: 403 });
  }
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return Response.json({ error: 'Missing asset id' }, { status: 400 });

  await db.delete(schema.assets).where(eq(schema.assets.id, id));
  await logAssetAction('asset_delete', id, { status: 'deleted' }, session);
  return Response.json({ success: true });
}
