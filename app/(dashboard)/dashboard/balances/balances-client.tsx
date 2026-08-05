'use client';

import { useEffect, useMemo, useState } from 'react';
import { Pagination } from '@/components/pagination';

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

  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'name', dir: 1 });
  const [page, setPage] = useState(1);

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

  const sorted = useMemo(() => {
    const val = (it: typeof filtered[number]) => {
      switch (sort.key) {
        case 'num': return it.product?.num || '';
        case 'amount': return it.amount || 0;
        case 'sum': return it.sum || 0;
        default: return it.product?.name || '';
      }
    };
    return [...filtered].sort((a, b) => {
      const x = val(a), y = val(b);
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * sort.dir;
      return String(x).localeCompare(String(y), 'ru') * sort.dir;
    });
  }, [filtered, sort]);

  const pageItems = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Смена склада, поиска или сортировки сбрасывает страницу: иначе после
  // фильтра остаёшься на 12-й странице, которой уже нет.
  useEffect(() => { setPage(1); }, [selectedId, query, sort]);

  function applySort(col: SortKey) {
    setSort((cur) => cur.key === col ? { key: col, dir: cur.dir === 1 ? -1 : 1 } : { key: col, dir: 1 });
  }

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
                  <SortTh label="Артикул" col="num" sort={sort} onSort={applySort} />
                  <SortTh label="Товар" col="name" sort={sort} onSort={applySort} />
                  <SortTh label="Кол-во" col="amount" sort={sort} onSort={applySort} align="right" />
                  <SortTh label="Сумма" col="sum" sort={sort} onSort={applySort} align="right" />
                </tr>
              </thead>
              <tbody>
                {pageItems.map((it, i) => (
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
        <Pagination page={page} total={sorted.length} pageSize={PAGE_SIZE} onPage={(p) => {
          setPage(p);
          // Листаем — возвращаем к началу таблицы, иначе новая страница
          // открывается «где-то посередине».
          if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
        }} />
      </section>
    </div>
  );
}

const PAGE_SIZE = 50;

type SortKey = 'num' | 'name' | 'amount' | 'sum';

function SortTh({ label, col, sort, onSort, align = 'left' }: {
  label: string; col: SortKey; sort: { key: SortKey; dir: 1 | -1 }; onSort: (c: SortKey) => void; align?: 'left' | 'right';
}) {
  const active = sort.key === col;
  return (
    <th
      onClick={() => onSort(col)}
      style={{ padding: '10px 8px', textAlign: align, borderBottom: '1px solid var(--border)', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
      title="Сортировать"
    >
      {label}{active ? (sort.dir === 1 ? ' ↑' : ' ↓') : ' ↕'}
    </th>
  );
}
