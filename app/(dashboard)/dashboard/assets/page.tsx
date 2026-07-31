import { requireAccess } from '@/lib/access';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth-session';
import { AssetsClient } from './assets-client';

export const metadata = { title: 'Опись ОС' };
export const dynamic = 'force-dynamic';

export default async function AssetsPage() {
  const session = await getSession();
  requireAccess(session?.role, 'assets', '/dashboard/warehouse');

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
