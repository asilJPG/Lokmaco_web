import { BalancesClient } from './balances-client';

export const metadata = { title: 'Остатки' };
export const dynamic = 'force-dynamic';

export default function BalancesPage() {
  return (
    <div className="grid">
      <div>
        <h1 className="page-title">Остатки на складах</h1>
        <p className="page-subtitle">Текущие запасы из iiko в режиме реального времени.</p>
      </div>
      <BalancesClient />
    </div>
  );
}
