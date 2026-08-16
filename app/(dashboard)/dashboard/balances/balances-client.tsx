'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Pagination } from '@/components/pagination';
import { StackTable } from '@/components/stack-table';
import { SortTh } from '@/components/sortable';
import { useStores } from '@/lib/stores-client';

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
  /**
   * Пользователь уже выбрал склад руками — автовыбор больше не вмешивается.
   *
   * ⚠️ Именно ref, а не состояние: `load()` вызывается один раз при монтировании
   * и навсегда запоминает значение из своего замыкания. С обычным `useState`
   * выбранный вручную склад всё равно перебивался, когда приходили остатки, —
   * поймано на проверке.
   */
  const touchedRef = useRef(false);
  const [query, setQuery] = useState('');

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/iiko/balances');
      const json: ApiResp = await res.json();
      const arr = json.data || json.balances || [];
      setData(arr);
      // Пришли остатки — показываем склад, где что-то есть. Проверяем именно
      // «не трогал руками», а не «selectedId пустой»: до ответа там уже стоит
      // первый склад из справочника, и прежнее условие никогда бы не сработало.
      if (!touchedRef.current && arr.length > 0) {
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

  /**
   * Список складов — из общего справочника, а не из ответа с остатками.
   *
   * ⚠️ Раньше он собирался из `/api/iiko/balances`, а это тяжёлый запрос: пока
   * он шёл, выпадающий список стоял пустым и задизейбленным, хотя справочник
   * уже лежал в кэше вкладки (`lib/stores-client.ts`, один запрос на все
   * разделы). Склады из ответа с остатками добавляем следом — на случай, если
   * там окажется склад, которого нет в справочнике.
   */
  const { stores: known } = useStores();
  const stores = useMemo(() => {
    const out: { id: string; name: string }[] = [];
    const seen = new Set<string>();
    for (const s of known) { if (!seen.has(s.id)) { seen.add(s.id); out.push(s); } }
    for (const b of data) {
      const s = b.storage;
      if (s?.id && !seen.has(s.id)) { seen.add(s.id); out.push({ id: s.id, name: s.name || s.id }); }
    }
    return out;
  }, [known, data]);

  // Справочник приходит раньше остатков — сразу показываем первый склад,
  // чтобы поле не стояло пустым несколько секунд.
  useEffect(() => {
    if (!selectedId && known.length > 0) setSelectedId(known[0].id);
  }, [known, selectedId]);
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
            <select className="select" value={selectedId} onChange={(e) => { touchedRef.current = true; setSelectedId(e.target.value); }} disabled={stores.length === 0}>
              {stores.length === 0 && <option value="">{loading ? 'Загрузка…' : 'Нет данных'}</option>}
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
          <StackTable>
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
          </StackTable>
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

