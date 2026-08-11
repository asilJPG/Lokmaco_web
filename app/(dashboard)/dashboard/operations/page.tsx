import { and, inArray, or, eq, sql } from 'drizzle-orm';
import { db, schema } from '@/db/client';
import { getSession } from '@/lib/auth-session';
import { CategoryGrid } from '@/components/category-grid';
import { getUserFilialIds } from '@/lib/current-filial';

export const metadata = { title: 'Смена' };
export const dynamic = 'force-dynamic';

export default async function OperationsPage() {
  const session = await getSession();
  const filialIds = await getUserFilialIds();

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
      <h1 className="page-title">Смена</h1>
      <p className="page-subtitle">Ежедневные действия кассы и история отчётов.</p>
      <CategoryGrid role={session?.role || ''} tiles={[
        { href: '/dashboard/cashier', icon: '🧾', title: 'Закрыть смену', desc: 'Внести оплаты, расходы и зарплаты за день' },
        { href: '/dashboard/inbox', icon: '📨', title: 'Подтверждения', desc: 'Перемещения, ожидающие твоей реакции', badge: inbox },
        { href: '/dashboard/history', icon: '🗂️', title: 'История смен', desc: 'Все кассовые отчёты, экспорт в CSV, копирование номеров' },
        // Роль фильтрует сам CategoryGrid по матрице — своей проверки здесь
        // быть не должно, иначе она разъедется с меню (так и вышло: у «Явок»
        // тут стоял admin, а в матрице — admin + director).
        { href: '/dashboard/attendance', icon: '🕒', title: 'Явки', desc: 'Приходы и уходы сотрудников из iiko' },
      ]} />
    </div>
  );
}
