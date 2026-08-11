'use client';

import { useEffect, useState } from 'react';
import type { Asset } from '@/db/schema';

export const STATUS: Record<string, { label: string; color: string }> = {
  in_use: { label: '🟢 В эксплуатации', color: 'var(--success)' },
  repair: { label: '🟡 В ремонте', color: 'var(--warning)' },
  in_stock: { label: '🔵 На складе', color: 'var(--accent)' },
  written_off: { label: '🔴 Списан', color: 'var(--danger)' },
  sold: { label: '⚪ Продан', color: 'var(--text-muted)' },
};

export const CATEGORIES = ['Оборудование', 'Мебель', 'Техника', 'Посуда', 'Инвентарь', 'Прочее'];

export type AssetForm = {
  id?: string;
  inv_number: string; name: string; category: string; location: string;
  responsible_person: string; quantity: string; initial_cost: string;
  commissioning_date: string; status: string; serial_number: string; notes: string;
};

export function emptyForm(): AssetForm {
  return {
    inv_number: '', name: '', category: 'Оборудование', location: '', responsible_person: '',
    quantity: '1', initial_cost: '0', commissioning_date: new Date().toISOString().split('T')[0],
    status: 'in_use', serial_number: '', notes: '',
  };
}

export function toForm(a: Asset): AssetForm {
  return {
    id: a.id,
    inv_number: a.invNumber || '',
    name: a.name || '',
    category: a.category || 'Оборудование',
    location: a.location || '',
    responsible_person: a.responsiblePerson || '',
    quantity: String(a.quantity ?? 1),
    initial_cost: String(a.initialCost ?? 0),
    commissioning_date: a.commissioningDate || '',
    status: a.status || 'in_use',
    serial_number: a.serialNumber || '',
    notes: a.notes || '',
  };
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        {children}
      </div>
    </div>
  );
}

export function AssetFormModal({ initial, onSave, onClose }: { initial: AssetForm; onSave: (f: AssetForm) => Promise<void>; onClose: () => void }) {
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof AssetForm, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const valid = form.name.trim() && form.location.trim() && form.responsible_person.trim();

  return (
    <Overlay onClose={onClose}>
      <div className="card__title"><span className="card__title-text">{form.id ? '✎ Редактировать' : '➕ Новое основное средство'}</span></div>
      <div className="grid grid--2">
        <div className="field">
          <label className="field__label">Инвентарный №</label>
          <input className="input" value={form.inv_number} onChange={(e) => set('inv_number', e.target.value)} placeholder="сгенерируется автоматически" />
        </div>
        <div className="field">
          <label className="field__label">Наименование *</label>
          <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div className="field">
          <label className="field__label">Категория</label>
          <select className="select" value={form.category} onChange={(e) => set('category', e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="field__label">Статус</label>
          <select className="select" value={form.status} onChange={(e) => set('status', e.target.value)}>
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="field__label">Место эксплуатации *</label>
          <input className="input" value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="Кухня / Зал / Бар" />
        </div>
        <div className="field">
          <label className="field__label">МОЛ (ответственный) *</label>
          <input className="input" value={form.responsible_person} onChange={(e) => set('responsible_person', e.target.value)} />
        </div>
        <div className="field">
          <label className="field__label">Количество</label>
          <input type="number" className="input input--number" value={form.quantity} onChange={(e) => set('quantity', e.target.value)} />
        </div>
        <div className="field">
          <label className="field__label">Первоначальная стоимость</label>
          <input type="number" className="input input--number" value={form.initial_cost} onChange={(e) => set('initial_cost', e.target.value)} />
        </div>
        <div className="field">
          <label className="field__label">Дата прихода</label>
          <input type="date" className="input" value={form.commissioning_date} onChange={(e) => set('commissioning_date', e.target.value)} />
        </div>
        <div className="field">
          <label className="field__label">Серийный номер / код</label>
          <input className="input" value={form.serial_number} onChange={(e) => set('serial_number', e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label className="field__label">Примечание</label>
        <textarea className="textarea" rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
      </div>
      <div className="action-bar">
        <button type="button" className="btn" onClick={onClose}>Отмена</button>
        <button
          type="button"
          className="btn btn--primary"
          disabled={!valid || busy}
          onClick={async () => { setBusy(true); try { await onSave(form); } finally { setBusy(false); } }}
        >
          {busy ? 'Сохранение…' : 'Сохранить'}
        </button>
      </div>
    </Overlay>
  );
}

export function QrStickerModal({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  const invNum = asset.invNumber || `EQ-${asset.id.slice(0, 6)}`;
  const [svg, setSvg] = useState('');

  /**
   * ⚠️ QR ведёт на `/tag/<инв. номер>` и рисуется **своей** библиотекой в SVG.
   *
   * Раньше картинка тянулась с `api.qrserver.com`: без интернета — пустая
   * рамка, а при печати `<img>` не успевал декодироваться, и на лист уходила
   * одна подпись. Плюс данные (стоимость, МОЛ) были зашиты прямо в код, то
   * есть читались любой камерой в зале.
   */
  useEffect(() => {
    let alive = true;
    (async () => {
      const QRCode = (await import('qrcode')).default;
      const url = `${window.location.origin}/tag/${encodeURIComponent(invNum)}`;
      const out = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
      if (alive) setSvg(out);
    })();
    return () => { alive = false; };
  }, [invNum]);

  async function print() {
    let host = document.getElementById('print-tags');
    if (!host) {
      host = document.createElement('div');
      host.id = 'print-tags';
      document.body.appendChild(host);
    }
    host.innerHTML = `<div class="tag-sheet tag-sheet--one"><div class="tag-cell">${svg}
      <div class="tag-cell__code">${invNum}</div>
      <div class="tag-cell__cap">Инвентарная наклейка оборудования</div></div></div>`;
    document.body.classList.add('printing-tags');
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    window.print();
    setTimeout(() => {
      document.body.classList.remove('printing-tags');
      host!.innerHTML = '';
    }, 1000);
  }

  return (
    <Overlay onClose={onClose}>
      <div className="card__title"><span className="card__title-text">🏷 Стикер · {invNum}</span></div>
      <div style={{ textAlign: 'center' }}>
        <div
          style={{ width: 230, height: 230, margin: '0 auto', background: '#fff', borderRadius: 8, padding: 8 }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>{asset.name}</div>
      </div>
      <div className="action-bar">
        <button type="button" className="btn" onClick={onClose}>Закрыть</button>
        <button type="button" className="btn btn--primary" disabled={!svg} onClick={print}>🖨 Печать</button>
      </div>
    </Overlay>
  );
}


