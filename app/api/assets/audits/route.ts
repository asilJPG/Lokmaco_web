import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { db, schema } from '@/db/client';
import { requireSession } from '@/lib/auth-session';
import { getCurrentFilialIds } from '@/lib/current-filial';

export const dynamic = 'force-dynamic';

/**
 * Обход инвентаризации как документ.
 *
 * Сканируют и обходят не только админы, поэтому начать и закрыть обход может
 * любая залогиненная роль — ровно как отметку `audit` в `/api/assets`.
 * Ограничение здесь только одно: чужой филиал не тронуть.
 */

/** История обходов и незакрытые. */
export async function GET() {
  const session = await requireSession();
  const filialIds = await getCurrentFilialIds();
  if (filialIds.length === 0) return Response.json({ audits: [], open: null });

  const rows = await db
    .select()
    .from(schema.assetAudits)
    .where(inArray(schema.assetAudits.filialId, filialIds))
    .orderBy(desc(schema.assetAudits.startedAt))
    .limit(50);

  // Незакрытый обход — не ошибка: телефон сел, человека отвлекли. Показываем
  // его отдельно, чтобы можно было продолжить, а не начинать заново.
  const [open] = await db
    .select()
    .from(schema.assetAudits)
    .where(and(inArray(schema.assetAudits.filialId, filialIds), isNull(schema.assetAudits.finishedAt), eq(schema.assetAudits.startedBy, session.name)))
    .orderBy(desc(schema.assetAudits.startedAt))
    .limit(1);

  return Response.json({ audits: rows, open: open || null });
}

/** Начать обход. */
export async function POST(req: Request) {
  const session = await requireSession();
  const filialIds = await getCurrentFilialIds();
  if (filialIds.length === 0) return Response.json({ error: 'Филиал не выбран' }, { status: 400 });

  const b = await req.json().catch(() => ({}));
  // Дата документа и ответственный приходят из формы: обход закрывают и на
  // следующий день, а проводит его не обязательно тот, кто держит телефон.
  const [row] = await db.insert(schema.assetAudits).values({
    filialId: filialIds[0],
    locationId: b?.location_id || null,
    startedBy: session.name,
    actDate: typeof b?.act_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.act_date) ? b.act_date : null,
    performedBy: String(b?.performed_by || session.name).trim().slice(0, 120),
  }).returning();

  return Response.json({ success: true, audit: row });
}

/**
 * Закрыть обход или обновить метаданные (дату, кто проводит, примечание).
 */
export async function PATCH(req: Request) {
  const session = await requireSession();
  const filialIds = await getCurrentFilialIds();

  const b = await req.json().catch(() => ({}));
  const id = String(b?.id || '');
  if (!id) return Response.json({ error: 'Не указан обход' }, { status: 400 });

  const [audit] = await db
    .select()
    .from(schema.assetAudits)
    .where(and(eq(schema.assetAudits.id, id), inArray(schema.assetAudits.filialId, filialIds)));
  if (!audit) return Response.json({ error: 'Обход не найден' }, { status: 404 });

  // Если это редактирование метаданных (даты, кто проводил, примечания)
  if (b?.action === 'update_meta') {
    const updates: Partial<typeof schema.assetAudits.$inferInsert> = {};
    if (typeof b.act_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.act_date)) {
      updates.actDate = b.act_date;
    }
    if (typeof b.performed_by === 'string') {
      updates.performedBy = b.performed_by.trim().slice(0, 120);
    }
    if (typeof b.note === 'string') {
      updates.note = b.note.trim().slice(0, 500);
    }
    if (b.location_id !== undefined) {
      updates.locationId = b.location_id || null;
    }

    const [updated] = await db
      .update(schema.assetAudits)
      .set(updates)
      .where(eq(schema.assetAudits.id, id))
      .returning();

    return Response.json({ success: true, audit: updated });
  }

  if (audit.finishedAt) return Response.json({ error: 'Этот обход уже закрыт' }, { status: 409 });

  const scannedIds: string[] = Array.isArray(b?.scanned) ? b.scanned.map(String).filter(Boolean) : [];

  const all = await db.select().from(schema.assets).where(eq(schema.assets.filialId, audit.filialId));
  const scope = all.filter((a) => (
    a.status !== 'archived' && (!audit.locationId || a.locationId === audit.locationId)
  ));
  const scannedSet = new Set(scannedIds);

  const snapshot = (a: typeof all[number]) => ({
    id: a.id,
    inv_number: a.invNumber,
    name: a.name,
    code: a.serialNumber || '',
    cost: Number(a.initialCost) || 0,
  });
  const scanned = scope.filter((a) => scannedSet.has(a.id)).map(snapshot);
  const missing = scope.filter((a) => !scannedSet.has(a.id)).map(snapshot);
  const scopeIds = new Set(scope.map((a) => a.id));
  const surplus = all.filter((a) => scannedSet.has(a.id) && !scopeIds.has(a.id)).map(snapshot);

  const now = new Date();
  if (scannedIds.length > 0) {
    await db.update(schema.assets)
      .set({ lastInventoriedAt: now, updatedAt: now })
      .where(inArray(schema.assets.id, scannedIds));
  }

  const actDate = typeof b?.act_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.act_date) ? b.act_date : audit.actDate;
  const performedBy = typeof b?.performed_by === 'string' && b.performed_by.trim() ? b.performed_by.trim().slice(0, 120) : audit.performedBy;

  await db.update(schema.assetAudits)
    .set({
      finishedAt: now,
      scanned,
      missing,
      surplus,
      note: String(b?.note || audit.note || ''),
      actDate,
      performedBy,
    })
    .where(eq(schema.assetAudits.id, id));

  await db.insert(schema.botActions).values({
    filialId: audit.filialId,
    tgId: session.tgId,
    userName: session.name,
    actionType: 'asset_audit',
    documentNumber: id,
    details: { scanned: scanned.length, missing: missing.length, surplus: surplus.length, location_id: audit.locationId },
  });

  return Response.json({ success: true, id, scanned: scanned.length, missing: missing.length, surplus: surplus.length });
}

/** Удалить обход (как незакрытый, так и завершённый). */
export async function DELETE(req: Request) {
  await requireSession();
  const filialIds = await getCurrentFilialIds();
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return Response.json({ error: 'Не указан обход' }, { status: 400 });

  await db.delete(schema.assetAudits).where(and(
    eq(schema.assetAudits.id, id),
    inArray(schema.assetAudits.filialId, filialIds),
  ));
  return Response.json({ success: true });
}
