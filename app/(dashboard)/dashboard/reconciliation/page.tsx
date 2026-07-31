import { requireAccess } from '@/lib/access';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth-session';
import { ReconciliationClient } from './reconciliation-client';

export const metadata = { title: 'Отчёты' };
export const dynamic = 'force-dynamic';

export default async function ReconciliationPage() {
  const session = await getSession();
  requireAccess(session?.role, 'reconciliation', '/dashboard/finance');

  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  return (
    <div className="grid">
      <div>
        <h1 className="page-title">Отчёты</h1>
        <p className="page-subtitle">Месячная сводка кассы: типы оплат по данным кассира и сверка с продажами iiko.</p>
      </div>
      <ReconciliationClient initialMonth={month} />
    </div>
  );
}
