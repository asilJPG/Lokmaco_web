'use client';

import { Fragment, useEffect, useState } from 'react';
import { fmtDate } from '@/lib/period';
import { Copyable } from '@/components/copy-button';

type Doc = {
  id?: string;
  documentNumber?: string;
  type?: string;
  status?: string;
  dateIncoming?: string;
  storage?: string;
  storageFrom?: string;
  storageTo?: string;
  sum?: number;
  comment?: string;
};

type DocItem = {
  product?: { name?: string } | string;
  productName?: string;
  name?: string;
  amount?: number;
  amountUnit?: string;
  price?: number;
  sum?: number;
  cost?: number;
};

function itemName(it: DocItem): string {
  if (typeof it.product === 'string') return it.product;
  if (it.product && typeof it.product === 'object' && it.product.name) return it.product.name;
  return it.productName || it.name || '—';
}

function extractItems(data: unknown): DocItem[] {
  if (!data || typeof data !== 'object') return [];
  const d = data as Record<string, unknown>;
  const candidates = [d.items, d.data, (d.data as Record<string, unknown> | undefined)?.items];
  for (const c of candidates) {
    if (Array.isArray(c)) return c as DocItem[];
  }
  return [];
}

function today(offset = 0) {
  return new Date(Date.now() + 5 * 3600_000 + offset * 86400_000).toISOString().slice(0, 10);
}

const TYPE_LABEL: Record<string, string> = {
  INTERNAL_TRANSFER: '🔄 Перемещение',
  INCOMING_INVOICE: '📥 Приход',
  OUTGOING_INVOICE: '📤 Расход',
  INVENTORY: '📋 Инвентаризация',
  PRODUCTION_DOCUMENT: '🍳 Производство',
  WASTE_DOCUMENT: '🗑 Списание',
  RETURNED_INVOICE: '↩️ Возврат',
};

const PAGE_SIZE = 100;

