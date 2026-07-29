import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth-session';
import { CategoryGrid } from '@/components/category-grid';

export const metadata = { title: 'Аналитика' };
export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
  const session = await getSession();
  const baseRole = (session?.role || '').split(':')[0];
  if (!['admin', 'director', 'manager'].includes(baseRole)) redirect('/dashboard/finance');
  const isAdmin = baseRole === 'admin';

  const tiles = [
    { href: '/dashboard/iiko-analytics', icon: '📊', title: 'Обзор и продажи', desc: 'Выручка, гости, средний чек, загрузка по часам, P&L и топ блюд' },
    { href: '/dashboard/menu-analytics', icon: '🍽', title: 'Меню и food cost', desc: 'Себестоимость и наценка по блюдам, ABC-анализ, потенциал по марже' },
    { href: '/dashboard/menu-analytics?tab=prices', icon: '🏷', title: 'Закупки и цены', desc: 'Поставщики, история закупочных цен, алерты на скачки' },
  ];
  if (isAdmin) {
    tiles.push({ href: '/dashboard/reconciliation', icon: '🧮', title: 'Сверка с кассой', desc: 'iiko против того, что сдал кассир, по типам оплаты' });
  }

  return (
    <div>
      <h1 className="page-title">Аналитика</h1>
      <p className="page-subtitle">Показатели из iiko: продажи, меню, закупки.</p>
      <CategoryGrid tiles={tiles} />
    </div>
  );
}
