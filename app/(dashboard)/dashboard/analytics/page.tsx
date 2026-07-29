import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth-session';
import { CategoryGrid } from '@/components/category-grid';

export const metadata = { title: 'Аналитика' };
export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
  const session = await getSession();
  const baseRole = (session?.role || '').split(':')[0];
  const canSeeIiko = ['admin', 'director', 'manager'].includes(baseRole);
  const isAdmin = baseRole === 'admin';

  const tiles = [
    { href: '/dashboard/safe', icon: '💰', title: 'Сейф', desc: 'Остаток наличных, движение по дням, расходы из сейфа' },
    { href: '/dashboard/wages', icon: '👥', title: 'Зарплаты', desc: 'Итоги за период, разбивка по дням и сотрудникам' },
    { href: '/dashboard/pnl', icon: '📈', title: 'P&L', desc: 'Прибыль и убытки по данным кассы' },
  ];
  if (canSeeIiko) {
    tiles.push({ href: '/dashboard/iiko-analytics', icon: '📊', title: 'Аналитика iiko', desc: isAdmin ? 'P&L, топ блюд, KPI официантов и явки сотрудников из iiko' : 'P&L, топ блюд, KPI официантов из iiko' });
    tiles.push({ href: '/dashboard/menu-analytics', icon: '🍳', title: 'Аналитика меню', desc: 'Food cost и наценка по каждому блюду, ABC-анализ, поиск убыточных позиций' });
  }
  if (isAdmin) {
    tiles.push({ href: '/dashboard/reconciliation', icon: '🧮', title: 'Сверка iiko vs касса', desc: 'Сверка по типам оплаты за смену: iiko против того, что сдал кассир' });
  }

  return (
    <div>
      <h1 className="page-title">Аналитика</h1>
      <p className="page-subtitle">Финансовые отчёты и показатели за период.</p>
      <CategoryGrid tiles={tiles} />
    </div>
  );
}
