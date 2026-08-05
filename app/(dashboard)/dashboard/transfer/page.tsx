import { getSession } from '@/lib/auth-session';
import { canAccess, requireAccess } from '@/lib/access';
import { TransferClient } from './transfer-client';

export const metadata = { title: 'Перемещение' };
export const dynamic = 'force-dynamic';

export default async function TransferPage() {
  const session = await getSession();
  requireAccess(session?.role, 'transfer', '/dashboard/warehouse');
  // Право на прямую отправку решает матрица; клиент своих проверок роли не делает.
  const canSendDirect = canAccess(session?.role, 'transferDirect');

  return (
    <div className="grid">
      <div>
        <h1 className="page-title">Перемещение между складами</h1>
        <p className="page-subtitle">Документ сразу создаётся в iiko в статусе PROCESSED.</p>
      </div>
      <TransferClient canSendDirect={canSendDirect} />
    </div>
  );
}
