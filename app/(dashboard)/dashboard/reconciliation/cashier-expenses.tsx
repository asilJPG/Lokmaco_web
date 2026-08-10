'use client';

import { Fragment, useEffect, useState } from 'react';
import { StackTable } from '@/components/stack-table';

type Entry = { date: string; amount: number; cashier: string | null };
type Item = { name: string; byMonth: Record<string, number>; total: number; entries: Entry[] };
type Data = {
  months: string[];
  items: Item[];
  month_totals: Record<string, number>;
  grand_total: number;
  entries_count: number;
  distinct_names: number;
};

const MONTH_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

function monthLabel(m: string) {
  const [y, mo] = m.split('-');
  return `${MONTH_SHORT[Number(mo) - 1]} ${y.slice(2)}`;
}
function fmt(n: number) {
  return n ? new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n) : '';
}
function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

const th: React.CSSProperties = { padding: '10px 12px', background: 'var(--surface-muted)', fontSize: 11, fontWeight: 700, textAlign: 'right', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' };
const thLeft: React.CSSProperties = { ...th, textAlign: 'left' };
const td: React.CSSProperties = { padding: '8px 12px', fontSize: 13, textAlign: 'right', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' };
const tdLeft: React.CSSProperties = { ...td, textAlign: 'left', whiteSpace: 'normal' };

/**
 * Расходы кассира сводкой: строки — назначение, колонки — месяцы.
 * По одной смене это видно и в истории; ценность отчёта в том, что видно,
 * сколько «Базар» стоит из месяца в месяц.
 */
export function CashierExpensesReport() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/iiko/reports/cashier-expenses');
        const j = await res.json();
        if (!res.ok || !j.success) throw new Error(j.error || 'Ошибка загрузки');
        setData(j);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Ошибка загрузки');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="card"><div className="empty-state">Загрузка…</div></div>;
  if (error) return <div className="banner banner--error">{error}</div>;
  if (!data || data.items.length === 0) return <div className="card"><div className="empty-state">Расходов нет</div></div>;

  function exportCsv() {
    if (!data) return;
    const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [['Назначение', ...data.months.map(monthLabel), 'Итого'].map(cell).join(';')];
    for (const it of data.items) {
      lines.push([it.name, ...data.months.map((m) => it.byMonth[m] || 0), it.total].map(cell).join(';'));
    }
    lines.push(['ИТОГО', ...data.months.map((m) => data.month_totals[m] || 0), data.grand_total].map(cell).join(';'));
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cashier_expenses_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="grid">
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card__label">💸 Всего расходов</div>
          <div className="stat-card__value">{fmt(data.grand_total)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">📝 Операций</div>
          <div className="stat-card__value">{data.entries_count}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">🏷 Статей</div>
          <div className="stat-card__value">{data.distinct_names}</div>
        </div>
      </div>

      <section className="card" style={{ padding: 0 }}>
        <div className="card__title" style={{ padding: '14px 16px', margin: 0 }}>
          <span className="card__title-text">💸 Расходы кассира по месяцам</span>
          <button type="button" className="btn btn--sm" onClick={exportCsv}>⬇ CSV</button>
        </div>
        <StackTable>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
            <thead>
              <tr>
                <th style={thLeft}>Назначение</th>
                {data.months.map((m) => <th key={m} style={th}>{monthLabel(m)}</th>)}
                <th style={{ ...th, borderLeft: '2px solid var(--border)' }}>Итого</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((it) => {
                const isOpen = open === it.name;
                return (
                  <Fragment key={it.name}>
                      <tr
                        onClick={() => setOpen(isOpen ? null : it.name)}
                        style={{ cursor: 'pointer', background: isOpen ? 'var(--surface-muted)' : undefined }}
                      >
                        <td style={tdLeft}>{isOpen ? '▾' : '▸'} {it.name}</td>
                        {data.months.map((m) => <td key={m} style={td}>{fmt(it.byMonth[m] || 0)}</td>)}
                        <td style={{ ...td, borderLeft: '2px solid var(--border)', fontWeight: 700 }}>{fmt(it.total)}</td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td colSpan={data.months.length + 2} style={{ padding: 0, background: 'var(--surface-muted)' }}>
                            <div style={{ padding: '10px 16px' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                <tbody>
                                  {it.entries.map((e, i) => (
                                    <tr key={i} style={{ borderTop: i ? '1px solid var(--border)' : 'none' }}>
                                      <td style={{ padding: '6px 0' }}>{fmtDate(e.date)}</td>
                                      <td style={{ padding: '6px 0', color: 'var(--text-muted)' }}>{e.cashier || '—'}</td>
                                      <td style={{ padding: '6px 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(e.amount)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                  </Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--surface-muted)' }}>
                <td style={{ ...tdLeft, fontWeight: 800 }}>ИТОГО</td>
                {data.months.map((m) => <td key={m} style={{ ...td, fontWeight: 800 }}>{fmt(data.month_totals[m] || 0)}</td>)}
                <td style={{ ...td, borderLeft: '2px solid var(--border)', fontWeight: 800 }}>{fmt(data.grand_total)}</td>
              </tr>
            </tfoot>
          </table>
        </StackTable>
      </section>

      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
        Названия кассир вписывает руками, поэтому «Базар» и «БАЗАР» считаются одной строкой (регистр и лишние пробелы игнорируются).
        Разное написание одного и того же — например «Бозор» и «Базар» — остаётся разными строками. Клик по строке раскрывает операции.
      </p>
    </div>
  );
}
