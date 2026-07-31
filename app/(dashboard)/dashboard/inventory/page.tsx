import { getSession } from '@/lib/auth-session';
import { requireAccess } from '@/lib/access';
import { InventoryClient } from './inventory-client';

export const metadata = { title: 'Инвентаризация' };
export const dynamic = 'force-dynamic';

export default async function InventoryPage() {
  requireAccess((await getSession())?.role, 'inventory', '/dashboard/warehouse');

  return (
    <div className="grid">
      <div>
        <h1 className="page-title">Инвентаризация</h1>
        <p className="page-subtitle">Создаёт документ INVENTORY в iiko с фактическими остатками.</p>
      </div>
      <InventoryClient />
    </div>
  );
}
