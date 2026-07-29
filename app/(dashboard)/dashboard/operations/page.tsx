import { CategoryGrid } from '@/components/category-grid';

export const metadata = { title: 'Операции' };

export default function OperationsPage() {
  return (
    <div>
      <h1 className="page-title">Операции</h1>
      <p className="page-subtitle">Ежедневные действия кассы и просмотр истории.</p>
      <CategoryGrid tiles={[
        { href: '/dashboard/cashier', icon: '🧾', title: 'Касса · закрыть смену', desc: 'Внести оплаты, расходы и зарплаты за день' },
        { href: '/dashboard/history', icon: '🗂️', title: 'История смен', desc: 'Все кассовые отчёты, экспорт в CSV, копирование номеров' },
      ]} />
    </div>
  );
}
