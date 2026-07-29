import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth-session';
import { AssetsClient } from './assets-client';

export const metadata = { title: 'Опись ОС' };
export const dynamic = 'force-dynamic';

export default async function AssetsPage() {
  const session = await getSession();
  if (!['admin', 'manager'].includes((session?.role || '').split(':')[0])) redirect('/dashboard/warehouse');

  return (
    <div className="grid">
      <div>
        <h1 className="page-title">Опись основных средств</h1>
        <p className="page-subtitle">Учёт оборудования, мебели и техники: инвентаризация по стикерам и штрихкодам.</p>
      </div>
      <AssetsClient />
    </div>
  );
}
