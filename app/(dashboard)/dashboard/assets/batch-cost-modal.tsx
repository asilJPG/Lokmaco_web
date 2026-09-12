'use client';

import { useMemo, useState } from 'react';
import type { Asset } from '@/db/schema';

const money = (n: number) => Math.round(n).toLocaleString('ru-RU');

/**
 * Массовая правка стоимости партии одинаковых предметов.
 *
 * У сорока стульев одна цена; править её в каждой карточке — сорок кликов.
 * Здесь одно поле: **стоимость одного экземпляра**, применяется ко всем.
 *
 * ⚠️ Перезаписывает всех, включая тех, у кого цена уже отличалась. Так и
 * задумано (решение Асиля, 12.09.2026): если у одного стула цена реально
 * другая — правишь его после общей, отдельно.
 */
export function BatchCostModal({ units, onClose, onSaved }: {
  units: Asset[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const stats = useMemo(() => {
    const costs = units.map((u) => Number(u.initialCost) || 0);
    const uniq = Array.from(new Set(costs)).sort((a, b) => a - b);
    const total = costs.reduce((s, c) => s + c, 0);
    return {
      total,
      uniq,
      // Наиболее частая цена — её и ставим в поле по умолчанию: у большинства
      // партий все экземпляры уже с одной суммой, и «применить ко всем ту же»
      // — самый частый сценарий сохранения формы без правок.
      mode: costs.reduce<{ v: number; n: number }>((best, c) => {
        const n = costs.filter((x) => x === c).length;
        return n > best.n ? { v: c, n } : best;
      }, { v: 0, n: 0 }).v,
    };
  }, [units]);

  const [value, setValue] = useState(String(stats.mode || 0));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const cost = Number(value.replace(',', '.').replace(/\s/g, '')) || 0;
  const willChange = units.filter((u) => (Number(u.initialCost) || 0) !== cost).length;

  async function save() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/assets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_cost', ids: units.map((u) => u.id), cost, id: units[0].id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error || 'Не удалось сохранить'); return; }
      await onSaved();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ maxWidth: 460, width: '100%' }}>
        <div className="card__title"><span className="card__title-text">💰 Стоимость партии</span></div>

        <div style={{ padding: '6px 0 14px', fontSize: 14 }}>
          <div style={{ fontWeight: 600 }}>{units[0].name}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>
            {units.length} {units.length === 1 ? 'экземпляр' : units.length < 5 ? 'экземпляра' : 'экземпляров'}
            {' · сумма сейчас '}<b>{money(stats.total)}</b> сум
          </div>
        </div>

        {stats.uniq.length > 1 && (
          /* У экземпляров цены разошлись — предупреждаем прямо: без этого
             человек может не заметить, что перезаписывает исключение. */
          <div className="banner banner--warn" style={{ marginBottom: 12 }}>
            У экземпляров сейчас {stats.uniq.length} разных цены: {stats.uniq.slice(0, 3).map(money).join(', ')}
            {stats.uniq.length > 3 ? ' и др.' : ''}. Общая правка перезапишет всех.
          </div>
        )}

        <div className="field">
          <label className="field__label">Стоимость одного экземпляра</label>
          <input
            type="number"
            inputMode="decimal"
            className="input input--number"
            value={value}
            autoFocus
            onChange={(e) => setValue(e.target.value)}
          />
          <div className="field__hint">
            × {units.length} = <b>{money(cost * units.length)}</b> сум
            {willChange > 0 && cost > 0 && ` · изменится ${willChange} из ${units.length}`}
            {willChange === 0 && ' · цена не изменится'}
          </div>
        </div>

        {error && <div className="banner banner--error">{error}</div>}

        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>Отмена</button>
          <button type="button" className="btn btn--primary" disabled={busy || cost < 0} onClick={save}>
            {busy ? 'Сохраняю…' : `Применить ко всем ${units.length}`}
          </button>
        </div>
      </div>
    </div>
  );
}
