'use client';

import { useState } from 'react';
import { StoreSelect } from '@/components/store-select';
import { ProductPicker, type PickedItem } from '@/components/product-picker';

export function InventoryClient() {
  const [storeId, setStoreId] = useState('');
  const [storeName, setStoreName] = useState('');
  const [items, setItems] = useState<PickedItem[]>([]);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const canSend = storeId && items.length > 0 && items.every((it) => it.quantity >= 0);

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/iiko/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: storeId, store_name: storeName, items, comment }),
      });
      const data = await res.json();
      if (!res.ok) setMsg({ ok: false, text: data.error || 'Ошибка' });
      else {
        setMsg({ ok: true, text: `Создан документ ${data.documentNumber}` });
        setItems([]);
        setComment('');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid">
      <section className="card">
        <div className="card__title"><span className="card__title-text">📍 Склад</span></div>
        <StoreSelect value={storeId} onChange={(id, name) => { setStoreId(id); setStoreName(name); }} />
      </section>

      <section className="card">
        <div className="card__title"><span className="card__title-text">📦 Фактические остатки</span></div>
        <ProductPicker items={items} onChange={setItems} />
      </section>

      <section className="card">
        <div className="field">
          <label className="field__label">Комментарий</label>
          <textarea className="textarea" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="опционально" />
        </div>
      </section>

      <div className="action-bar">
        {msg && <div className={`banner ${msg.ok ? 'banner--success' : 'banner--error'}`} style={{ flex: 1 }}>{msg.text}</div>}
        <button type="button" className="btn btn--primary action-bar__btn" onClick={submit} disabled={!canSend || busy}>
          {busy ? 'Создание…' : 'Создать инвентаризацию'}
        </button>
      </div>
    </div>
  );
}
