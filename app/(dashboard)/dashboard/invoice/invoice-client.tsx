'use client';

import { useEffect, useMemo, useState } from 'react';
import { InvoicePhotos, ItemPhoto, type Photo } from './photo-input';
import { StoreSelect } from '@/components/store-select';
import { SupplierSelect } from '@/components/supplier-select';

type Product = { id: string; name: string; num: string; mainUnit: string };
type InvoiceItem = {
  product_id: string; product_name: string; unit: string; quantity: number; price: number;
  /** Снимок этой позиции — доказательство, что товар действительно привезли. */
  photo?: Photo | null;
  /** Как позиция написана в накладной, если приход распознан из текста. */
  as_written?: string;
  /** «5 коробка × 24 = 120 шт» — как упаковки пересчитали в основную единицу. */
  pack_note?: string;
  /** Модель выбрала товар, отличающийся от написанного — строку надо перепроверить. */
  needs_review?: boolean;
};

/**
 * Оформление прихода.
 *
 * ⚠️ Распознавание с фотографии и надиктовка **сняты** (13.08.2026, по просьбе
 * Асиля): модель подставляла позиции уверенно и иногда неверно, а приход — это
 * остатки и себестоимость. Позиции набираются руками. Код разбора текста,
 * фото и голоса остался в репозитории (`voice-input.tsx`, `scan-inbox.tsx`,
 * `/api/iiko/parse-photo`) — вернуть можно правкой этого файла.
 *
 * Взамен доказательство перенесено на фотографии: снимок накладной обязателен,
 * у каждой позиции своя кнопка «фото товара», и всё это уходит в Telegram
 * сразу после проведения.
 */
export function InvoiceClient() {
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<InvoiceItem[]>([]);

  const [supplierId, setSupplierId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [storeId, setStoreId] = useState('');
  const [storeName, setStoreName] = useState('');
  const [comment, setComment] = useState('');

  const [addQuery, setAddQuery] = useState('');

  const [invoicePhotos, setInvoicePhotos] = useState<Photo[]>([]);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/iiko/products');
        const data = await res.json();
        setProducts(data.products || []);
      } catch {
        // ignore — список нужен только для подбора товара в форме
      }
    })();
  }, []);

  const totalSum = useMemo(() => items.reduce((s, it) => s + it.quantity * it.price, 0), [items]);

  const itemsWithoutPhoto = useMemo(() => items.filter((it) => !it.photo), [items]);

  const canSend =
    Boolean(supplierId) &&
    Boolean(storeId) &&
    items.length > 0 &&
    items.every((it) => it.product_id && it.quantity > 0) &&
    invoicePhotos.length > 0;

  function updateItem(i: number, patch: Partial<InvoiceItem>) {
    setItems((prev) => prev.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  }
  function removeItem(i: number) {
    setItems((prev) => prev.filter((_, j) => j !== i));
  }
  function addProduct(p: Product) {
    setItems((prev) => [...prev, { product_id: p.id, product_name: p.name, unit: p.mainUnit, quantity: 0, price: 0, photo: null }]);
    setAddQuery('');
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
      const photos = [
        ...invoicePhotos.map((p) => ({ path: p.path, kind: 'invoice' as const })),
        ...items.flatMap((it) => (it.photo
          ? [{ path: it.photo.path, kind: 'item' as const, product_id: it.product_id, product_name: it.product_name }]
          : [])),
      ];

      const res = await fetch('/api/iiko/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: supplierId,
          supplier_name: supplierName,
          store_id: storeId,
          store_name: storeName,
          items: items.map(({ photo: _photo, ...it }) => it),
          comment,
          photos,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setMsg({ ok: false, text: data.error || `Ошибка ${res.status}` });
      } else {
        setMsg({
          ok: true,
          text: data.tg_sent
            ? `Создан документ ${data.documentNumber}. Фотоотчёт ушёл в Telegram.`
            : `Создан документ ${data.documentNumber}. ⚠️ Фотоотчёт в Telegram не ушёл — фотографии сохранены, отправятся со сводкой.`,
        });
        setItems([]);
        setComment('');
        setInvoicePhotos([]);
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
        <div className="card__title"><span className="card__title-text">🚚 Поставщик и склад</span></div>
        <div className="grid grid--2">
          <SupplierSelect value={supplierId} onChange={(id, name) => { setSupplierId(id); setSupplierName(name); }} />
          <StoreSelect label="Склад" value={storeId} onChange={(id, name) => { setStoreId(id); setStoreName(name); }} />
        </div>
      </section>

      <section className="card">
        <div className="card__title"><span className="card__title-text">📄 Накладная поставщика</span></div>
        <InvoicePhotos photos={invoicePhotos} onChange={setInvoicePhotos} disabled={busy} />
        {invoicePhotos.length === 0 && (
          <div className="banner banner--warn" style={{ marginTop: 10 }}>
            Без снимка накладной приход не проводится. Снимите лист целиком, чтобы читались позиции и суммы.
          </div>
        )}
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
                      {it.product_name}
                      <span style={{ color: 'var(--text-faint)', fontSize: 11, marginLeft: 8 }}>{it.unit}</span>
                      <ItemPhoto
                        photo={it.photo || null}
                        onChange={(p) => updateItem(i, { photo: p })}
                        disabled={busy}
                      />
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
          <label className="field__label">Добавить товар</label>
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

        {items.length > 0 && itemsWithoutPhoto.length > 0 && (
          <div className="banner banner--warn" style={{ marginTop: 12 }}>
            Приход пройдёт и так, но в отчёте будет видно, что фото нет:{' '}
            {itemsWithoutPhoto.map((it) => it.product_name).join(', ')}
          </div>
        )}
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
