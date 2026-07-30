'use client';

import { useEffect, useMemo, useState } from 'react';
import { StoreSelect } from '@/components/store-select';
import { SupplierSelect } from '@/components/supplier-select';

type Product = { id: string; name: string; num: string; mainUnit: string };
type InvoiceItem = { product_id: string; product_name: string; unit: string; quantity: number; price: number };

export function InvoiceClient() {
  const [text, setText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<InvoiceItem[]>([]);

  const [supplierId, setSupplierId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [storeId, setStoreId] = useState('');
  const [storeName, setStoreName] = useState('');
  const [comment, setComment] = useState('');

  const [addQuery, setAddQuery] = useState('');
  const [fixQuery, setFixQuery] = useState<Record<number, string>>({});

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/iiko/products');
        const data = await res.json();
        setProducts(data.products || []);
      } catch {
        // ignore — только используется для ручного добавления/исправления строк
      }
    })();
  }, []);

  const totalSum = useMemo(() => items.reduce((s, it) => s + it.quantity * it.price, 0), [items]);

  const canSend =
    Boolean(supplierId) &&
    Boolean(storeId) &&
    items.length > 0 &&
    items.every((it) => it.product_id && it.quantity > 0);

  async function parse() {
    if (!text.trim()) return;
    setParsing(true);
    setParseError(null);
    try {
      const res = await fetch('/api/iiko/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setParseError(data.error || 'Ошибка распознавания');
        return;
      }
      const parsed: InvoiceItem[] = (data.items || []).map((it: { product_id?: string; product_name?: string; unit?: string; quantity?: number; price?: number }) => ({
        product_id: it.product_id || '',
        product_name: it.product_name || '',
        unit: it.unit || 'шт',
        quantity: Number(it.quantity) || 0,
        price: Number(it.price) || 0,
      }));
      setItems(parsed);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'Ошибка сети');
    } finally {
      setParsing(false);
    }
  }

  function updateItem(i: number, patch: Partial<InvoiceItem>) {
    setItems((prev) => prev.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  }
  function removeItem(i: number) {
    setItems((prev) => prev.filter((_, j) => j !== i));
  }
  function addProduct(p: Product) {
    setItems((prev) => [...prev, { product_id: p.id, product_name: p.name, unit: p.mainUnit, quantity: 0, price: 0 }]);
    setAddQuery('');
  }
  function fixProduct(i: number, p: Product) {
    updateItem(i, { product_id: p.id, product_name: p.name, unit: p.mainUnit });
    setFixQuery((prev) => ({ ...prev, [i]: '' }));
  }

  // Один товар намеренно можно добавить несколько раз: в накладной он часто
  // идёт разными строками по разной цене или из разных партий.
  const addResults = useMemo(() => {
    const q = addQuery.trim().toLowerCase();
    if (!q) return [];
    return products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8);
  }, [addQuery, products]);

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/iiko/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: supplierId,
          supplier_name: supplierName,
          store_id: storeId,
          store_name: storeName,
          items,
          comment,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setMsg({ ok: false, text: data.error || 'Ошибка' });
      } else {
        setMsg({ ok: true, text: `Создан документ ${data.documentNumber}` });
        setItems([]);
        setText('');
        setComment('');
      }
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Ошибка сети' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid">
      <section className="card">
        <div className="card__title"><span className="card__title-text">🗣️ Текст накладной</span></div>
        <div className="field">
          <label className="field__label">Вставь или продиктуй текст</label>
          <textarea
            className="textarea"
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'помидоры 50кг 600000\nлук 30 кг 150000'}
          />
        </div>
        {parseError && <div className="banner banner--error">{parseError}</div>}
        <div className="action-bar">
          <button type="button" className="btn btn--primary" onClick={parse} disabled={parsing || !text.trim()}>
            {parsing ? 'Распознаём…' : 'Распознать'}
          </button>
        </div>
      </section>

      <section className="card">
        <div className="card__title"><span className="card__title-text">🚚 Поставщик и склад</span></div>
        <div className="grid grid--2">
          <SupplierSelect value={supplierId} onChange={(id, name) => { setSupplierId(id); setSupplierName(name); }} />
          <StoreSelect label="Склад" value={storeId} onChange={(id, name) => { setStoreId(id); setStoreName(name); }} />
        </div>
      </section>

      <section className="card">
        <div className="card__title"><span className="card__title-text">📦 Позиции</span></div>

        {items.length > 0 && (
          <div className="card" style={{ padding: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left' }}>Товар</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', width: 110 }}>Кол-во</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', width: 130 }}>Цена</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', width: 130 }}>Сумма</th>
                  <th style={{ padding: '10px 12px', width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 12px' }}>
                      {it.product_id ? (
                        <>
                          {it.product_name}
                          <span style={{ color: 'var(--text-faint)', fontSize: 11, marginLeft: 8 }}>{it.unit}</span>
                        </>
                      ) : (
                        <div>
                          <div className="banner banner--warn" style={{ marginBottom: 6, padding: '4px 8px', fontSize: 12 }}>
                            Не найден в iiko: «{it.product_name || '—'}» — выбери вручную
                          </div>
                          <input
                            className="input input--inline"
                            placeholder="Поиск товара…"
                            value={fixQuery[i] || ''}
                            onChange={(e) => setFixQuery((prev) => ({ ...prev, [i]: e.target.value }))}
                          />
                          {(fixQuery[i] || '').trim() && (
                            <div style={{ marginTop: 4, border: '1px solid var(--border)', borderRadius: 8, maxHeight: 180, overflowY: 'auto' }}>
                              {products
                                .filter((p) => p.name.toLowerCase().includes((fixQuery[i] || '').toLowerCase()))
                                .slice(0, 8)
                                .map((p) => (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => fixProduct(i, p)}
                                    style={{ width: '100%', textAlign: 'left', padding: '6px 10px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', fontSize: 12 }}
                                  >
                                    {p.name}
                                  </button>
                                ))}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.001"
                        className="input input--inline input--number"
                        value={it.quantity || ''}
                        onChange={(e) => updateItem(i, { quantity: parseFloat(e.target.value) || 0 })}
                        placeholder="0"
                      />
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="1"
                        className="input input--inline input--number"
                        value={it.price || ''}
                        onChange={(e) => updateItem(i, { price: parseFloat(e.target.value) || 0 })}
                        placeholder="0"
                      />
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                      {(it.quantity * it.price).toLocaleString('ru-RU')}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <button type="button" className="btn btn--danger btn--icon" onClick={() => removeItem(i)}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '1px solid var(--border)', fontWeight: 600 }}>
                  <td style={{ padding: '10px 12px' }} colSpan={3}>Итого</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>{totalSum.toLocaleString('ru-RU')}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <div className="field">
          <label className="field__label">Добавить товар вручную</label>
          <input
            className="input"
            placeholder="Название товара"
            value={addQuery}
            onChange={(e) => setAddQuery(e.target.value)}
          />
          {addResults.length > 0 && (
            <div style={{ marginTop: 8, border: '1px solid var(--border)', borderRadius: 8, maxHeight: 200, overflowY: 'auto' }}>
              {addResults.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addProduct(p)}
                  style={{ width: '100%', textAlign: 'left', padding: '8px 12px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', fontSize: 13 }}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="card">
        <div className="field">
          <label className="field__label">Комментарий</label>
          <textarea className="textarea" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="опционально" />
        </div>
      </section>

      <div className="action-bar">
        {msg && <div className={`banner ${msg.ok ? 'banner--success' : 'banner--error'}`} style={{ flex: 1 }}>{msg.text}</div>}
        <button type="button" className="btn btn--primary" onClick={submit} disabled={!canSend || busy}>
          {busy ? 'Создание…' : 'Создать приход'}
        </button>
      </div>
    </div>
  );
}
