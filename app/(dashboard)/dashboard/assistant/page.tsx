import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth-session';
import { AssistantChat } from './chat';

export const metadata = { title: 'Ассистент' };
export const dynamic = 'force-dynamic';

export default async function AssistantPage() {
  const session = await getSession();
  if ((session?.role || '').split(':')[0] !== 'admin') redirect('/dashboard');

  return (
    <div className="grid">
      <div>
        <h1 className="page-title">Ассистент</h1>
        <p className="page-subtitle">Вопросы про продажи, расходы и меню — ответы считаются прямо из iiko.</p>
      </div>
      <AssistantChat />
    </div>
  );
}
