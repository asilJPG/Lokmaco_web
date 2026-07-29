'use client';

import { useEffect, useState } from 'react';

export type Supplier = { id: string; name: string };

export function SupplierSelect({ value, onChange, label = 'Поставщик' }: { value: string; onChange: (v: string, name: string) => void; label?: string }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/iiko/suppliers');
        const data = await res.json();
        setSuppliers(data.suppliers || []);
        if (data.error) setError(data.error);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'fetch failed');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="field">
      <label className="field__label">{label}</label>
      <select
        className="select"
        value={value}
        onChange={(e) => {
          const s = suppliers.find((x) => x.id === e.target.value);
          onChange(e.target.value, s?.name || '');
        }}
        disabled={loading}
      >
        <option value="">{loading ? 'Загрузка…' : '— выбери —'}</option>
        {suppliers.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
      {error && <div className="field__hint" style={{ color: 'var(--warning)' }}>iiko: {error}</div>}
    </div>
  );
}
