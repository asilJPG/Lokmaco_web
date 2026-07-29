'use client';

import { useEffect, useRef, useState } from 'react';
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

  // QR несёт данные текстом: при сканировании обычной камерой всё видно сразу,
  // без перехода на сайт и без интернета на телефоне.
  const qrText = [
    `Инв. №: ${invNum}`,
    `Наименование: ${asset.name || '—'}`,
    asset.category ? `Категория: ${asset.category}` : null,
    `Дата прихода: ${asset.commissioningDate || '—'}`,
    `Стоимость: ${Number(asset.initialCost ?? 0).toLocaleString('ru-RU')} сум`,
    asset.quantity ? `Кол-во: ${asset.quantity}` : null,
    `Локация: ${asset.location || '—'}`,
    `МОЛ: ${asset.responsiblePerson || '—'}`,
    asset.serialNumber ? `Код: ${asset.serialNumber}` : null,
    asset.status ? `Статус: ${asset.status}` : null,
  ].filter(Boolean).join('\n');

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=10&data=${encodeURIComponent(qrText)}`;

  function print() {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><head><title>Стикер ${invNum}</title><style>
      body { font-family: sans-serif; margin: 0; padding: 20px; text-align: center; }
      .sticker { width: 300px; border: 2px solid #000; border-radius: 12px; padding: 18px; margin: 0 auto; background: #fff; }
      .qr { width: 230px; height: 230px; margin: 0 auto 10px; display: block; }
      .subtitle { font-size: 13px; font-weight: 700; color: #111; }
    </style></head><body><div class="sticker"><img src="${qrUrl}" class="qr" alt="QR" />
      <div class="subtitle">Инвентарная наклейка оборудования</div></div>
      <script>const i=document.querySelector('.qr');const go=()=>{window.print();window.close()};
      if(i.complete){setTimeout(go,300)}else{i.onload=()=>setTimeout(go,300);i.onerror=()=>setTimeout(go,300)}</script>
    </body></html>`);
    w.document.close();
  }

  return (
    <Overlay onClose={onClose}>
      <div className="card__title"><span className="card__title-text">🏷 Стикер · {invNum}</span></div>
      <div style={{ textAlign: 'center' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrUrl} alt="QR" style={{ width: 230, height: 230, background: '#fff', borderRadius: 8 }} />
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>{asset.name}</div>
      </div>
      <div className="action-bar">
        <button type="button" className="btn" onClick={onClose}>Закрыть</button>
        <button type="button" className="btn btn--primary" onClick={print}>🖨 Печать</button>
      </div>
    </Overlay>
  );
}

type ScanResult = { found: Asset[]; unknown: string[] };

export function InventoryScanModal({ assets, onFinish, onClose }: { assets: Asset[]; onFinish: (ids: string[]) => Promise<void>; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [scanned, setScanned] = useState<ScanResult>({ found: [], unknown: [] });
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  const [busy, setBusy] = useState(false);

  // Сопоставляем по инвентарному номеру и по коду — в QR-стикере номер идёт
  // строкой «Инв. №: EQ-0042», поэтому ищем вхождение, а не полное совпадение.
  function register(text: string) {
    const needle = text.trim().toLowerCase();
    if (!needle) return;
    const hit = assets.find((a) =>
      (a.invNumber && needle.includes(a.invNumber.toLowerCase())) ||
      (a.serialNumber && needle.includes(a.serialNumber.toLowerCase()))
    );
    setScanned((s) => {
      if (hit) {
        if (s.found.some((a) => a.id === hit.id)) return s;
        return { ...s, found: [...s.found, hit] };
      }
      const short = text.trim().slice(0, 40);
      if (s.unknown.includes(short)) return s;
      return { ...s, unknown: [...s.unknown, short] };
    });
  }

  useEffect(() => {
    let raf = 0;
    let stopped = false;
    (async () => {
      const Detector = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;
      if (!Detector) {
        setError('Браузер не умеет сканировать камерой — вводите номера вручную.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const detector = new Detector({ formats: ['qr_code', 'code_128', 'ean_13'] });
        const tick = async () => {
          if (stopped || !videoRef.current) return;
          try {
            for (const c of await detector.detect(videoRef.current)) register(c.rawValue);
          } catch { /* кадр не распознался — не страшно */ }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch {
        setError('Нет доступа к камере — вводите номера вручную.');
      }
    })();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const missing = assets.filter((a) => !scanned.found.some((f) => f.id === a.id));

  return (
    <Overlay onClose={onClose}>
      <div className="card__title"><span className="card__title-text">📷 Инвентаризация сканированием</span></div>

      {error ? (
        <div className="banner banner--warn">{error}</div>
      ) : (
        <video ref={videoRef} muted playsInline style={{ width: '100%', borderRadius: 12, background: '#000', maxHeight: 260, objectFit: 'cover' }} />
      )}

      <div className="field" style={{ marginTop: 12 }}>
        <label className="field__label">Ввести номер вручную</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="input"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { register(manual); setManual(''); } }}
            placeholder="EQ-0042"
          />
          <button type="button" className="btn btn--sm" onClick={() => { register(manual); setManual(''); }}>Добавить</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, fontSize: 13, marginTop: 8 }}>
        <span>✅ Найдено: <b>{scanned.found.length}</b></span>
        <span style={{ color: 'var(--text-muted)' }}>⏳ Осталось: <b>{missing.length}</b></span>
        {scanned.unknown.length > 0 && <span style={{ color: 'var(--warning)' }}>❔ Чужих: <b>{scanned.unknown.length}</b></span>}
      </div>

      {scanned.found.length > 0 && (
        <div style={{ marginTop: 10, maxHeight: 160, overflowY: 'auto', fontSize: 13 }}>
          {scanned.found.map((a) => (
            <div key={a.id} style={{ padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
              <b style={{ fontFamily: 'monospace' }}>{a.invNumber}</b> · {a.name}
            </div>
          ))}
        </div>
      )}

      <div className="action-bar">
        <button type="button" className="btn" onClick={onClose}>Отмена</button>
        <button
          type="button"
          className="btn btn--primary"
          disabled={scanned.found.length === 0 || busy}
          onClick={async () => { setBusy(true); try { await onFinish(scanned.found.map((a) => a.id)); } finally { setBusy(false); } }}
        >
          {busy ? 'Сохранение…' : `Отметить ${scanned.found.length} шт.`}
        </button>
      </div>
    </Overlay>
  );
}
