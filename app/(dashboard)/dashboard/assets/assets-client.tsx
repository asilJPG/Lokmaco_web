'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Asset } from '@/db/schema';
import { AssetFormModal, InventoryScanModal, QrStickerModal, STATUS, CATEGORIES, emptyForm, toForm, type AssetForm } from './asset-modals';

const money = (n: number) => Math.round(n).toLocaleString('ru-RU');

const th: React.CSSProperties = { padding: '10px 8px', textAlign: 'left', borderBottom: '1px solid var(--border)', fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '8px', borderBottom: '1px solid var(--border)', fontSize: 13 };

export function AssetsClient() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [syncing, setSyncing] = useState(false);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('all');

  const [editing, setEditing] = useState<AssetForm | null>(null);
  const [qrAsset, setQrAsset] = useState<Asset | null>(null);
  const [scanOpen, setScanOpen] = useState(false);

  async function load() {
    try {
      const res = await fetch('/api/assets');
      const json = await res.json();
      setAssets(json.data || []);
    } catch {
      setMsg({ ok: false, text: 'Не удалось загрузить опись' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assets.filter((a) => {
      if (category !== 'all' && a.category !== category) return false;
      if (status !== 'all' && a.status !== status) return false;
      if (!q) return true;
      return [a.name, a.invNumber, a.responsiblePerson, a.location].some((v) => (v || '').toLowerCase().includes(q));
    });
  }, [assets, search, category, status]);

  const totalCost = filtered.reduce((s, a) => s + (Number(a.initialCost) || 0), 0);
  const neverAudited = filtered.filter((a) => !a.lastInventoriedAt).length;

  async function save(form: AssetForm) {
    const res = await fetch('/api/assets', {
      method: form.id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (!res.ok) return setMsg({ ok: false, text: json.error || 'Ошибка сохранения' });
    setMsg({ ok: true, text: form.id ? 'Данные обновлены' : 'Оборудование добавлено' });
    setEditing(null);
    await load();
  }

  async function remove(a: Asset) {
    if (!confirm(`Удалить «${a.name}» из описи?`)) return;
    const res = await fetch(`/api/assets?id=${a.id}`, { method: 'DELETE' });
    if (!res.ok) return setMsg({ ok: false, text: 'Ошибка при удалении' });
    setMsg({ ok: true, text: 'Запись удалена' });
    await load();
  }

  async function audit(ids: string[]) {
    for (const id of ids) {
      await fetch('/api/assets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'audit' }),
      });
    }
    setScanOpen(false);
    setMsg({ ok: true, text: `Отмечено при инвентаризации: ${ids.length} шт.` });
    await load();
  }

  async function sync() {
    setSyncing(true);
    setMsg(null);
    try {
      const res = await fetch('/api/assets/sync', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) setMsg({ ok: false, text: json.error || 'Ошибка синхронизации' });
      else {
        setMsg({ ok: true, text: json.message });
        await load();
      }
    } finally {
      setSyncing(false);
    }
  }

  function exportCsv() {
    const rows: string[][] = [[
      'Инв. №', 'Наименование', 'Категория', 'Дата прихода', 'Первоначальная стоимость',
      'Количество', 'Локация', 'МОЛ', 'Серийный код', 'Статус', 'Последняя инвентаризация',
    ]];
    for (const a of filtered) {
      rows.push([
        a.invNumber || '', a.name || '', a.category || '', a.commissioningDate || '',
        String(a.initialCost ?? ''), String(a.quantity ?? ''), a.location || '', a.responsiblePerson || '',
        a.serialNumber || '', a.status || '',
        a.lastInventoriedAt ? new Date(a.lastInventoriedAt).toLocaleDateString('ru-RU') : '',
      ]);
    }
    const esc = (v: string) => (/[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const csv = '﻿' + rows.map((r) => r.map(esc).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `опись-ос-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  if (loading) return <div className="card"><div className="empty-state">Загрузка…</div></div>;

  return (
    <div className="grid">
      {msg && <div className={`banner ${msg.ok ? 'banner--success' : 'banner--error'}`}>{msg.text}</div>}

      <div className="stat-grid">
        <div className="stat-card"><div className="stat-card__label">📦 Объектов</div><div className="stat-card__value">{filtered.length}</div></div>
        <div className="stat-card"><div className="stat-card__label">💰 Стоимость</div><div className="stat-card__value">{money(totalCost)}</div></div>
        <div className="stat-card"><div className="stat-card__label">❔ Ни разу не сверяли</div><div className="stat-card__value" style={{ color: neverAudited ? 'var(--warning)' : undefined }}>{neverAudited}</div></div>
      </div>

      <div className="action-bar" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flex: 1 }}>
          <input className="input input--inline" placeholder="Поиск по названию, номеру, МОЛ…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 220 }} />
          <select className="select" value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: 'auto' }}>
            <option value="all">Все категории</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 'auto' }}>
            <option value="all">Все статусы</option>
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn--sm" onClick={() => setScanOpen(true)}>📷 Инвентаризация</button>
          <button type="button" className="btn btn--sm" onClick={exportCsv}>📥 CSV</button>
          <button type="button" className="btn btn--sm" onClick={sync} disabled={syncing}>{syncing ? 'Импорт…' : '🔄 Из iiko'}</button>
          <button type="button" className="btn btn--primary btn--sm" onClick={() => setEditing(emptyForm())}>➕ Добавить</button>
        </div>
      </div>

      <section className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div className="empty-state" style={{ padding: 40 }}>Ничего не найдено</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Инв. №</th>
                  <th style={th}>Наименование</th>
                  <th style={th}>Категория</th>
                  <th style={th}>Локация</th>
                  <th style={th}>МОЛ</th>
                  <th style={{ ...th, textAlign: 'right' }}>Кол-во</th>
                  <th style={{ ...th, textAlign: 'right' }}>Стоимость</th>
                  <th style={th}>Статус</th>
                  <th style={th}>Сверка</th>
                  <th style={th} />
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => {
                  const st = STATUS[a.status || 'in_use'] || STATUS.in_use;
                  return (
                    <tr key={a.id}>
                      <td style={{ ...td, fontFamily: 'monospace', fontWeight: 600 }}>{a.invNumber}</td>
                      <td style={td}>{a.name}</td>
                      <td style={{ ...td, color: 'var(--text-muted)' }}>{a.category}</td>
                      <td style={{ ...td, color: 'var(--text-muted)' }}>{a.location}</td>
                      <td style={{ ...td, color: 'var(--text-muted)' }}>{a.responsiblePerson}</td>
                      <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{a.quantity}</td>
                      <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{money(Number(a.initialCost) || 0)}</td>
                      <td style={{ ...td, color: st.color, fontWeight: 600, whiteSpace: 'nowrap' }}>{st.label}</td>
                      <td style={{ ...td, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {a.lastInventoriedAt ? new Date(a.lastInventoriedAt).toLocaleDateString('ru-RU') : '—'}
                      </td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>
                        <button type="button" className="btn btn--sm" onClick={() => setQrAsset(a)} title="Стикер">🏷</button>{' '}
                        <button type="button" className="btn btn--sm" onClick={() => setEditing(toForm(a))} title="Изменить">✎</button>{' '}
                        <button type="button" className="btn btn--sm btn--danger" onClick={() => remove(a)} title="Удалить">✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editing && <AssetFormModal initial={editing} onSave={save} onClose={() => setEditing(null)} />}
      {qrAsset && <QrStickerModal asset={qrAsset} onClose={() => setQrAsset(null)} />}
      {scanOpen && <InventoryScanModal assets={assets} onFinish={audit} onClose={() => setScanOpen(false)} />}
    </div>
  );
}
