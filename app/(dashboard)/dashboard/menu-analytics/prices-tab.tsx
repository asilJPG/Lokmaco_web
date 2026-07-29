'use client';

import { useEffect, useState } from 'react';

type PricePoint = { date: string; price: number; amount: number; documentNumber: string };

type Ingredient = {
  productId: string;
  name: string;
  unit: string;
  points: PricePoint[];
  firstPrice: number;
  lastPrice: number;
  minPrice: number;
  maxPrice: number;
  changePercent: number;
  totalSpend: number;
  purchases: number;
};

type Alert = {
  productId: string;
  name: string;
  unit: string;
  baselinePrice: number;
  latestPrice: number;
  changePercent: number;
  date: string;
  documentNumber: string;
  impact: number;
};

type Supplier = { supplierId: string; name: string; total: number; share: number; invoices: number; avgInvoice: number };
type Saving = { productId: string; name: string; unit: string; bestPrice: number; avgPrice: number; amount: number; saving: number };
type Summary = { total: number; invoices: number; suppliers: number; avgInvoice: number };

type Data = {
  summary: Summary;
  supplierSpend: Supplier[];
  savings: Saving[];
  totalSaving: number;
  ingredients: Ingredient[];
  alerts: Alert[];
  suspicious: Alert[];
  topSpend: Ingredient[];
};

function fmt(n: number) {
  return Math.round(n).toLocaleString('ru-RU');
}

