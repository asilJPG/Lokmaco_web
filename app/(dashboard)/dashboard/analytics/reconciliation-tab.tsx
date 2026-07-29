'use client';

import { useEffect, useState } from 'react';

type Row = {
  field: string;
  label: string;
  iikoAmount: number;
  cashierExpenses: number;
  calculatedBalance: number;
  cashierFact: number;
  diff: number;
};

type Totals = { iikoAmount: number; cashierExpenses: number; calculatedBalance: number; cashierFact: number; diff: number };

type Data = { rows: Row[]; totals: Totals; reportsCount: number };

function fmt(n: number) {
  return Math.round(n).toLocaleString('ru-RU');
}

function DiffCell({ diff }: { diff: number }) {
  const color = diff > 0 ? 'var(--success)' : diff < 0 ? 'var(--danger)' : 'var(--text-faint)';
  const sign = diff > 0 ? '+' : '';
  return (
    <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid var(--border)', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color }}>
      {diff !== 0 ? `${sign}${fmt(diff)}` : '0'}
    </td>
  );
}

export function ReconciliationTab({ from, to }: { from: string; to: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/iiko/analytics/cash-reconciliation?from=${from}&to=${to}`);
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

  if (loading) return <div className="card"><div className="empty-state">Загрузка из iiko…</div></div>;

  return (
    <div className="grid">
      {error && <div className="banner banner--warn">iiko: {error}</div>}

      {!data || data.rows.length === 0 ? (
        <div className="card"><div className="empty-state">Данных нет</div></div>
      ) : (
        <section className="card">
          <div className="card__title">
            <span className="card__title-text">📊 Сверка по типам оплаты</span>
            <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>{data.reportsCount} смен(ы) кассира за период</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 820 }}>
              <thead>
                <tr style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase' }}>
                  <th style={{ padding: '10px 8px', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>Тип оплаты</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right', borderBottom: '2px solid var(--border)' }}>Сумма из iiko</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right', borderBottom: '2px solid var(--border)' }}>Расходы кассира</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right', borderBottom: '2px solid var(--border)' }}>Расчётный остаток</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right', borderBottom: '2px solid var(--border)' }}>Факт сдачи</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right', borderBottom: '2px solid var(--border)' }}>Разница излишек/недосдача</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.field}>
                    <td style={{ padding: '8px', borderBottom: '1px solid var(--border)', fontWeight: 600, background: 'var(--surface-muted)' }}>{r.label}</td>
                    <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid var(--border)', fontVariantNumeric: 'tabular-nums' }}>{fmt(r.iikoAmount)}</td>
                    <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid var(--border)', fontVariantNumeric: 'tabular-nums', color: r.cashierExpenses > 0 ? 'var(--danger)' : 'var(--text-faint)' }}>
                      {r.cashierExpenses > 0 ? fmt(r.cashierExpenses) : '—'}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid var(--border)', fontVariantNumeric: 'tabular-nums' }}>{fmt(r.calculatedBalance)}</td>
                    <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid var(--border)', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{fmt(r.cashierFact)}</td>
                    <DiffCell diff={r.diff} />
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--surface-muted)', fontWeight: 700 }}>
                  <td style={{ padding: '8px', borderTop: '2px solid var(--border)' }}>📊 Итого</td>
                  <td style={{ padding: '8px', textAlign: 'right', borderTop: '2px solid var(--border)', fontVariantNumeric: 'tabular-nums' }}>{fmt(data.totals.iikoAmount)}</td>
                  <td style={{ padding: '8px', textAlign: 'right', borderTop: '2px solid var(--border)', fontVariantNumeric: 'tabular-nums', color: data.totals.cashierExpenses > 0 ? 'var(--danger)' : 'var(--text-faint)' }}>
                    {data.totals.cashierExpenses > 0 ? fmt(data.totals.cashierExpenses) : '—'}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'right', borderTop: '2px solid var(--border)', fontVariantNumeric: 'tabular-nums' }}>{fmt(data.totals.calculatedBalance)}</td>
                  <td style={{ padding: '8px', textAlign: 'right', borderTop: '2px solid var(--border)', fontVariantNumeric: 'tabular-nums' }}>{fmt(data.totals.cashierFact)}</td>
                  <DiffCell diff={data.totals.diff} />
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
