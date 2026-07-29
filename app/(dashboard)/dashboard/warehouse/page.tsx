import { and, eq, inArray, or, sql } from 'drizzle-orm';
import { getSession } from '@/lib/auth-session';
import { db, schema } from '@/db/client';
import { CategoryGrid } from '@/components/category-grid';

export const metadata = { title: 'Склад' };
export const dynamic = 'force-dynamic';

export default async function WarehousePage() {
  const session = await getSession();
  const filialIds = session?.filialIds ?? [];

  const inbox = filialIds.length === 0 ? 0 : Number((await db
    .select({ c: sql<number>`count(*)::int` })
    .from(schema.pendingTransfers)
    .where(and(
      inArray(schema.pendingTransfers.filialId, filialIds),
      or(
        eq(schema.pendingTransfers.status, 'pending_receiver'),
        eq(schema.pendingTransfers.status, 'pending_sender'),
        eq(schema.pendingTransfers.status, 'pending_creator')
      )!
    )))[0]?.c || 0);

  return (
    <div>
      <h1 className="page-title">Склад</h1>
      <p className="page-subtitle">Остатки, перемещения, инвентаризация, документы iiko.</p>
      <CategoryGrid tiles={[
        { href: '/dashboard/balances', icon: '📦', title: 'Остатки', desc: 'Текущие запасы iiko с поиском и экспортом' },
        { href: '/dashboard/transfer', icon: '🔄', title: 'Перемещение', desc: 'Между складами · сразу в iiko или через подтверждение' },
        { href: '/dashboard/invoice', icon: '🧾', title: 'Приход накладной', desc: 'Текст накладной → AI-распознавание → документ в iiko' },
        { href: '/dashboard/inbox', icon: '📨', title: 'Подтверждения', desc: 'Ожидают твоей реакции', badge: inbox },
        { href: '/dashboard/inventory', icon: '📋', title: 'Инвентаризация', desc: 'Ввести фактические остатки на складе' },
        { href: '/dashboard/production', icon: '🍳', title: 'Приготовление', desc: 'Заготовки и полуфабрикаты' },
        { href: '/dashboard/documents', icon: '📑', title: 'Документы iiko', desc: 'Все документы за период, фильтр по типу' },
      ]} />
    </div>
  );
}
