import { CategoryGrid } from '@/components/category-grid';
import { getSession } from '@/lib/auth-session';

export const metadata = { title: 'Финансы' };
export const dynamic = 'force-dynamic';

export default async function FinancePage() {
  const session = await getSession();
  const baseRole = (session?.role || '').split(':')[0];
  const isAdmin = baseRole === 'admin';
  const canTax = baseRole === 'admin' || baseRole === 'director';
  return (
    <div>
      <h1 className="page-title">Финансы</h1>
      <p className="page-subtitle">Деньги по данным кассы: наличные, зарплаты, прибыль.</p>
      <CategoryGrid role={session?.role || ''} tiles={[
        { href: '/dashboard/safe', icon: '💰', title: 'Сейф', desc: 'Остаток наличных, движение по дням, расходы из сейфа' },
        { href: '/dashboard/wages', icon: '👥', title: 'Зарплаты', desc: 'Итоги за период, разбивка по дням и сотрудникам' },
        { href: '/dashboard/pnl', icon: '📈', title: 'P&L', desc: 'Прибыль и убытки по данным кассы' },
        ...(canTax ? [{ href: '/dashboard/tax-report', icon: '🧾', title: 'Налоговый отчёт', desc: 'Реализация, расход сырья, списания — выгрузка для 1С' }] : []),
        ...(isAdmin ? [{ href: '/dashboard/reconciliation', icon: '🧮', title: 'Отчёты кассы', desc: 'Месячная сводка: типы оплат, продажи iiko, расхождения' }] : []),
      ]} />
    </div>
  );
}