export function DocumentsClient() {
  const [from, setFrom] = useState(today(-30));
  const [to, setTo] = useState(today(1));
  const [filter, setFilter] = useState<string>('');
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailCache, setDetailCache] = useState<Record<string, DocItem[] | 'loading' | 'error'>>({});

  async function toggleDetail(d: Doc) {
    const key = d.id || '';
    if (!key || !d.type) return;
    if (expandedId === key) {
      setExpandedId(null);
      return;
    }
    setExpandedId(key);
    if (detailCache[key]) return;
    setDetailCache((c) => ({ ...c, [key]: 'loading' }));
    try {
      const res = await fetch(`/api/iiko/documents/detail?id=${encodeURIComponent(key)}&type=${encodeURIComponent(d.type)}`);
      const json = await res.json();
      if (json.error) {
        setDetailCache((c) => ({ ...c, [key]: 'error' }));
      } else {
        setDetailCache((c) => ({ ...c, [key]: extractItems(json.data) }));
      }
    } catch {
      setDetailCache((c) => ({ ...c, [key]: 'error' }));
    }
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/iiko/documents?dateFrom=${from}&dateTo=${to}`);
      const data = await res.json();
      setDocs(data.documents || []);
      if (data.error) setError(data.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'fetch failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); setPage(1); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [from, to]);
  useEffect(() => { setPage(1); }, [filter]);

  const types = Array.from(new Set(docs.map((d) => d.type).filter((t): t is string => !!t)));
  const filtered = filter ? docs.filter((d) => d.type === filter) : docs;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageStart = (page - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  return (
    <div className="grid">
      <section className="card">
        <div className="card__title">
          <span className="card__title-text">🗓 Фильтр</span>
          <button
            type="button"
            className="btn btn--sm"
            disabled={filtered.length === 0}
            onClick={() => {
              const cell = (v: unknown) => { const s = v == null ? '' : String(v); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
              const lines = ['Дата;Документ;Тип;Статус;Сумма;Комментарий'];
              for (const d of filtered) {
                lines.push([(d.dateIncoming || '').slice(0, 10), d.documentNumber || '', d.type || '', d.status || '', d.sum || 0, d.comment || ''].map(cell).join(';'));
              }
              const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = `documents_${from}_${to}${filter ? '_' + filter : ''}.csv`;
              a.click();
              URL.revokeObjectURL(a.href);
            }}
          >
            ⬇ CSV
          </button>
        </div>
        <div className="grid grid--2">
          <div className="field">
            <label className="field__label">С</label>
            <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="field">
            <label className="field__label">По</label>
            <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        {types.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
            <button type="button" className={`btn btn--sm ${!filter ? 'btn--primary' : ''}`} onClick={() => setFilter('')}>Все ({docs.length})</button>
            {types.map((t) => (
              <button key={t} type="button" className={`btn btn--sm ${filter === t ? 'btn--primary' : ''}`} onClick={() => setFilter(t)}>
                {TYPE_LABEL[t] || t} ({docs.filter((d) => d.type === t).length})
              </button>
            ))}
          </div>
        )}
      </section>

      {error && <div className="banner banner--warn">iiko: {error}</div>}

      <section className="card">
        {loading ? (
          <div className="empty-state">Загрузка…</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">Документов нет</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase' }}>
                  <th style={{ padding: '10px 8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Дата</th>
                  <th style={{ padding: '10px 8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Номер</th>
                  <th style={{ padding: '10px 8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Тип</th>
                  <th style={{ padding: '10px 8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Статус</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Сумма</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((d, i) => {
                  const key = d.id || String(i);
                  const isOpen = expandedId === key;
                  const detail = detailCache[key];
                  return (
                    <Fragment key={key}>
                      <tr
                        onClick={() => toggleDetail(d)}
                        style={{ cursor: d.id && d.type ? 'pointer' : 'default', background: isOpen ? 'var(--surface-muted)' : undefined }}
                      >
                        <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>{d.dateIncoming ? fmtDate(d.dateIncoming.slice(0, 10)) : '—'}</td>
                        <td style={{ padding: '8px', borderBottom: '1px solid var(--border)', fontFamily: 'monospace', fontSize: 12 }}><Copyable value={d.documentNumber || ''} /></td>
                        <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>{TYPE_LABEL[d.type || ''] || d.type || '—'}</td>
                        <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>{(() => { const s = d.status || ''; const style = s === 'PROCESSED' ? { bg: '#dcfce7', fg: '#166534' } : s === 'DRAFT' ? { bg: '#f1f5f9', fg: '#475569' } : s.includes('REJECT') ? { bg: '#fee2e2', fg: '#991b1b' } : { bg: '#fef3c7', fg: '#92400e' }; return s ? <span style={{ background: style.bg, color: style.fg, padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{s}</span> : '—'; })()}</td>
                        <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid var(--border)', fontVariantNumeric: 'tabular-nums' }}>{d.sum ? d.sum.toLocaleString('ru-RU') : '—'}</td>
                      </tr>
                      {isOpen && (
                        <tr key={`${key}-detail`}>
                          <td colSpan={5} style={{ padding: 0, borderBottom: '1px solid var(--border)', background: 'var(--surface-muted)' }}>
                            <div style={{ padding: '10px 16px' }}>
                              {detail === 'loading' && <div className="empty-state" style={{ padding: 8 }}>Загрузка состава…</div>}
                              {detail === 'error' && <div className="banner banner--warn">Не удалось загрузить состав документа</div>}
                              {Array.isArray(detail) && detail.length === 0 && <div className="empty-state" style={{ padding: 8 }}>Состав документа пуст</div>}
                              {Array.isArray(detail) && detail.length > 0 && (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                  <thead>
                                    <tr style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase' }}>
                                      <th style={{ padding: '6px 8px', textAlign: 'left' }}>Позиция</th>
                                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>Кол-во</th>
                                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>Цена</th>
                                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>Сумма</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {detail.map((it, idx) => (
                                      <tr key={idx} style={{ borderTop: '1px solid var(--border)' }}>
                                        <td style={{ padding: '6px 8px' }}>{itemName(it)}</td>
                                        <td style={{ padding: '6px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{it.amount != null ? it.amount.toLocaleString('ru-RU') : '—'}{it.amountUnit ? ` ${it.amountUnit}` : ''}</td>
                                        <td style={{ padding: '6px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{it.price != null ? it.price.toLocaleString('ru-RU') : '—'}</td>
                                        <td style={{ padding: '6px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{(it.sum ?? it.cost) != null ? ((it.sum ?? it.cost) as number).toLocaleString('ru-RU') : '—'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 4px 0', borderTop: '1px solid var(--border)', marginTop: 8 }}>
            <button type="button" className="btn btn--sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>← Назад</button>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filtered.length)} из {filtered.length} · стр. {page}/{totalPages}</span>
            <button type="button" className="btn btn--sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Дальше →</button>
          </div>
        )}
      </section>
    </div>
  );
}
