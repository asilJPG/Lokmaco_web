import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth-session';
import { listUsers, listFilials } from '@/lib/admin-users';
import { UsersClient } from './users-client';

export const metadata = { title: 'Пользователи' };
export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const session = await getSession();
  if (session?.role.split(':')[0] !== 'admin') redirect('/dashboard');

  const [users, filials] = await Promise.all([listUsers(), listFilials()]);
  return (
    <div className="grid">
      <div>
        <h1 className="page-title">Пользователи</h1>
        <p className="page-subtitle">Создавай юзеров, выдавай коды, привязывай к филиалам.</p>
      </div>
      <UsersClient users={users} filials={filials.map((f) => ({ id: f.id, name: f.name }))} currentUserId={session.id} />
    </div>
  );
}
