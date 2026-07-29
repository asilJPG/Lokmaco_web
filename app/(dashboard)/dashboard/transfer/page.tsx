import { TransferClient } from './transfer-client';

export const metadata = { title: 'Перемещение' };
export const dynamic = 'force-dynamic';

export default function TransferPage() {
  return (
    <div className="grid">
      <div>
        <h1 className="page-title">Перемещение между складами</h1>
        <p className="page-subtitle">Документ сразу создаётся в iiko в статусе PROCESSED.</p>
      </div>
      <TransferClient />
    </div>
  );
}
