export default function Loading() {
  const sk: React.CSSProperties = {
    background: 'linear-gradient(90deg, var(--surface-muted) 0%, color-mix(in srgb, var(--surface-muted) 60%, var(--border)) 50%, var(--surface-muted) 100%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.6s linear infinite',
    borderRadius: 6,
  };
  return (
    <div className="grid" aria-busy="true">
      <div>
        <div style={{ ...sk, height: 24, width: 220, marginBottom: 8 }} />
        <div style={{ ...sk, height: 14, width: 340 }} />
      </div>
      <div className="card" style={{ ...sk, height: 72 }} />
      <div className="stat-grid">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="stat-card" style={{ minHeight: 90 }}>
            <div style={{ ...sk, height: 10, width: 100, marginBottom: 12 }} />
            <div style={{ ...sk, height: 28, width: 140 }} />
          </div>
        ))}
      </div>
      <div className="card" style={{ ...sk, height: 240 }} />
    </div>
  );
}
