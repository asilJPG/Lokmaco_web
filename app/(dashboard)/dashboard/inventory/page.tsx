import { getSession } from '@/lib/auth-session';
import { canAccess, requireAccess } from '@/lib/access';
import { InventoryTabs } from './inventory-tabs';

export const metadata = { title: 'Инвентаризация' };
export const dynamic = 'force-dynamic';

export default async function InventoryPage() {
  const session = await getSession();
  requireAccess(session?.role, 'inventory', '/dashboard/warehouse');

  return (
    <div className="grid">
      <div>
        <h1 className="page-title">Инвентаризация</h1>
        <p className="page-subtitle">Создаёт документ INVENTORY в iiko с фактическими остатками.</p>
      </div>
      <InventoryTabs canSeeDiscrepancies={canAccess(session?.role, 'reconciliation')} />
    </div>
  );
}
