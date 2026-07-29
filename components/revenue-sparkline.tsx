import { fmtMoney } from '@/lib/period';

export type SparkPoint = { date: string; value: number };

/**
 * Inline SVG sparkline. No dependencies, scales to container width.
 */
export function RevenueSparkline({ points }: { points: SparkPoint[] }) {
  const w = 640;
  const h = 140;
  const padX = 8;
  const padY = 18;

  if (points.length === 0) {
    return <div className="empty-state">Нет данных за 7 дней</div>;
  }

  const max = Math.max(1, ...points.map((p) => p.value));
  const min = 0;
  const n = points.length;
  const stepX = (w - padX * 2) / Math.max(1, n - 1);

  const xy = points.map((p, i) => {
    const x = padX + i * stepX;
    const ratio = (p.value - min) / (max - min || 1);
    const y = h - padY - ratio * (h - padY * 2);
    return { x, y, ...p };
  });

  const linePath = xy.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${xy[n - 1].x.toFixed(1)} ${h - padY} L ${xy[0].x.toFixed(1)} ${h - padY} Z`;

  const total = points.reduce((s, p) => s + p.value, 0);
  const avg = total / n;
  const last = points[n - 1].value;
  const prev = n > 1 ? points[n - 2].value : 0;
  const delta = prev === 0 ? null : ((last - prev) / prev) * 100;

  return (
    <div className="card" style={{ padding: 'var(--space-4)' }}>
      <div className="card__title">
        <span className="card__title-text">📈 Выручка · 7 дней</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
          Σ {fmtMoney(total)} · ø {fmtMoney(Math.round(avg))}
          {delta !== null && (
            <span style={{ marginLeft: 8, color: delta >= 0 ? 'var(--success)' : 'var(--danger)' }}>
              {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}%
            </span>
          )}
        </span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: 140, display: 'block' }} role="img" aria-label="График выручки">
        <defs>
          <linearGradient id="spark-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* zero baseline */}
        <line x1={padX} x2={w - padX} y1={h - padY} y2={h - padY} stroke="var(--border)" strokeWidth="1" />
        <path d={areaPath} fill="url(#spark-area)" />
        <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {xy.map((p, i) => (
          <circle key={p.date} cx={p.x} cy={p.y} r={i === n - 1 ? 4 : 2.5} fill="var(--accent)" stroke="var(--surface)" strokeWidth="1.5" aria-label={`${p.date}: ${fmtMoney(p.value)}`}>
            <desc>{`${p.date}: ${fmtMoney(p.value)}`}</desc>
          </circle>
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: 'var(--text-faint)', fontVariantNumeric: 'tabular-nums' }}>
        {xy.map((p) => (
          <span key={p.date}>{p.date.slice(5)}</span>
        ))}
      </div>
    </div>
  );
}
