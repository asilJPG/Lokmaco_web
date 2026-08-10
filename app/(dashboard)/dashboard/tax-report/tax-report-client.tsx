'use client';

import { useEffect, useMemo, useState } from 'react';
import type { TaxReport } from '@/lib/tax-report';
import { StackTable } from '@/components/stack-table';

type SubTab = 'sales' | 'ingredients' | 'writeoffs';

const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: 'sales', label: '🍔 Реализация' },
  { id: 'ingredients', label: '🌾 Расход сырья' },
  { id: 'writeoffs', label: '🗑️ Списания' },
];

const num = (n: number, digits = 0) => n.toLocaleString('ru-RU', { minimumFractionDigits: digits, maximumFractionDigits: digits });

const th: React.CSSProperties = { padding: '10px 8px', textAlign: 'left', borderBottom: '1px solid var(--border)', fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)', whiteSpace: 'nowrap' };
const thR: React.CSSProperties = { ...th, textAlign: 'right' };
const td: React.CSSProperties = { padding: '8px', borderBottom: '1px solid var(--border)', fontSize: 13 };
const tdR: React.CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };

export function TaxReportClient({ from, to }: { from: string; to: string }) {
  const [data, setData] = useState<TaxReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<SubTab>('sales');
  const [q, setQ] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/iiko/analytics/tax-report?from=${from}&to=${to}`);
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

  const filtered = useMemo(() => {
    if (!data) return { sales: [], ingredients: [], writeoffs: [] } as TaxReport;
    const needle = q.trim().toLowerCase();
    if (!needle) return data;
    return {
      sales: data.sales.filter((r) => r.name.toLowerCase().includes(needle) || r.code.toLowerCase().includes(needle)),
      ingredients: data.ingredients.filter((r) => r.name.toLowerCase().includes(needle) || r.code.toLowerCase().includes(needle)),
      writeoffs: data.writeoffs.filter((r) => r.productName.toLowerCase().includes(needle) || r.number.toLowerCase().includes(needle)),
    };
  }, [data, q]);

  function exportCsv() {
    let csv = '﻿';
    if (tab === 'sales') {
      csv += 'Артикул;Название блюда;Количество (шт)\n';
      for (const r of filtered.sales) csv += `"${r.code}";"${r.name}";${r.quantity}\n`;
    } else if (tab === 'ingredients') {
      csv += 'Артикул;Название ингредиента;Расход;Ед. изм.;Цена;Сумма (UZS)\n';
      for (const r of filtered.ingredients) {
        csv += `"${r.code}";"${r.name}";${String(r.quantity).replace('.', ',')};"${r.unit}";${String(Math.round(r.price)).replace('.', ',')};${Math.round(r.cost)}\n`;
      }
    } else {
      csv += 'Дата;Номер;Склад;Счет затрат;Артикул;Товар;Количество;Сумма (UZS)\n';
      for (const r of filtered.writeoffs) {
        csv += `"${r.date}";"${r.number}";"${r.storeName}";"${r.accountName}";"${r.code}";"${r.productName}";${String(r.quantity).replace('.', ',')};${Math.round(r.cost)}\n`;
      }
    }
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `tax_report_${tab}_${from}_to_${to}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const ingredientsCost = data?.ingredients.reduce((s, r) => s + r.cost, 0) || 0;
  const writeoffsCost = data?.writeoffs.reduce((s, r) => s + r.cost, 0) || 0;

  return (
    <div className="grid">
      {error && <div className="banner banner--warn">iiko: {error}</div>}

      {loading ? (
        <div className="card"><div className="empty-state" style={{ padding: 60 }}>Считаем расход сырья по техкартам…</div></div>
      ) : !data ? (
        <div className="card"><div className="empty-state">Данных нет</div></div>
      ) : (
        <>
          <div className="stat-grid">
            <div className="stat-card"><div className="stat-card__label">🍔 Позиций продано</div><div className="stat-card__value">{num(data.sales.length)}</div></div>
            <div className="stat-card"><div className="stat-card__label">🌾 Ингредиентов</div><div className="stat-card__value">{num(data.ingredients.length)}</div></div>
            <div className="stat-card"><div className="stat-card__label">💰 Сырьё на сумму</div><div className="stat-card__value">{num(Math.round(ingredientsCost))}</div></div>
            <div className="stat-card"><div className="stat-card__label">🗑️ Списано на сумму</div><div className="stat-card__value">{num(Math.round(writeoffsCost))}</div></div>
          </div>

          <div className="action-bar" style={{ justifyContent: 'space-between' }}>
            <div className="segmented" role="tablist">
              {SUB_TABS.map((t) => (
                <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className="segmented__item" onClick={() => setTab(t.id)}>
                  {t.label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input input--inline" placeholder="Поиск…" value={q} onChange={(e) => setQ(e.target.value)} />
              <button type="button" className="btn btn--sm" onClick={exportCsv}>📥 Экспорт CSV</button>
            </div>
          </div>

          <section className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <StackTable>
              {tab === 'sales' && (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><th style={th}>Артикул</th><th style={th}>Блюдо</th><th style={thR}>Продано</th></tr></thead>
                  <tbody>
                    {filtered.sales.map((r) => (
                      <tr key={r.id}><td style={{ ...td, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{r.code || '—'}</td><td style={td}>{r.name}</td><td style={tdR}>{num(r.quantity, 2)}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
              {tab === 'ingredients' && (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><th style={th}>Артикул</th><th style={th}>Ингредиент</th><th style={thR}>Расход</th><th style={th}>Ед.</th><th style={thR}>Цена</th><th style={thR}>Сумма</th></tr></thead>
                  <tbody>
                    {filtered.ingredients.map((r) => (
                      <tr key={r.id}>
                        <td style={{ ...td, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{r.code || '—'}</td>
                        <td style={td}>{r.name}</td>
                        <td style={tdR}>{num(r.quantity, 3)}</td>
                        <td style={td}>{r.unit}</td>
                        <td style={tdR}>{num(Math.round(r.price))}</td>
                        <td style={{ ...tdR, fontWeight: 600 }}>{num(Math.round(r.cost))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {tab === 'writeoffs' && (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><th style={th}>Дата</th><th style={th}>Номер</th><th style={th}>Склад</th><th style={th}>Счёт затрат</th><th style={th}>Товар</th><th style={thR}>Кол-во</th><th style={thR}>Сумма</th></tr></thead>
                  <tbody>
                    {filtered.writeoffs.map((r, i) => (
                      <tr key={`${r.number}-${i}`}>
                        <td style={td}>{r.date}</td>
                        <td style={{ ...td, fontFamily: 'monospace' }}>{r.number}</td>
                        <td style={td}>{r.storeName}</td>
                        <td style={td}>{r.accountName}</td>
                        <td style={td}>{r.productName}</td>
                        <td style={tdR}>{num(r.quantity, 3)}</td>
                        <td style={{ ...tdR, fontWeight: 600 }}>{num(Math.round(r.cost))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </StackTable>
          </section>

          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
            Расход сырья считается разворачиванием проданных блюд по действующим техкартам до закупаемых ингредиентов.
            Цена ингредиента — средневзвешенная по остаткам на {to}.
          </p>
        </>
      )}
    </div>
  );
}
