'use client';

import { useEffect, useMemo, useState } from 'react';
import { PricesTab } from './prices-tab';

type AbcClass = 'A' | 'B' | 'C';

type Dish = {
  category: string;
  name: string;
  amount: number;
  revenue: number;
  cost: number;
  costPerItem: number;
  fcPercent: number;
  profit: number;
  markupPercent: number;
  revenueShare: number;
  abc: AbcClass;
};

type Totals = { revenue: number; cost: number; profit: number; fcPercent: number; dishCount: number };
type Data = { dishes: Dish[]; totals: Totals };

type SortKey = 'revenue' | 'fcPercent' | 'costPerItem' | 'amount' | 'profit';

function fmt(n: number) {
  return Math.round(n).toLocaleString('ru-RU');
}

function pct(n: number) {
  return `${n.toFixed(1)}%`;
}

// Industry rule of thumb for food service: under 25% is healthy, 25–35% needs
// watching, above 35% eats the margin.
function fcColor(fc: number): string {
  if (fc >= 35) return 'var(--danger)';
  if (fc >= 25) return 'var(--warning)';
  return 'var(--success)';
}

const ABC_COLOR: Record<AbcClass, string> = {
  A: 'var(--success)',
  B: 'var(--warning)',
  C: 'var(--text-faint)',
};

const ABC_HINT: Record<AbcClass, string> = {
  A: 'Топ-позиции: дают 80% выручки',
  B: 'Средние: следующие 15% выручки',
  C: 'Хвост: последние 5% выручки',
};

export function MenuAnalyticsClient({ from, to }: { from: string; to: string }) {
  const [tab, setTab] = useState<'dishes' | 'prices'>('dishes');
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('revenue');
  const [abcFilter, setAbcFilter] = useState<AbcClass | 'all'>('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/iiko/analytics/menu?from=${from}&to=${to}`);
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
  }, [from, to]);

  const visible = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    const rows = data.dishes.filter(
      (d) => (abcFilter === 'all' || d.abc === abcFilter) && (!q || d.name.toLowerCase().includes(q) || d.category.toLowerCase().includes(q))
    );
    return [...rows].sort((a, b) => b[sort] - a[sort]);
  }, [data, sort, abcFilter, query]);

  const tabs = (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      <button type="button" className={`btn btn--sm ${tab === 'dishes' ? 'btn--primary' : ''}`} onClick={() => setTab('dishes')}>🍽 Блюда и food cost</button>
      <button type="button" className={`btn btn--sm ${tab === 'prices' ? 'btn--primary' : ''}`} onClick={() => setTab('prices')}>🔔 Цены и алерты</button>
    </div>
  );

  if (tab === 'prices') {
    return <div className="grid">{tabs}<PricesTab from={from} to={to} /></div>;
  }

  if (loading) return <div className="grid">{tabs}<div className="card"><div className="empty-state">Загрузка из iiko…</div></div></div>;
  if (!data) return <div className="grid">{tabs}<div className="banner banner--error">{error || 'Нет данных'}</div></div>;

  const t = data.totals;
  const problem = data.dishes.filter((d) => d.fcPercent >= 35).length;

  return (
    <div className="grid">
      {tabs}
      {error && <div className="banner banner--warn">{error}</div>}

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card__label">💰 Выручка</div>
          <div className="stat-card__value" style={{ color: 'var(--success)' }}>{fmt(t.revenue)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">🧾 Себестоимость</div>
          <div className="stat-card__value">{fmt(t.cost)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">📈 Валовая прибыль</div>
          <div className="stat-card__value">{fmt(t.profit)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">🍳 Food cost</div>
          <div className="stat-card__value" style={{ color: fcColor(t.fcPercent) }}>{pct(t.fcPercent)}</div>
        </div>
      </div>

      {problem > 0 && (
        <div className="banner banner--warn">
          ⚠️ {problem} {problem === 1 ? 'блюдо' : 'блюд'} с food cost выше 35% — съедают маржу. Отсортируй по «Food cost», чтобы увидеть их сверху.
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
          <input
            className="input input--inline"
            placeholder="Поиск блюда…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ minWidth: 180 }}
          />
          <div style={{ display: 'flex', gap: 4 }}>
            {(['all', 'A', 'B', 'C'] as const).map((c) => (
              <button
                key={c}
                type="button"
                className={`btn btn--sm ${abcFilter === c ? 'btn--primary' : ''}`}
                onClick={() => setAbcFilter(c)}
                title={c === 'all' ? 'Все блюда' : ABC_HINT[c]}
              >
                {c === 'all' ? 'Все' : c}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4, marginLeft: 'auto', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center' }}>Сортировка:</span>
            {([
              ['revenue', 'Выручка'],
              ['fcPercent', 'Food cost'],
              ['costPerItem', 'Себест. порции'],
              ['profit', 'Прибыль'],
              ['amount', 'Кол-во'],
            ] as [SortKey, string][]).map(([k, label]) => (
              <button key={k} type="button" className={`btn btn--sm ${sort === k ? 'btn--primary' : ''}`} onClick={() => setSort(k)}>
                {label}
              </button>
            ))}
            <a className="btn btn--sm" href={`/api/iiko/analytics/menu/export?from=${from}&to=${to}`}>⬇️ Excel</a>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase' }}>
                <th style={{ padding: '10px 8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Блюдо</th>
                <th style={{ padding: '10px 8px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>ABC</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Кол-во</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Выручка</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Себест. порции</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Food cost</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Наценка</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Прибыль</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((d, i) => (
                <tr key={`${d.category}/${d.name}/${i}`}>
                  <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 600 }}>{d.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{d.category} · {d.revenueShare.toFixed(1)}% выручки</div>
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                    <span title={ABC_HINT[d.abc]} style={{ fontWeight: 700, color: ABC_COLOR[d.abc] }}>{d.abc}</span>
                  </td>
                  <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid var(--border)', fontVariantNumeric: 'tabular-nums' }}>{fmt(d.amount)}</td>
                  <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid var(--border)', fontVariantNumeric: 'tabular-nums' }}>{fmt(d.revenue)}</td>
                  <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid var(--border)', fontVariantNumeric: 'tabular-nums' }}>{fmt(d.costPerItem)}</td>
                  <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid var(--border)', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: fcColor(d.fcPercent) }}>{pct(d.fcPercent)}</td>
                  <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid var(--border)', fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)' }}>{pct(d.markupPercent)}</td>
                  <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid var(--border)', fontVariantNumeric: 'tabular-nums' }}>{fmt(d.profit)}</td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr><td colSpan={8}><div className="empty-state">Ничего не найдено</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
