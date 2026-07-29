import { ProductionClient } from './production-client';

export const metadata = { title: 'Приготовление' };
export const dynamic = 'force-dynamic';

export default function ProductionPage() {
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
