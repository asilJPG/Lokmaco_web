import { getSession } from '@/lib/auth-session';
import { requireAccess } from '@/lib/access';
import { InvoiceClient } from './invoice-client';

export const metadata = { title: 'Приход накладной' };
export const dynamic = 'force-dynamic';

export default async function InvoicePage() {
  requireAccess((await getSession())?.role, 'invoice', '/dashboard/warehouse');

  return (
    <div className="grid">
      <div>
        <h1 className="page-title">Приход накладной</h1>
        <p className="page-subtitle">Продиктуй или вставь текст накладной — AI распознает позиции, ты проверишь и создашь документ в iiko.</p>
      </div>
      <InvoiceClient />
    </div>
  );
}
