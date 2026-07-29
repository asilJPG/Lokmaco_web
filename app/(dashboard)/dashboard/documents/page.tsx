import { DocumentsClient } from './documents-client';

export const metadata = { title: 'Документы' };
export const dynamic = 'force-dynamic';

export default function DocumentsPage() {
  return (
    <div className="grid">
      <div>
        <h1 className="page-title">Документы iiko</h1>
        <p className="page-subtitle">Все документы (transfer / invoice / inventory / production) из iikoWeb.</p>
      </div>
      <DocumentsClient />
    </div>
  );
}
