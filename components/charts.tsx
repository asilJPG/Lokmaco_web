'use client';

/**
 * Small SVG chart primitives. Deliberately dependency-free: the whole app ships
 * without a charting library, and these views need only a handful of shapes.
 */

import { useId, useState } from 'react';

function fmt(n: number): string {
  return Math.round(n).toLocaleString('ru-RU');
}

function shortNumber(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${Math.round(n / 1000)}K`;
  return String(Math.round(n));
}

export type SeriesPoint = { label: string; value: number };

/**
 * Line chart with an optional faded comparison series behind it.
 * Hovering a point reveals its exact value.
 */
export function LineChart({
  points,
  compare,
  height = 200,
  color = 'var(--accent)',
  valueLabel = '',
}: {
  points: SeriesPoint[];
  compare?: SeriesPoint[];
  height?: number;
  color?: string;
  valueLabel?: string;
}) {
  const gradientId = useId();
  const [hover, setHover] = useState<number | null>(null);

  if (points.length === 0) return <div className="empty-state">Нет данных за период</div>;

  const W = 800;
  const H = height;
  const padL = 48;
  const padR = 8;
  const padT = 12;
  const padB = 26;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const all = [...points.map((p) => p.value), ...(compare?.map((p) => p.value) ?? []), 0];
  const max = Math.max(...all) || 1;

  const x = (i: number, len: number) => padL + (len <= 1 ? innerW / 2 : (i / (len - 1)) * innerW);
  const y = (v: number) => padT + innerH - (v / max) * innerH;

  const path = (list: SeriesPoint[]) =>
    list.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i, list.length).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');

  const area = `${path(points)} L ${x(points.length - 1, points.length).toFixed(1)} ${padT + innerH} L ${x(0, points.length).toFixed(1)} ${padT + innerH} Z`;

  // Four horizontal guides are enough to read the scale without crowding it.
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ v: max * f, y: y(max * f) }));
  const labelEvery = Math.ceil(points.length / 10);

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: 320, display: 'block' }} role="img">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={padL} y1={t.y} x2={W - padR} y2={t.y} stroke="var(--border)" strokeWidth="1" />
            <text x={padL - 8} y={t.y + 3} textAnchor="end" fontSize="10" fill="var(--text-faint)">{shortNumber(t.v)}</text>
          </g>
        ))}

        {compare && compare.length > 1 && (
          <path d={path(compare)} fill="none" stroke="var(--text-faint)" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.7" />
        )}

        <path d={area} fill={`url(#${gradientId})`} />
        <path d={path(points)} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={x(i, points.length)}
              cy={y(p.value)}
              r={hover === i ? 4 : 2.5}
              fill={color}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: 'pointer' }}
            />
            {i % labelEvery === 0 && (
              <text x={x(i, points.length)} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--text-faint)">
                {p.label}
              </text>
            )}
          </g>
        ))}

        {hover !== null && points[hover] && (
          <text
            x={Math.min(Math.max(x(hover, points.length), padL + 40), W - padR - 40)}
            y={Math.max(y(points[hover].value) - 10, 14)}
            textAnchor="middle"
            fontSize="12"
            fontWeight="700"
            fill="var(--text)"
          >
            {fmt(points[hover].value)} {valueLabel}
          </text>
        )}
      </svg>
    </div>
  );
}

/** Horizontal share bars — a readable stand-in for a pie chart. */
export function ShareBars({ items, max = 8 }: { items: { name: string; value: number; share: number }[]; max?: number }) {
  if (items.length === 0) return <div className="empty-state">Нет данных</div>;
  const shown = items.slice(0, max);
  const top = shown[0]?.share || 1;

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {shown.map((it) => (
        <div key={it.name}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, marginBottom: 4 }}>
            <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
              {fmt(it.value)}
              <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>{it.share.toFixed(1)}%</span>
            </span>
          </div>
          <div style={{ height: 6, background: 'var(--surface-muted)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${(it.share / top) * 100}%`, height: '100%', background: 'var(--accent)', borderRadius: 999 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

const WEEKDAY_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

/** Weekday × hour heatmap — shows when the kitchen is actually under load. */
export function Heatmap({ cells }: { cells: { weekday: number; hour: number; value: number }[] }) {
  if (cells.length === 0) return <div className="empty-state">Нет данных</div>;

  const hours = [...new Set(cells.map((c) => c.hour))].sort((a, b) => a - b);
  const max = Math.max(...cells.map((c) => c.value)) || 1;
  const byKey = new Map(cells.map((c) => [`${c.weekday}:${c.hour}`, c.value]));

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'separate', borderSpacing: 2, fontSize: 10 }}>
        <thead>
          <tr>
            <th />
            {hours.map((h) => (
              <th key={h} style={{ color: 'var(--text-faint)', fontWeight: 500, padding: '0 1px' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {WEEKDAY_SHORT.map((label, wd) => (
            <tr key={wd}>
              <td style={{ color: 'var(--text-muted)', paddingRight: 6, whiteSpace: 'nowrap' }}>{label}</td>
              {hours.map((h) => {
                const v = byKey.get(`${wd}:${h}`) || 0;
                return (
                  <td
                    key={h}
                    title={`${label} ${h}:00 — ${fmt(v)}`}
                    style={{
                      width: 22,
                      height: 20,
                      borderRadius: 4,
                      // Opacity carries the value so the scale stays legible in both themes.
                      background: v > 0 ? `color-mix(in srgb, var(--accent) ${Math.round((v / max) * 100)}%, transparent)` : 'var(--surface-muted)',
                    }}
                  />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 11, color: 'var(--text-faint)' }}>
        <span>меньше</span>
        {[0.15, 0.35, 0.6, 0.85, 1].map((f) => (
          <span key={f} style={{ width: 16, height: 10, borderRadius: 3, background: `color-mix(in srgb, var(--accent) ${f * 100}%, transparent)` }} />
        ))}
        <span>больше</span>
      </div>
    </div>
  );
}

/** KPI tile with a period-over-period delta. */
export function KpiCard({
  label,
  value,
  deltaPercent,
  hint,
  positiveIsGood = true,
}: {
  label: string;
  value: string;
  deltaPercent?: number | null;
  hint?: string;
  positiveIsGood?: boolean;
}) {
  const up = (deltaPercent ?? 0) > 0;
  const good = up === positiveIsGood;
  const color = deltaPercent == null || Math.abs(deltaPercent) < 0.05
    ? 'var(--text-faint)'
    : good ? 'var(--success)' : 'var(--danger)';

  return (
    <div className="stat-card">
      <div className="stat-card__label">{label}</div>
      <div className="stat-card__value">{value}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4, fontSize: 11 }}>
        {deltaPercent != null && (
          <span style={{ color, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
            {up ? '↑' : deltaPercent < 0 ? '↓' : ''} {Math.abs(deltaPercent).toFixed(1)}%
          </span>
        )}
        <span style={{ color: 'var(--text-faint)' }}>{hint || (deltaPercent != null ? 'к пред. периоду' : '')}</span>
      </div>
    </div>
  );
}
