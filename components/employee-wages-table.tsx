'use client';

import { useMemo, useState } from 'react';

type Row = { name: string; total: number; days: number };

function fmt(n: number) {
  return n.toLocaleString('ru-RU');
}

export function EmployeeWagesTable({ rows }: { rows: Row[] }) {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(s));
  }, [rows, q]);
  const totalSum = filtered.reduce((s, r) => s + r.total, 0);

  return (
    <>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <input
          className="input input--inline"
          placeholder="Поиск по сотруднику"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1, minWidth: 180 }}
        />
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
          {filtered.length} из {rows.length} · Σ {fmt(totalSum)}
        </span>
      </div>
      {filtered.length === 0 ? (
        <div className="empty-state">Никого не нашли</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase' }}>
              <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Сотрудник</th>
              <th style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Смен</th>
              <th style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Сумма</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.name}>
                <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>{e.name}</td>
                <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>{e.days}</td>
                <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid var(--border)', fontVariantNumeric: 'tabular-nums' }}>{fmt(e.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
