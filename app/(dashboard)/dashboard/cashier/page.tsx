import CashierForm from './form';

export const metadata = { title: 'Касса' };
export const dynamic = 'force-dynamic';

export default function CashierPage() {
  const today = new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);
  return (
    <div>
      <h1 className="page-title">Закрытие смены</h1>
      <p className="page-subtitle">Заполни оплаты, расходы и зарплаты — отчёт уйдёт в базу.</p>
      <CashierForm defaultDate={today} />
    </div>
  );
}
