import { InboxClient } from './inbox-client';

export const metadata = { title: 'Подтверждения' };
export const dynamic = 'force-dynamic';

export default function InboxPage() {
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
