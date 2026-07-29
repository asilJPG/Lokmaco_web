'use client';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div className="card" style={{ width: 480, maxWidth: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>💥</div>
        <h1 style={{ fontSize: 20, marginBottom: 4 }}>Что-то сломалось</h1>
        <p className="page-subtitle" style={{ marginBottom: 16 }}>{error.message || 'Неожиданная ошибка'}</p>
        {error.digest && (
          <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-faint)', marginBottom: 16 }}>id: {error.digest}</div>
        )}
        <button type="button" onClick={() => reset()} className="btn btn--primary" style={{ width: '100%' }}>Попробовать снова</button>
      </div>
    </main>
  );
}
