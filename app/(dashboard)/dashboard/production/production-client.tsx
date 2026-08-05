'use client';

import { useCallback, useMemo, useState } from 'react';
import { ProductPicker, type PickedItem } from '@/components/product-picker';
import { formatDraftTime, useDraft } from '@/lib/use-draft';

type Draft = { items: PickedItem[]; comment: string };

export function ProductionClient({ storeId }: { storeId: string | null }) {
  const [items, setItems] = useState<PickedItem[]>([]);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const draftValue = useMemo<Draft>(() => ({ items, comment }), [items, comment]);
  const restoreDraft = useCallback((d: Draft) => {
    setItems(Array.isArray(d.items) ? d.items : []);
    setComment(d.comment || '');
  }, []);
  // Склад приходит из роли; у админа его нет — тогда общий ключ,
  // черновик всё равно разделён по филиалу внутри хука.
  const draft = useDraft<Draft>({
    name: 'production',
    scope: storeId || 'default',
    value: draftValue,
    isEmpty: (v) => v.items.length === 0 && !v.comment,
    onRestore: restoreDraft,
  });

  function resetForm() {
    setItems([]);
    setComment('');
  }

  const canSend = items.length > 0 && items.every((it) => it.quantity > 0);

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/iiko/production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, comment }),
      });
      const data = await res.json();
      if (!res.ok) setMsg({ ok: false, text: data.error || 'Ошибка' });
      else {
        setMsg({ ok: true, text: `Создан документ ${data.documentNumber}` });
        // Только после успеха, иначе документ проведут дважды.
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
        <div className="card__title"><span className="card__title-text">📦 Заготовки</span></div>
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
          {busy ? 'Создание…' : 'Создать приготовление'}
        </button>
      </div>
    </div>
  );
}
