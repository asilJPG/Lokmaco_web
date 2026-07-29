'use client';

import { useEffect, useState } from 'react';

export type Store = { id: string; name: string };

export function StoreSelect({ value, onChange, label = 'Склад', exclude }: { value: string; onChange: (v: string, name: string) => void; label?: string; exclude?: string }) {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/iiko/stores');
        const data = await res.json();
        setStores(data.stores || []);
        if (data.error) setError(data.error);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'fetch failed');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const list = exclude ? stores.filter((s) => s.id !== exclude) : stores;

  return (
    <div className="field">
      <label className="field__label">{label}</label>
      <select
        className="select"
        value={value}
        onChange={(e) => {
          const s = stores.find((x) => x.id === e.target.value);
          onChange(e.target.value, s?.name || '');
        }}
        disabled={loading}
      >
        <option value="">{loading ? 'Загрузка…' : '— выбери —'}</option>
        {list.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
      {error && <div className="field__hint" style={{ color: 'var(--warning)' }}>iiko: {error}</div>}
    </div>
  );
}
