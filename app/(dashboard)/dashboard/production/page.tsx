import { getSession } from '@/lib/auth-session';
import { requireAccess } from '@/lib/access';
import { ProductionClient } from './production-client';

export const metadata = { title: 'Приготовление' };
export const dynamic = 'force-dynamic';

export default async function ProductionPage() {
  requireAccess((await getSession())?.role, 'production', '/dashboard/warehouse');

  return (
    <div className="grid">
      <div>
        <h1 className="page-title">Приготовление (production)</h1>
        <p className="page-subtitle">Создаёт документ PRODUCTION_DOCUMENT в iiko для готовых заготовок.</p>
      </div>
      <ProductionClient />
    </div>
  );
}
