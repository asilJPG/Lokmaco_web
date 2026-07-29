'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

type Filial = { id: number; name: string };

export function FilialSwitcher({ filials, current, allowAll }: { filials: Filial[]; current: number | 'all'; allowAll: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [, start] = useTransition();

  if (filials.length <= 1 && !allowAll) return null;

  async function switchTo(value: string) {
    setBusy(true);
    await fetch('/api/current-filial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: value }),
    });
    setBusy(false);
    start(() => router.refresh());
  }

  return (
    <div style={{ padding: '0 var(--space-5) var(--space-3)' }}>
      <label style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>Филиал</label>
      <select
        value={String(current)}
        onChange={(e) => switchTo(e.target.value)}
        disabled={busy}
        style={{
          marginTop: 6,
          width: '100%',
          padding: '8px 10px',
          background: 'rgba(255,255,255,0.06)',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 8,
          fontSize: 13,
          cursor: 'pointer',
        }}
      >
        {allowAll && filials.length > 1 && <option value="all">Все филиалы</option>}
        {filials.map((f) => (
          <option key={f.id} value={f.id}>{f.name}</option>
        ))}
      </select>
    </div>
  );
}
