import { CategoryGrid } from '@/components/category-grid';
import { getSession } from '@/lib/auth-session';

export const metadata = { title: 'Финансы' };
export const dynamic = 'force-dynamic';

export default async function FinancePage() {
  const session = await getSession();
  const isAdmin = (session?.role || '').split(':')[0] === 'admin';
  return (
    <div>
      <h1 className="page-title">Финансы</h1>
      <p className="page-subtitle">Деньги по данным кассы: наличные, зарплаты, прибыль.</p>
      <CategoryGrid tiles={[
        { href: '/dashboard/safe', icon: '💰', title: 'Сейф', desc: 'Остаток наличных, движение по дням, расходы из сейфа' },
        { href: '/dashboard/wages', icon: '👥', title: 'Зарплаты', desc: 'Итоги за период, разбивка по дням и сотрудникам' },
        { href: '/dashboard/pnl', icon: '📈', title: 'P&L', desc: 'Прибыль и убытки по данным кассы' },
        ...(isAdmin ? [{ href: '/dashboard/reconciliation', icon: '🧮', title: 'Сверка', desc: 'Отчёты кассиров против продаж iiko по месяцам' }] : []),
      ]} />
    </div>
  );
}
