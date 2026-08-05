import { getSession } from '@/lib/auth-session';
import { requireAccess } from '@/lib/access';
import { ProductionClient } from './production-client';

export const metadata = { title: 'Приготовление' };
export const dynamic = 'force-dynamic';

export default async function ProductionPage() {
  const session = await getSession();
  requireAccess(session?.role, 'production', '/dashboard/warehouse');
  // Склад акта приготовления берётся из роли на сервере; сюда он нужен только
  // как контекст черновика, чтобы бар и кухня не делили одну запись.
  const storeId = (session?.role || '').split(':')[1] || null;

  return (
    <div className="grid">
      <div>
        <h1 className="page-title">Приготовление (production)</h1>
        <p className="page-subtitle">Создаёт документ PRODUCTION_DOCUMENT в iiko для готовых заготовок.</p>
      </div>
      <ProductionClient storeId={storeId} />
    </div>
  );
}
