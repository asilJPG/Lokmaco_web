'use client';

import { useEffect, useState } from 'react';

type Item = {
  date: string;
  document: string;
  store: string;
  surplus: number;
  shortage: number;
  net: number;
  base_revenue: number;
  base_scope: string;
  surplus_pct: number | null;
  shortage_pct: number | null;
};
type Totals = {
  count: number; surplus: number; shortage: number; net: number;
  base_revenue: number; surplus_pct: number | null; shortage_pct: number | null;
};

function fmt(n: number) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.round(n));
}
function pct(v: number | null) {
  return v == null ? '—' : `${v.toFixed(2)}%`;
}
function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

const th: React.CSSProperties = { padding: '10px 12px', background: 'var(--surface-muted)', fontSize: 11, fontWeight: 700, textAlign: 'right', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' };
const thLeft: React.CSSProperties = { ...th, textAlign: 'left' };
const td: React.CSSProperties = { padding: '8px 12px', fontSize: 13, textAlign: 'right', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' };
const tdLeft: React.CSSProperties = { ...td, textAlign: 'left' };

/** Больше этой доли выручки — повод разбираться, а не списывать на пересортицу. */
const ALERT_PCT = 5;

/**
 * Расхождения по инвентаризациям. Только для админа: цифры недостач по складам
 * — не то, что стоит видеть кухне и бару, которые сами эти пересчёты и делают.
 */
export function DiscrepanciesReport() {
  const [items, setItems] = useState<Item[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/iiko/reports/inventories');
        const j = await res.json();
        if (!res.ok || !j.success) throw new Error(j.error || 'Ошибка загрузки');
        setItems(j.items || []);
        setTotals(j.totals || null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Ошибка загрузки');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="card"><div className="empty-state">Загрузка…</div></div>;
  if (error) return <div className="banner banner--error">{error}</div>;
  if (items.length === 0) return <div className="card"><div className="empty-state">Инвентаризаций за период нет</div></div>;

  return (
    <div className="grid">
      {totals && (
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-card__label">📦 Пересчётов</div>
            <div className="stat-card__value">{totals.count}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__label">🟢 Излишки</div>
            <div className="stat-card__value" style={{ color: 'var(--success)' }}>{fmt(totals.surplus)}</div>
            <div className="stat-card__label">{pct(totals.surplus_pct)} от выручки</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__label">🔴 Недостача</div>
            <div className="stat-card__value" style={{ color: 'var(--danger)' }}>{fmt(totals.shortage)}</div>
            <div className="stat-card__label">{pct(totals.shortage_pct)} от выручки</div>
          </div>
        </div>
      )}

      <section className="card" style={{ padding: 0 }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
            <thead>
              <tr>
                <th style={thLeft}>Дата</th>
                <th style={thLeft}>Склад</th>
                <th style={th}>Излишек</th>
                <th style={th}>%</th>
                <th style={th}>Недостача</th>
                <th style={th}>%</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => {
                const alert = (it.shortage_pct ?? 0) > ALERT_PCT;
                return (
                  <tr key={i} title={`База процента: ${it.base_scope} · ${fmt(it.base_revenue)}`}>
                    <td style={tdLeft}>{fmtDate(it.date)}</td>
                    <td style={tdLeft}>{it.store}</td>
                    <td style={{ ...td, color: it.surplus ? 'var(--success)' : undefined }}>{it.surplus ? fmt(it.surplus) : ''}</td>
                    <td style={{ ...td, color: 'var(--text-muted)', fontSize: 12 }}>{it.surplus ? pct(it.surplus_pct) : ''}</td>
                    <td style={{ ...td, color: it.shortage ? 'var(--danger)' : undefined, fontWeight: alert ? 700 : undefined }}>{it.shortage ? fmt(it.shortage) : ''}</td>
                    <td style={{ ...td, fontSize: 12, color: alert ? 'var(--danger)' : 'var(--text-muted)', fontWeight: alert ? 700 : undefined }}>
                      {it.shortage ? pct(it.shortage_pct) : ''}{alert ? ' ⚠️' : ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {totals && (
              <tfoot>
                <tr style={{ background: 'var(--surface-muted)' }}>
                  <td style={{ ...tdLeft, fontWeight: 800 }} colSpan={2}>ИТОГО</td>
                  <td style={{ ...td, fontWeight: 800, color: 'var(--success)' }}>{fmt(totals.surplus)}</td>
                  <td style={{ ...td, fontWeight: 800, fontSize: 12 }}>{pct(totals.surplus_pct)}</td>
                  <td style={{ ...td, fontWeight: 800, color: 'var(--danger)' }}>{fmt(totals.shortage)}</td>
                  <td style={{ ...td, fontWeight: 800, fontSize: 12 }}>{pct(totals.shortage_pct)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
        Проводки инвентаризации идут двойной записью, поэтому документ целиком суммируется в ноль — цифры берутся со счетов
        «Излишки инвентаризации» и «Недостача инвентаризации». Процент считается от выручки того направления, которое кормит склад
        (наведи на строку — видно базу), а общий процент — от суммы этих баз: склады пересчитывают в разные месяцы и разного объёма.
        Строки выше {ALERT_PCT}% помечены.
      </p>
    </div>
  );
}
