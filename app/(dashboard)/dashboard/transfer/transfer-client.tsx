'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { StoreSelect } from '@/components/store-select';
import { ProductPicker, type PickedItem } from '@/components/product-picker';

export function TransferClient() {
  const router = useRouter();
  const [fromId, setFromId] = useState('');
  const [fromName, setFromName] = useState('');
  const [toId, setToId] = useState('');
  const [toName, setToName] = useState('');
  const [items, setItems] = useState<PickedItem[]>([]);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const canSend = fromId && toId && fromId !== toId && items.length > 0 && items.every((it) => it.quantity > 0);

  async function submit(direct: boolean) {
    setBusy(true);
    setMsg(null);
    try {
      const url = direct ? '/api/iiko/transfer' : '/api/iiko/pending-transfer';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_from: fromId,
          store_from_name: fromName,
          store_to: toId,
          store_to_name: toName,
          items,
          comment,
        }),
      });
      const data = await res.json();
      if (!res.ok) setMsg({ ok: false, text: data.error || 'Ошибка' });
      else {
        if (direct) setMsg({ ok: true, text: `Создан документ ${data.documentNumber}` });
        else {
          setMsg({ ok: true, text: 'Отправлено на подтверждение' });
          router.refresh();
        }
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
        <div className="card__title"><span className="card__title-text">📤📥 Склады</span></div>
        <div className="grid grid--2">
          <StoreSelect label="Откуда" value={fromId} onChange={(id, name) => { setFromId(id); setFromName(name); }} exclude={toId} />
          <StoreSelect label="Куда" value={toId} onChange={(id, name) => { setToId(id); setToName(name); }} exclude={fromId} />
        </div>
      </section>

      <section className="card">
        <div className="card__title"><span className="card__title-text">📦 Товары</span></div>
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
        <button type="button" className="btn" onClick={() => submit(false)} disabled={!canSend || busy}>
          {busy ? '…' : 'На подтверждение'}
        </button>
        <button type="button" className="btn btn--primary" onClick={() => submit(true)} disabled={!canSend || busy}>
          {busy ? 'Создание…' : 'Сразу в iiko'}
        </button>
      </div>
    </div>
  );
}
