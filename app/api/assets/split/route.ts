import { eq } from 'drizzle-orm';
import { db, schema } from '@/db/client';
import { requireSession } from '@/lib/auth-session';
import { getCurrentFilialIds } from '@/lib/current-filial';
import { baseInvNumber, unitInvNumber } from '@/lib/inv-number';

export const dynamic = 'force-dynamic';

const ALLOWED = ['admin', 'manager'];
const MAX_UNITS = 200;

/**
 * Разворот позиции «4 штуки» в четыре карточки — по одной на предмет.
 *
 * Иначе на вопрос «какой из четырёх столов пропал» ответить нечем: у одной
 * позиции с `quantity = 4` может быть только одна наклейка, и инвентаризация
 * покажет «стол на месте», даже если из четырёх остался один.
 *
 * ⚠️ В iiko при этом **ничего не меняется**: там остаётся одна номенклатура на
 * N штук, мы читаем её как есть. Разбивка живёт только на сайте. В списке
 * такие карточки тоже показываются одной строкой — «Стол · 4 шт».
 */
export async function POST(req: Request) {
  const session = await requireSession();
  if (!ALLOWED.includes(session.role.split(':')[0])) {
    return Response.json({ error: 'Доступ только для администратора и менеджера' }, { status: 403 });
  }

  const b = await req.json().catch(() => ({}));
  const id = String(b?.id || '');
  if (!id) return Response.json({ error: 'Не указана позиция' }, { status: 400 });

  const [asset] = await db.select().from(schema.assets).where(eq(schema.assets.id, id));
  if (!asset) return Response.json({ error: 'Позиция не найдена' }, { status: 404 });

  const n = parseInt(String(b?.count ?? asset.quantity ?? 0), 10);
  if (!Number.isFinite(n) || n < 2) return Response.json({ error: 'Количество должно быть 2 или больше' }, { status: 400 });
  if (n > MAX_UNITS) return Response.json({ error: `За раз можно разбить максимум на ${MAX_UNITS} штук` }, { status: 400 });

  const base = baseInvNumber(asset.invNumber || `EQ-${asset.id.slice(0, 6)}`);
  if (baseInvNumber(asset.invNumber) !== asset.invNumber) {
    return Response.json({ error: 'Эта позиция уже разбита на экземпляры' }, { status: 400 });
  }

  // Стоимость делим поровну, остаток от округления отдаём последнему
  // экземпляру: сумма по карточкам обязана сойтись с исходной до копейки,
  // иначе разбивка тихо меняет стоимость ОС на балансе.
  const total = Number(asset.initialCost) || 0;
  const per = Math.floor((total / n) * 100) / 100;
  const lastCost = Math.round((total - per * (n - 1)) * 100) / 100;

  const note = (i: number) => `Экземпляр ${i} из ${n}. Разбито из позиции ${asset.invNumber || asset.id}.${asset.notes ? ' ' + asset.notes : ''}`;

  // ⚠️ Первым экземпляром делаем саму исходную карточку, а не создаём её
  // заново: на ней уже может висеть наклейка и отметки инвентаризации, и
  // удаление источника всё это обнулило бы.
  //
  // ⚠️ `serial_number` при этом НЕ трогаем: там лежит код iiko, по которому
  // сверка узнаёт карточку. Легаси писал туда номер экземпляра — из-за этого
  // связь с номенклатурой терялась.
  await db.update(schema.assets).set({
    invNumber: unitInvNumber(base, 1, n),
    quantity: 1,
    initialCost: String(per),
    notes: note(1),
    updatedAt: new Date(),
  }).where(eq(schema.assets.id, id));

  const rest = Array.from({ length: n - 1 }, (_, k) => {
    const i = k + 2;
    return {
      invNumber: unitInvNumber(base, i, n),
      name: asset.name,
      category: asset.category || 'Оборудование',
      location: asset.location || '',
      locationId: asset.locationId,
      responsiblePerson: asset.responsiblePerson || '',
      quantity: 1,
      initialCost: String(i === n ? lastCost : per),
      commissioningDate: asset.commissioningDate,
      status: asset.status || 'in_use',
      serialNumber: asset.serialNumber || '',
      notes: note(i),
      photoUrl: asset.photoUrl || '',
      source: asset.source,
    };
  });

  const created = await db.insert(schema.assets).values(rest).returning({ id: schema.assets.id, invNumber: schema.assets.invNumber });

  const filialIds = await getCurrentFilialIds();
  if (filialIds.length > 0) {
    await db.insert(schema.botActions).values({
      filialId: filialIds[0], tgId: session.tgId, userName: session.name,
      actionType: 'asset_split', documentNumber: asset.invNumber || id,
      details: { source_id: id, name: asset.name, count: n, total_cost: total },
    });
  }

  return Response.json({
    success: true,
    count: created.length + 1,
    message: `«${asset.name}» разбит на ${n} экземпляров — теперь у каждого своя наклейка`,
  });
}
