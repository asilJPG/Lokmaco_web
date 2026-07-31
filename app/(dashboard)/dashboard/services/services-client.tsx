'use client';

import { useEffect, useState } from 'react';
import { StoreSelect } from '@/components/store-select';

type Account = { id: string; name: string; code: string };
type Supplier = { id: string; name: string };

// Два счёта, которыми пользуются каждый день. Админ подтягивает полный список
// из iiko, всем остальным доступны только эти — как в легаси.
const COMMON_ACCOUNTS: Account[] = [
  { id: '0ca10c4d-e132-4348-a711-1380af66ee52', name: 'Доставка продуктов', code: '' },
  { id: 'd07478d5-c4e8-4618-b40d-23cbbce41a18', name: 'Автомобильные расходы', code: '' },
];
const SUPPLIER_DEFAULT = { id: 'f94a2411-4e2a-4d0a-a3c5-f5a4d4e0042d', name: 'Представительские' };

export function ServicesClient({ isAdmin, fixedStoreId }: { isAdmin: boolean; fixedStoreId: string | null }) {
  const [storeId, setStoreId] = useState(fixedStoreId || '');
  const [storeName, setStoreName] = useState('');
  const [sum, setSum] = useState('');
  const [comment, setComment] = useState('');
  const [accounts, setAccounts] = useState<Account[]>(COMMON_ACCOUNTS);
  const [accountId, setAccountId] = useState(COMMON_ACCOUNTS[0].id);
  const [services, setServices] = useState<{ id: string; name: string; code: string }[]>([]);
  const [productId, setProductId] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState(SUPPLIER_DEFAULT.id);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      try {
        const [accRes, supRes, svcRes] = await Promise.all([
          fetch('/api/iiko/accounts'),
          fetch('/api/iiko/suppliers'),
          fetch('/api/iiko/services/products'),
        ]);
        const svcJson = await svcRes.json().catch(() => ({ data: [] }));
        if (Array.isArray(svcJson.data) && svcJson.data.length > 0) {
          setServices(svcJson.data);
          setProductId((cur) => cur || svcJson.data[0].id);
        }
        const acc = await accRes.json();
        const sup = await supRes.json();
        if (Array.isArray(acc.data) && acc.data.length > 0) setAccounts(acc.data);
        setSuppliers(sup.suppliers || sup.data || []);
      } catch { /* остаются дефолты */ }
    })();
  }, [isAdmin]);

  const sumVal = parseFloat(sum) || 0;
  const canSend = !!storeId && !!accountId && !!productId && sumVal > 0;
  const accountName = accounts.find((a) => a.id === accountId)?.name || '';
  const productName = services.find((p) => p.id === productId)?.name || '';
  const supplierName = suppliers.find((s) => s.id === supplierId)?.name || SUPPLIER_DEFAULT.name;

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/iiko/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: storeId, store_name: storeName,
          supplier_id: supplierId, supplier_name: supplierName,
          account_id: accountId, account_name: accountName,
          product_id: productId, product_name: productName,
          sum: sumVal, comment,
        }),
      });
      const data = await res.json();
      if (!res.ok) setMsg({ ok: false, text: data.error || 'Ошибка' });
      else {
        setMsg({ ok: true, text: 'Акт услуги проведён в iiko' });
        setSum('');
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
          <StoreSelect label="Склад" value={storeId} onChange={(id, name) => { setStoreId(id); setStoreName(name); }} />
        </section>
      )}

      <section className="card">
        <div className="card__title"><span className="card__title-text">🧾 Услуга</span></div>
        <div className="field">
          <label className="field__label">Услуга</label>
          <select className="select" value={productId} onChange={(e) => setProductId(e.target.value)}>
            {services.length === 0 && <option value="">Загрузка…</option>}
            {services.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <div className="field">
          <label className="field__label">Счёт затрат</label>
          <select className="select" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        {isAdmin && suppliers.length > 0 && (
          <div className="field">
            <label className="field__label">Контрагент</label>
            <select className="select" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value={SUPPLIER_DEFAULT.id}>{SUPPLIER_DEFAULT.name}</option>
              {suppliers.filter((s) => s.id !== SUPPLIER_DEFAULT.id).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
        <div className="field">
          <label className="field__label">Сумма</label>
          <input type="number" inputMode="decimal" className="input input--number" value={sum} onChange={(e) => setSum(e.target.value)} placeholder="0" />
        </div>
        <div className="field">
          <label className="field__label">Комментарий</label>
          <textarea className="textarea" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="за что платим" />
        </div>
      </section>

      <div className="action-bar">
        {msg && <div className={`banner ${msg.ok ? 'banner--success' : 'banner--error'}`} style={{ flex: 1 }}>{msg.text}</div>}
        <button type="button" className="btn btn--primary action-bar__btn" onClick={submit} disabled={!canSend || busy}>
          {busy ? 'Проведение…' : 'Провести услугу'}
        </button>
      </div>
    </div>
  );
}
