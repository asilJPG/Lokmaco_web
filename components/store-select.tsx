'use client';

import { useStores, type Store } from '@/lib/stores-client';

export type { Store };

/**
 * Выпадающий список складов.
 *
 * Сам справочник живёт в `lib/stores-client.ts` — один запрос на вкладку,
 * общий для всех разделов. Здесь только внешний вид поля.
 */
export function StoreSelect({
  value,
  onChange,
  label = 'Склад',
  exclude,
  initial,
}: {
  value: string;
  onChange: (v: string, name: string) => void;
  label?: string;
  exclude?: string;
  initial?: Store[];
}) {
  const { stores, loading, error } = useStores(initial);

  const list = exclude ? stores.filter((s) => s.id !== exclude) : stores;
  const busy = loading && stores.length === 0;

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
        disabled={busy}
      >
        <option value="">{busy ? 'Загрузка…' : '— выбери —'}</option>
        {list.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
      {/* Ошибку показываем, только если показывать больше нечего: список из
          sessionStorage рабочий, и пугать им из-за сорванного фонового
          обновления незачем. */}
      {error && stores.length === 0 && (
        <div className="field__hint" style={{ color: 'var(--warning)' }}>iiko: {error}</div>
      )}
    </div>
  );
}
