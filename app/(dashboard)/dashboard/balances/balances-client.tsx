'use client';

import { useEffect, useMemo, useState } from 'react';

type BalanceItem = {
  product?: { id?: string; name?: string; num?: string };
  amount?: number;
  sum?: number;
  unitName?: string;
};

type StoreBlock = {
  storage?: { id?: string; name?: string };
  balanceItems?: BalanceItem[];
};

type ApiResp = { data?: StoreBlock[]; balances?: StoreBlock[]; error?: string };

function fmt(n: number) {
  return n.toLocaleString('ru-RU');
}

export function BalancesClient() {
  const [data, setData] = useState<StoreBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>('');
  const [query, setQuery] = useState('');

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/iiko/balances');
      const json: ApiResp = await res.json();
      const arr = json.data || json.balances || [];
      setData(arr);
      if (!selectedId && arr.length > 0) {
        const first = arr.find((b) => (b.balanceItems?.length || 0) > 0) || arr[0];
        setSelectedId(first.storage?.id || '');
      }
      if (json.error) setError(json.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'fetch failed');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, []);

  const stores = useMemo(() => data.map((b) => b.storage).filter((s): s is { id: string; name: string } => !!s?.id), [data]);
  const selected = data.find((b) => b.storage?.id === selectedId);
  const rawItems = selected?.balanceItems || [];
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return rawItems
      .filter((it) => (it.amount || 0) !== 0)
      .filter((it) => {
        if (!q) return true;
        const name = (it.product?.name || '').toLowerCase();
        const num = (it.product?.num || '').toLowerCase();
        return name.includes(q) || num.includes(q);
      });
  }, [rawItems, query]);

  const totalSum = filtered.reduce((s, it) => s + (it.sum || 0), 0);

  return (
    <div className="grid">
      <div className="card">
        <div className="card__title">
          <span className="card__title-text">📦 Фильтр</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              className="btn btn--sm"
              disabled={filtered.length === 0}
              onClick={() => {
                const lines = ['Артикул;Товар;Количество;Ед;Сумма'];
                for (const it of filtered) {
                  const cell = (v: unknown) => { const s = v == null ? '' : String(v); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
                  lines.push([it.product?.num || '', it.product?.name || '', it.amount || 0, it.unitName || '', Math.round(it.sum || 0)].map(cell).join(';'));
                }
                const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `balances_${selectedId.slice(0,8)}_${new Date().toISOString().slice(0,10)}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              ⬇ CSV
            </button>
            <button type="button" className="btn btn--sm" onClick={() => load(true)} disabled={refreshing || loading}>
              {refreshing ? '…' : '↻ Обновить'}
            </button>
          </div>
        </div>
        <div className="grid grid--2">
          <div className="field">
            <label className="field__label">Склад</label>
            <select className="select" value={selectedId} onChange={(e) => setSelectedId(e.target.value)} disabled={stores.length === 0}>
              {stores.length === 0 && <option value="">Нет данных</option>}
              {stores.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field__label">Поиск</label>
            <input className="input" placeholder="название или артикул" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>
      </div>

      {error && (
        <div className="banner banner--warn">⚠️ iiko: {error}. Проверь iiko-учётки в настройках филиала.</div>
      )}

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card__label">Позиций</div>
          <div className="stat-card__value">{filtered.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">Сумма остатков</div>
          <div className="stat-card__value">{fmt(Math.round(totalSum))}</div>
        </div>
      </div>

      <section className="card">
        {loading ? (
          <div className="empty-state">Загрузка…</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">{query ? 'Ничего не найдено' : 'Остатков нет'}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase' }}>
                  <th style={{ padding: '10px 8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Артикул</th>
                  <th style={{ padding: '10px 8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Товар</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Кол-во</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Сумма</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((it, i) => (
                  <tr key={(it.product?.id || '') + i}>
                    <td style={{ padding: '8px', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 12 }}>{it.product?.num || '—'}</td>
                    <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>{it.product?.name || '—'}</td>
                    <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid var(--border)', fontVariantNumeric: 'tabular-nums' }}>{fmt(it.amount || 0)} {it.unitName || ''}</td>
                    <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid var(--border)', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{fmt(Math.round(it.sum || 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
