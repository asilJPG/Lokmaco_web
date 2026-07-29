'use client';

import { useEffect, useMemo, useState } from 'react';

export type Product = { id: string; name: string; num: string; mainUnit: string };
export type PickedItem = { product_id: string; product_name: string; unit: string; quantity: number };

export function ProductPicker({ items, onChange }: { items: PickedItem[]; onChange: (next: PickedItem[]) => void }) {
  const [all, setAll] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/iiko/products');
        const data = await res.json();
        setAll(data.products || []);
        if (data.error) setError(data.error);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'fetch failed');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const taken = new Set(items.map((i) => i.product_id));
    return all
      .filter((p) => !taken.has(p.id))
      .filter((p) => p.name.toLowerCase().includes(q) || p.num.toLowerCase().includes(q))
      .slice(0, 12);
  }, [query, all, items]);

  function add(p: Product) {
    onChange([...items, { product_id: p.id, product_name: p.name, unit: p.mainUnit, quantity: 0 }]);
    setQuery('');
  }
  function update(i: number, qty: string) {
    onChange(items.map((it, j) => (j === i ? { ...it, quantity: parseFloat(qty) || 0 } : it)));
  }
  function remove(i: number) {
    onChange(items.filter((_, j) => j !== i));
  }

  return (
    <div className="grid">
      <div className="field">
        <label className="field__label">Поиск товара</label>
        <input
          className="input"
          placeholder={loading ? 'Загрузка справочника…' : 'Название или артикул'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={loading}
        />
        {error && <div className="banner banner--warn" style={{ marginTop: 8 }}>iiko: {error}</div>}
        {filtered.length > 0 && (
          <div style={{ marginTop: 8, border: '1px solid var(--border)', borderRadius: 8, maxHeight: 240, overflowY: 'auto' }}>
            {filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => add(p)}
                style={{ width: '100%', textAlign: 'left', padding: '8px 12px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', fontSize: 13 }}
              >
                <div style={{ fontWeight: 500 }}>{p.name}</div>
                <div style={{ color: 'var(--text-faint)', fontSize: 11 }}>{p.num || '—'} · {p.mainUnit}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div className="card" style={{ padding: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Товар</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', width: 140 }}>Кол-во</th>
                <th style={{ padding: '10px 12px', width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={it.product_id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 12px' }}>
                    {it.product_name}
                    <span style={{ color: 'var(--text-faint)', fontSize: 11, marginLeft: 8 }}>{it.unit}</span>
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <input type="number" inputMode="decimal" step="0.001" className="input input--inline input--number" value={it.quantity || ''} onChange={(e) => update(i, e.target.value)} placeholder="0" />
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <button type="button" className="btn btn--danger btn--icon" onClick={() => remove(i)}>×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
