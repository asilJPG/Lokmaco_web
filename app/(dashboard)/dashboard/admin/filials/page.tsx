import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth-session';
import { listFilials } from '@/lib/admin-users';
import { FilialsClient } from './filials-client';

export const metadata = { title: 'Филиалы' };
export const dynamic = 'force-dynamic';

export default async function FilialsPage() {
  const session = await getSession();
  if (session?.role.split(':')[0] !== 'admin') redirect('/dashboard');
  const filials = await listFilials();
  return (
    <div className="grid">
      <div>
        <h1 className="page-title">Филиалы</h1>
        <p className="page-subtitle">Каждый филиал имеет свои iiko-доступы.</p>
      </div>
      <FilialsClient filials={filials} />
    </div>
  );
}
