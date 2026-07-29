import { CategoryGrid } from '@/components/category-grid';

export const metadata = { title: 'Финансы' };

export default function FinancePage() {
  return (
    <div>
      <h1 className="page-title">Финансы</h1>
      <p className="page-subtitle">Деньги по данным кассы: наличные, зарплаты, прибыль.</p>
      <CategoryGrid tiles={[
        { href: '/dashboard/safe', icon: '💰', title: 'Сейф', desc: 'Остаток наличных, движение по дням, расходы из сейфа' },
        { href: '/dashboard/wages', icon: '👥', title: 'Зарплаты', desc: 'Итоги за период, разбивка по дням и сотрудникам' },
        { href: '/dashboard/pnl', icon: '📈', title: 'P&L', desc: 'Прибыль и убытки по данным кассы' },
      ]} />
    </div>
  );
}
