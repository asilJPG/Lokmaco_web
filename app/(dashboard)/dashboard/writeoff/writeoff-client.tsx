'use client';

import { useEffect, useState } from 'react';
import { StoreSelect } from '@/components/store-select';
import { ProductPicker, type PickedItem } from '@/components/product-picker';

type Account = { id: string; name: string; code: string };

const DEFAULT_ACCOUNT = { id: '6f983109-eb1f-4517-917b-9912d5eeda16', name: 'Пищевые потери и списания' };

export function WriteoffClient({ isAdmin, fixedStoreId }: { isAdmin: boolean; fixedStoreId: string | null }) {
  const [storeId, setStoreId] = useState(fixedStoreId || '');
  const [storeName, setStoreName] = useState('');
  const [items, setItems] = useState<PickedItem[]>([]);
  const [comment, setComment] = useState('');
  const [accountId, setAccountId] = useState(DEFAULT_ACCOUNT.id);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Список счетов нужен только админу — остальным счёт зафиксирован на сервере.
  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      try {
        const res = await fetch('/api/iiko/accounts');
        const json = await res.json();
        setAccounts(json.data || []);
      } catch { /* остаётся дефолтный счёт */ }
    })();
  }, [isAdmin]);

  const canSend = !!storeId && items.length > 0 && items.every((it) => it.quantity > 0);
  const accountName = accounts.find((a) => a.id === accountId)?.name || DEFAULT_ACCOUNT.name;

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/iiko/writeoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, comment, store_id: storeId, store_name: storeName, account_id: accountId, account_name: accountName }),
      });
      const data = await res.json();
      if (!res.ok) setMsg({ ok: false, text: data.error || 'Ошибка' });
      else {
        setMsg({ ok: true, text: `Списание проведено, документ ${data.documentNumber}` });
        setItems([]);
        setComment('');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid">
      {!fixedStoreId && (
        <section className="card">
          <div className="card__title"><span className="card__title-text">🏬 Склад</span></div>
          <StoreSelect label="Списать со склада" value={storeId} onChange={(id, name) => { setStoreId(id); setStoreName(name); }} />
        </section>
      )}

      <section className="card">
        <div className="card__title"><span className="card__title-text">📦 Товары</span></div>
        <ProductPicker items={items} onChange={setItems} />
      </section>

      <section className="card">
        {isAdmin ? (
          <div className="field">
            <label className="field__label">Счёт списания</label>
            <select className="select" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value={DEFAULT_ACCOUNT.id}>{DEFAULT_ACCOUNT.name}</option>
              {accounts.filter((a) => a.id !== DEFAULT_ACCOUNT.id).map((a) => (
                <option key={a.id} value={a.id}>{a.name}{a.code ? ` · ${a.code}` : ''}</option>
              ))}
            </select>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            📉 Счёт списания: <b style={{ color: 'var(--text)' }}>{DEFAULT_ACCOUNT.name}</b>
          </div>
        )}
        <div className="field">
          <label className="field__label">Комментарий</label>
          <textarea className="textarea" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="причина списания" />
        </div>
      </section>

      <div className="action-bar">
        {msg && <div className={`banner ${msg.ok ? 'banner--success' : 'banner--error'}`} style={{ flex: 1 }}>{msg.text}</div>}
        <button type="button" className="btn btn--danger action-bar__btn" onClick={submit} disabled={!canSend || busy}>
          {busy ? 'Проведение…' : 'Провести списание'}
        </button>
      </div>
    </div>
  );
}
