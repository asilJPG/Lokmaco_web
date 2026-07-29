import { eq, desc } from 'drizzle-orm';
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

  return Response.json({ data: rows });
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

  // Инвентарный номер можно не вводить — соберём из локации и случайного числа.
  let invNumber = String(b.inv_number || '').trim();
  if (!invNumber) {
    const prefix = String(b.location || 'GEN').toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 4) || 'INV';
    invNumber = `INV-${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
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
  if (b.action === 'audit') {
    await db.update(schema.assets)
      .set({ lastInventoriedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.assets.id, b.id));
    await logAssetAction('asset_audit', String(b.id), { action: 'inventory_audit' }, session);
    return Response.json({ success: true });
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
