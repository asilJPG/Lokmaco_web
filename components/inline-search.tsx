'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useState, useTransition, useEffect } from 'react';

export function InlineSearch({ placeholder = 'Поиск…', paramName = 'q' }: { placeholder?: string; paramName?: string }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const initial = sp?.get(paramName) || '';
  const [value, setValue] = useState(initial);
  const [pending, start] = useTransition();

  useEffect(() => { setValue(sp?.get(paramName) || ''); }, [sp, paramName]);

  useEffect(() => {
    const id = setTimeout(() => {
      const next = new URLSearchParams(sp?.toString() || '');
      if (value) next.set(paramName, value); else next.delete(paramName);
      next.delete('page');
      const qs = next.toString();
      start(() => router.push(qs ? `${path}?${qs}` : path || '/'));
    }, 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div style={{ position: 'relative', display: 'inline-flex', flex: 1, minWidth: 180 }}>
      <input className="input input--inline" value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} style={{ paddingRight: value ? 28 : 12 }} />
      {value && (
        <button type="button" onClick={() => setValue('')} aria-label="Очистить" style={{ position: 'absolute', right: 4, top: 4, bottom: 4, width: 22, border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14 }}>×</button>
      )}
      {pending && <span style={{ position: 'absolute', right: value ? 28 : 8, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: 'var(--text-faint)' }}>…</span>}
    </div>
  );
}
