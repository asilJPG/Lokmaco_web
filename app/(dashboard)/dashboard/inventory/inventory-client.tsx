'use client';

import { useCallback, useMemo, useState } from 'react';
import { StoreSelect } from '@/components/store-select';
import { ProductPicker, type PickedItem } from '@/components/product-picker';
import { formatDraftTime, useDraft } from '@/lib/use-draft';

type Draft = { items: PickedItem[]; comment: string };

export function InventoryClient() {
  const [storeId, setStoreId] = useState('');
  const [storeName, setStoreName] = useState('');
  const [items, setItems] = useState<PickedItem[]>([]);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Пересчёт склада — полчаса работы, вкладку на телефоне выгружает.
  // Ключ по складу, как и в легаси: черновики разных складов не смешиваем.
  const draftValue = useMemo<Draft>(() => ({ items, comment }), [items, comment]);
  const restoreDraft = useCallback((d: Draft) => {
    setItems(Array.isArray(d.items) ? d.items : []);
    setComment(d.comment || '');
  }, []);
  const draft = useDraft<Draft>({
    name: 'inventory',
    scope: storeId || null,
    value: draftValue,
    isEmpty: (v) => v.items.length === 0 && !v.comment,
    onRestore: restoreDraft,
  });

  function resetForm() {
    setItems([]);
    setComment('');
  }

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
        // Только после успеха: иначе черновик всплывёт и склад пересчитают дважды.
        draft.clear();
        resetForm();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid">
      {draft.restoredAt !== null && (
        <div className="banner banner--info draft-banner">
          <span>Восстановлен черновик от {formatDraftTime(draft.restoredAt)}</span>
          <button type="button" className="btn btn--sm" onClick={() => { draft.clear(); resetForm(); }}>
            Очистить
          </button>
        </div>
      )}

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
