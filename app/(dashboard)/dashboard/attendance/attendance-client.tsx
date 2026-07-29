'use client';

import { useEffect, useState } from 'react';

type Shift = { dateFrom: string; dateTo: string; departmentName: string; attendanceType: string; comment: string };
type Employee = { id: string; name: string; role: string; shifts: Shift[] };

function fmtDateTime(iso: string) {
  if (!iso) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}.${m[2]} ${m[4]}:${m[5]}`;
}

export function AttendanceClient({ from, to }: { from: string; to: string }) {
  const [rows, setRows] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/iiko/analytics/attendance?from=${from}&to=${to}`);
        const json = await res.json();
        if (cancelled) return;
        setRows(json.data || []);
        if (json.error) setError(json.error);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'fetch failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [from, to]);

  const totalShifts = rows.reduce((s, e) => s + e.shifts.length, 0);

  return (
    <div className="grid">
      {error && <div className="banner banner--warn">iiko: {error}</div>}
      {loading ? (
        <div className="card"><div className="empty-state">Загрузка из iiko…</div></div>
      ) : rows.length === 0 ? (
        <div className="card"><div className="empty-state">Явок за период нет</div></div>
      ) : (
        <>
          <div className="stat-grid">
            <div className="stat-card"><div className="stat-card__label">👥 Сотрудников</div><div className="stat-card__value">{rows.length}</div></div>
            <div className="stat-card"><div className="stat-card__label">🕒 Смен</div><div className="stat-card__value">{totalShifts}</div></div>
          </div>
          <section className="card">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase' }}>
                    <th style={{ padding: '10px 8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Сотрудник</th>
                    <th style={{ padding: '10px 8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Роль</th>
                    <th style={{ padding: '10px 8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Смены</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((emp) => (
                    <tr key={emp.id}>
                      <td style={{ padding: '8px', borderBottom: '1px solid var(--border)', fontWeight: 600, verticalAlign: 'top' }}>{emp.name}</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', verticalAlign: 'top' }}>{emp.role}</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>
                        {emp.shifts.map((s, i) => (
                          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'baseline', padding: '2px 0' }}>
                            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtDateTime(s.dateFrom)} — {fmtDateTime(s.dateTo)}</span>
                            {s.departmentName && <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{s.departmentName}</span>}
                            {s.comment && <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>· {s.comment}</span>}
                          </div>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
