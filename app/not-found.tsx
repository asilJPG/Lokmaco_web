import Link from 'next/link';

export const metadata = { title: 'Не найдено' };

export default function NotFound() {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 16, background: 'var(--bg)' }}>
      <div className="card" style={{ width: 360, maxWidth: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🔍</div>
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>404</h1>
        <p className="page-subtitle" style={{ marginBottom: 20 }}>Страница не найдена</p>
        <Link href="/dashboard" className="btn btn--primary" style={{ width: '100%' }}>На главную</Link>
      </div>
    </main>
  );
}
