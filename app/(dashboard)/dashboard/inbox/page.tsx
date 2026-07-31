import { getSession } from '@/lib/auth-session';
import { requireAccess } from '@/lib/access';
import { InboxClient } from './inbox-client';

export const metadata = { title: 'Подтверждения' };
export const dynamic = 'force-dynamic';

export default async function InboxPage() {
  requireAccess((await getSession())?.role, 'inbox', '/dashboard');

  return (
    <div className="grid">
      <div>
        <h1 className="page-title">Подтверждения</h1>
        <p className="page-subtitle">Перемещения, ожидающие действия от тебя.</p>
      </div>
      <InboxClient />
    </div>
  );
}