function Sparkline({ points }: { points: PricePoint[] }) {
  if (points.length < 2) return <span style={{ color: 'var(--text-faint)', fontSize: 11 }}>одна закупка</span>;
  const prices = points.map((p) => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || 1;
  const w = 120;
  const h = 28;
  const d = prices
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${(i / (prices.length - 1)) * w} ${h - ((p - min) / span) * h}`)
    .join(' ');
  const rising = prices[prices.length - 1] >= prices[0];
  return (
    <svg width={w} height={h} style={{ display: 'block' }} aria-hidden="true">
      <path d={d} fill="none" stroke={rising ? 'var(--danger)' : 'var(--success)'} strokeWidth="1.5" />
    </svg>
  );
}

function AlertRow({ a }: { a: Alert }) {
  const up = a.changePercent > 0;
  return (
    <tr>
      <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontWeight: 600 }}>{a.name}</div>
        <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{a.date} · накл. {a.documentNumber}</div>
      </td>
      <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid var(--border)', fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)' }}>
        {fmt(a.baselinePrice)}
      </td>
      <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid var(--border)', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
        {fmt(a.latestPrice)} <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>/{a.unit}</span>
      </td>
      <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid var(--border)', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: up ? 'var(--danger)' : 'var(--success)' }}>
        {up ? '+' : ''}{a.changePercent.toFixed(0)}%
      </td>
      <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid var(--border)', fontVariantNumeric: 'tabular-nums', color: up ? 'var(--danger)' : 'var(--success)' }}>
        {up ? '+' : ''}{fmt(a.impact)}
      </td>
    </tr>
  );
}

export function PricesTab({ from, to }: { from: string; to: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(10);
  const [showSuspicious, setShowSuspicious] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/iiko/analytics/prices?from=${from}&to=${to}&threshold=${threshold}`);
        const json = await res.json();
        if (cancelled) return;
        setData(json.data || null);
        if (json.error) setError(json.error);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'fetch failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [from, to, threshold]);

  if (loading) return <div className="card"><div className="empty-state">Загрузка накладных из iiko…</div></div>;
  if (!data) return <div className="banner banner--error">{error || 'Нет данных'}</div>;

  return (
    <div className="grid">
      {error && <div className="banner banner--warn">{error}</div>}

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card__label">🧾 Сумма закупок</div>
          <div className="stat-card__value">{fmt(data.summary.total)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">📄 Накладных</div>
          <div className="stat-card__value">{data.summary.invoices}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">🏭 Поставщиков</div>
          <div className="stat-card__value">{data.summary.suppliers}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">📊 Средняя накладная</div>
          <div className="stat-card__value">{fmt(data.summary.avgInvoice)}</div>
        </div>
      </div>

      {data.totalSaving > 0 && (
        <section className="card" style={{ borderLeft: '3px solid var(--success)' }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ flex: '1 1 280px' }}>
              <b style={{ fontSize: 14 }}>💡 Потенциальный эффект: закупать по лучшей своей цене</b>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                По {data.savings.length} товарам цена за период гуляла. Если бы весь объём брали по самой низкой из уже полученных вами цен —
                переговоры, другой поставщик, объём — вот верхняя оценка экономии.
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                {data.savings.slice(0, 5).map((s) => (
                  <span key={s.productId} style={{ fontSize: 12, padding: '4px 8px', background: 'var(--surface-muted)', borderRadius: 6 }}>
                    {s.name} <b style={{ color: 'var(--success)' }}>−{fmt(s.saving)}</b>
                  </span>
                ))}
              </div>
            </div>
            <div style={{ textAlign: 'right', minWidth: 140 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--success)', fontVariantNumeric: 'tabular-nums' }}>−{fmt(data.totalSaving)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>за период</div>
            </div>
          </div>
        </section>
      )}

      {data.supplierSpend.length > 0 && (
        <section className="card" style={{ padding: 0 }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <b style={{ fontSize: 14 }}>🏭 Структура по поставщикам</b>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase' }}>
                  <th style={{ padding: '10px 8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Поставщик</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Сумма</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Доля</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Накладных</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Ср. накладная</th>
                </tr>
              </thead>
              <tbody>
                {data.supplierSpend.slice(0, 15).map((s) => (
                  <tr key={s.supplierId}>
                    <td style={{ padding: '8px', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>{s.name}</td>
                    <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid var(--border)', fontVariantNumeric: 'tabular-nums' }}>{fmt(s.total)}</td>
                    <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid var(--border)', fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)' }}>{s.share.toFixed(1)}%</td>
                    <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid var(--border)', fontVariantNumeric: 'tabular-nums' }}>{s.invoices}</td>
                    <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid var(--border)', fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)' }}>{fmt(s.avgInvoice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="card" style={{ padding: 0 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <b style={{ fontSize: 14 }}>🔔 Алерты по ценам</b>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>последняя закупка против обычной цены</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            {[10, 20, 30].map((t) => (
              <button key={t} type="button" className={`btn btn--sm ${threshold === t ? 'btn--primary' : ''}`} onClick={() => setThreshold(t)}>
                ≥ {t}%
              </button>
            ))}
          </div>
        </div>
        {data.alerts.length === 0 ? (
          <div className="empty-state">Нет изменений цен выше порога за период</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase' }}>
                  <th style={{ padding: '10px 8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Ингредиент</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Было</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Стало</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Изменение</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Влияние, сум</th>
                </tr>
              </thead>
              <tbody>
                {data.alerts.map((a) => <AlertRow key={a.productId} a={a} />)}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {data.suspicious.length > 0 && (
        <section className="card" style={{ padding: 0 }}>
          <button
            type="button"
            onClick={() => setShowSuspicious((v) => !v)}
            style={{ width: '100%', textAlign: 'left', padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', font: 'inherit' }}
          >
            <b style={{ fontSize: 14 }}>🧐 Похоже на ошибку ввода — {data.suspicious.length}</b>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Цена изменилась более чем втрое — обычно это количество, введённое в коробках вместо штук. Стоит проверить накладные в iiko. {showSuspicious ? '▲' : '▼'}
            </div>
          </button>
          {showSuspicious && (
            <div style={{ overflowX: 'auto', borderTop: '1px solid var(--border)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase' }}>
                    <th style={{ padding: '10px 8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Ингредиент</th>
                    <th style={{ padding: '10px 8px', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Было</th>
                    <th style={{ padding: '10px 8px', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Стало</th>
                    <th style={{ padding: '10px 8px', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Изменение</th>
                    <th style={{ padding: '10px 8px', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Влияние, сум</th>
                  </tr>
                </thead>
                <tbody>
                  {data.suspicious.map((a) => <AlertRow key={a.productId} a={a} />)}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <section className="card" style={{ padding: 0 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <b style={{ fontSize: 14 }}>📈 Динамика цен</b>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Топ-20 ингредиентов по затратам за период</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase' }}>
                <th style={{ padding: '10px 8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Ингредиент</th>
                <th style={{ padding: '10px 8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>График</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Мин</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Макс</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Сейчас</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Закупок</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Потрачено</th>
              </tr>
            </thead>
            <tbody>
              {data.ingredients.slice(0, 20).map((g) => (
                <tr key={g.productId}>
                  <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 600 }}>{g.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>за 1 {g.unit}</div>
                  </td>
                  <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}><Sparkline points={g.points} /></td>
                  <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid var(--border)', fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)' }}>{fmt(g.minPrice)}</td>
                  <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid var(--border)', fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)' }}>{fmt(g.maxPrice)}</td>
                  <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid var(--border)', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{fmt(g.lastPrice)}</td>
                  <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid var(--border)', fontVariantNumeric: 'tabular-nums' }}>{g.purchases}</td>
                  <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid var(--border)', fontVariantNumeric: 'tabular-nums' }}>{fmt(g.totalSpend)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
