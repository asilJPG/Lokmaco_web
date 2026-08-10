'use client';

import { useEffect, useState } from 'react';

type Row = { id: string; name: string; note: string; sortOrder: number; assets_count: number };

/**
 * Места размещения.
 *
 * ⚠️ Без них обход возможен только «всё сразу»: охват сессии инвентаризации
 * задаётся местом. Обходят по одному помещению, а не по всему ресторану
 * разом, поэтому места — не украшение справочника, а условие работы обхода.
 *
 * Текстовое поле `assets.location` при этом не трогаем: в него пишет легаси, и
 * там у 90 карточек из 91 стоит одно и то же «Кухня / Ресторан» — то есть оно
 * никогда и не было местом.
 */
export function LocationsModal({ onClose, onChanged }: { onClose: () => void; onChanged: () => Promise<void> }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/assets/locations');
      const json = await res.json();
      setRows(json.data || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function add() {
    if (!name.trim()) return;
    setError('');
    const res = await fetch('/api/assets/locations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, sort_order: rows.length }),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error || 'Не удалось добавить'); return; }
    setName('');
    await load();
    await onChanged();
  }

  async function rename(row: Row) {
    const next = prompt('Название места', row.name);
    if (!next || next === row.name) return;
    await fetch('/api/assets/locations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: row.id, name: next }),
    });
    await load();
    await onChanged();
  }

  async function remove(row: Row) {
    if (!confirm(`Удалить место «${row.name}»?`)) return;
    const res = await fetch(`/api/assets/locations?id=${row.id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok) { setError(json.error || 'Не удалось удалить'); return; }
    await load();
    await onChanged();
  }

  return (
    <div className="scan-overlay">
      <div className="scan-sheet">
        <div className="scan-sheet__head">
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>📍 Места</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Обход идёт по одному помещению</div>
          </div>
          <button type="button" className="btn btn--sm" onClick={onClose}>✕</button>
        </div>

        <div className="scan-sheet__body">
          {error && <div className="banner banner--error">{error}</div>}

          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="input"
              placeholder="Кухня, Бар, Зал, Подвал…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
            />
            <button type="button" className="btn btn--primary btn--sm" onClick={add}>Добавить</button>
          </div>

          {loading ? (
            <div className="empty-state">Загрузка…</div>
          ) : rows.length === 0 ? (
            <div className="empty-state">Мест пока нет</div>
          ) : rows.map((r) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ flex: 1, fontWeight: 600 }}>{r.name}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{r.assets_count} шт</span>
              <button type="button" className="btn btn--sm" onClick={() => rename(r)}>✎</button>
              <button type="button" className="btn btn--sm btn--danger" onClick={() => remove(r)}>✕</button>
            </div>
          ))}
        </div>

        <div className="scan-sheet__foot">
          <button type="button" className="btn" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  );
}
