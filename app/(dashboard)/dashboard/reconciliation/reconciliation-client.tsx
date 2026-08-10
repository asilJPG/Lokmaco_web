'use client';

import { useEffect, useState } from 'react';
import { CashierExpensesReport } from './cashier-expenses';
import type { MonthlyCashDay, MonthlyCashTotals } from '@/app/api/iiko/reports/monthly-cash/route';
import { StackTable } from '@/components/stack-table';

type Data = { month: string; days: MonthlyCashDay[]; totals: MonthlyCashTotals };

const MONTH_NAMES = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

/** Пустая ячейка вместо нуля — как в легаси: в таблице видно только то, что реально было. */
function fmt(n: number) {
  return n ? new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) : '';
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

const th: React.CSSProperties = { padding: '10px 12px', background: 'var(--surface-muted)', fontSize: 11, fontWeight: 700, textAlign: 'right', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' };
const thLeft: React.CSSProperties = { ...th, textAlign: 'left' };
const td: React.CSSProperties = { padding: '8px 12px', fontSize: 13, textAlign: 'right', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' };
const tdLeft: React.CSSProperties = { ...td, textAlign: 'left' };
const sep: React.CSSProperties = { borderLeft: '2px solid var(--border)' };

export function ReconciliationClient({ initialMonth }: { initialMonth: string }) {
  // Две вкладки, как в легаси: сверка по дням и расходы кассира сводкой.
  const [view, setView] = useState<'cash' | 'expenses'>('cash');
  const [month, setMonth] = useState(initialMonth);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/iiko/reports/monthly-cash?month=${month}`);
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
  }, [month]);

  function exportCsv() {
    if (!data) return;
    const head = ['№', 'Дата', 'День недели', 'Наличные -', 'Наличные фискал', 'ТЕРМИНАЛ HUMO', 'ТЕРМИНАЛ Uzcard', 'Рахмат (Rakhmat)', 'Uzum', 'Yandex Eats', 'Click / Payme', 'Общая Сумма', 'iiko сумма продаж', 'Разница'];
    const rows: (string | number)[][] = [head];
    data.days.forEach((r, i) => {
      rows.push([
        i + 1, fmtDate(r.date), r.weekday,
        r.hasCash ? r.cashGross : '', r.hasCash ? r.cashFiscal : '',
        r.hasCash ? r.humo : '', r.hasCash ? r.uzcard : '',
        r.hasCash ? r.rahmat : '', r.hasCash ? r.uzum : '',
        r.hasCash ? r.yandex : '', r.hasCash ? r.online : '',
        r.hasCash ? r.total : '', r.iikoRevenue || '', r.hasCash ? r.diff : '',
      ]);
    });
    const t = data.totals;
    rows.push(['', 'ИТОГО', '', t.cashGross, t.cashFiscal, t.humo, t.uzcard, t.rahmat, t.uzum, t.yandex, t.online, t.total, t.iikoRevenue, t.diff]);
    const esc = (v: string | number) => {
      const s = String(v ?? '');
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = '﻿' + rows.map((r) => r.map(esc).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `касса-${month}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const [y, m] = month.split('-');
  const monthTitle = `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y}`;

  return (
    <div className="grid">
      <div className="segmented" role="tablist">
        <button type="button" role="tab" aria-selected={view === 'cash'} className="segmented__item" onClick={() => setView('cash')}>💵 Касса по дням</button>
        <button type="button" role="tab" aria-selected={view === 'expenses'} className="segmented__item" onClick={() => setView('expenses')}>💸 Расходы кассира</button>
      </div>

      {view === 'expenses' ? <CashierExpensesReport /> : (
      <>
      <div className="action-bar" style={{ justifyContent: 'space-between' }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>{monthTitle}</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input type="month" className="input input--inline" value={month} onChange={(e) => setMonth(e.target.value)} />
          <button type="button" className="btn btn--sm" onClick={exportCsv} disabled={!data || loading}>📊 Экспорт CSV</button>
        </div>
      </div>

      {error && <div className="banner banner--warn">iiko: {error}</div>}

      <section className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="empty-state" style={{ padding: 60 }}>Загрузка из iiko и базы кассы…</div>
        ) : !data ? (
          <div className="empty-state" style={{ padding: 60 }}>Нет данных</div>
        ) : (
          <StackTable>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...thLeft, width: 36 }}>№</th>
                  <th style={thLeft}>День</th>
                  <th style={thLeft} />
                  <th style={th}>Наличные -</th>
                  <th style={th}>Наличные фискал</th>
                  <th style={th}>ТЕРМИНАЛ HUMO</th>
                  <th style={th}>ТЕРМИНАЛ Uzcard</th>
                  <th style={th}>Рахмат (Rakhmat)</th>
                  <th style={th}>Uzum</th>
                  <th style={th}>Yandex Eats</th>
                  <th style={th}>Click / Payme</th>
                  <th style={{ ...th, ...sep }}>Общая Сумма</th>
                  <th style={{ ...th, ...sep }}>iiko сумма продаж</th>
                  <th style={th}>Разница</th>
                </tr>
              </thead>
              <tbody>
                {data.days.map((r, i) => {
                  const weekend = r.weekday === 'суббота' || r.weekday === 'воскресенье';
                  const diffColor = !r.hasCash || Math.abs(r.diff) < 0.5 ? 'var(--text-muted)' : r.diff > 0 ? 'var(--danger)' : 'var(--success)';
                  return (
                    <tr key={r.date} style={{ background: weekend ? 'rgba(245, 158, 11, 0.08)' : undefined }}>
                      <td style={{ ...tdLeft, color: 'var(--text-muted)', fontWeight: 600 }}>{i + 1}</td>
                      <td style={tdLeft}>{fmtDate(r.date)}</td>
                      <td style={{ ...tdLeft, background: weekend ? 'rgba(245, 158, 11, 0.2)' : undefined, fontWeight: weekend ? 700 : 400 }} title={r.cashiers.join(', ')}>{r.weekday}</td>
                      <td style={td}>{r.hasCash ? fmt(r.cashGross) : ''}</td>
                      <td style={td}>{r.hasCash ? fmt(r.cashFiscal) : ''}</td>
                      <td style={td}>{r.hasCash ? fmt(r.humo) : ''}</td>
                      <td style={td}>{r.hasCash ? fmt(r.uzcard) : ''}</td>
                      <td style={td}>{r.hasCash ? fmt(r.rahmat) : ''}</td>
                      <td style={td}>{r.hasCash ? fmt(r.uzum) : ''}</td>
                      <td style={td}>{r.hasCash ? fmt(r.yandex) : ''}</td>
                      <td style={td}>{r.hasCash ? fmt(r.online) : ''}</td>
                      <td style={{ ...td, ...sep, fontWeight: 700 }}>{r.hasCash ? fmt(r.total) : ''}</td>
                      <td style={{ ...td, ...sep, fontWeight: 700 }}>{fmt(r.iikoRevenue)}</td>
                      <td style={{ ...td, color: diffColor, fontWeight: 700 }}>{r.hasCash ? fmt(r.diff) : ''}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--surface-muted)' }}>
                  <td style={{ ...tdLeft, fontWeight: 800 }} colSpan={3}>ИТОГО ЗА МЕСЯЦ</td>
                  <td style={{ ...td, fontWeight: 800 }}>{fmt(data.totals.cashGross)}</td>
                  <td style={{ ...td, fontWeight: 800 }}>{fmt(data.totals.cashFiscal)}</td>
                  <td style={{ ...td, fontWeight: 800 }}>{fmt(data.totals.humo)}</td>
                  <td style={{ ...td, fontWeight: 800 }}>{fmt(data.totals.uzcard)}</td>
                  <td style={{ ...td, fontWeight: 800 }}>{fmt(data.totals.rahmat)}</td>
                  <td style={{ ...td, fontWeight: 800 }}>{fmt(data.totals.uzum)}</td>
                  <td style={{ ...td, fontWeight: 800 }}>{fmt(data.totals.yandex)}</td>
                  <td style={{ ...td, fontWeight: 800 }}>{fmt(data.totals.online)}</td>
                  <td style={{ ...td, ...sep, fontWeight: 800 }}>{fmt(data.totals.total)}</td>
                  <td style={{ ...td, ...sep, fontWeight: 800 }}>{fmt(data.totals.iikoRevenue)}</td>
                  <td style={{ ...td, fontWeight: 800, color: Math.abs(data.totals.diff) < 0.5 ? 'var(--text-muted)' : data.totals.diff > 0 ? 'var(--danger)' : 'var(--success)' }}>{fmt(data.totals.diff)}</td>
                </tr>
              </tfoot>
            </table>
          </StackTable>
        )}
      </section>

      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
        «Наличные -» = фискальный нал + инкассация + расходы кассира из ящика. «Общая Сумма» = «Наличные -» + все безналичные типы.
        «Разница» = Общая Сумма − продажи iiko. Красным помечены дни, где посчитали больше, чем показывает iiko.
      </p>
    </>
      )}
    </div>
  );
}
