'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Asset } from '@/db/schema';
import { AssetFormModal, QrStickerModal, STATUS, CATEGORIES, emptyForm, toForm, type AssetForm } from './asset-modals';
import { InventoryScanModal } from './inventory-scan';
import { TagsModal } from './tags-modal';
import { AuditsModal } from './audits-modal';
import { baseInvNumber, unitLabel } from '@/lib/inv-number';
import type { AssetLocation, AssetTag } from '@/db/schema';

const money = (n: number) => Math.round(n).toLocaleString('ru-RU');

const th: React.CSSProperties = { padding: '10px 8px', textAlign: 'left', borderBottom: '1px solid var(--border)', fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '8px', borderBottom: '1px solid var(--border)', fontSize: 13 };

export function AssetsClient() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [tags, setTags] = useState<AssetTag[]>([]);
  const [locations, setLocations] = useState<AssetLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [syncing, setSyncing] = useState(false);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('all');
  const [place, setPlace] = useState('all');

  const [editing, setEditing] = useState<AssetForm | null>(null);
  const [qrAsset, setQrAsset] = useState<Asset | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [auditsOpen, setAuditsOpen] = useState(false);
  const [splitting, setSplitting] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch('/api/assets');
      const json = await res.json();
      setAssets(json.data || []);
      setTags(json.tags || []);
      setLocations(json.locations || []);
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
      if (place !== 'all' && a.locationId !== place) return false;
      if (status !== 'all' && a.status !== status) return false;
      if (!q) return true;
      return [a.name, a.invNumber, a.responsiblePerson, a.location].some((v) => (v || '').toLowerCase().includes(q));
    });
  }, [assets, search, category, status, place]);

  // Наклейка в строке нужна, чтобы найти предмет глазами: инв. номер написан
  // в учёте, а на самом холодильнике наклеено «LKM-0021».
  const tagByAsset = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of tags) if (t.assetId) m.set(t.assetId, t.code);
    return m;
  }, [tags]);

  /**
   * Разбитая партия — одна строка списка.
   *
   * Четыре одинаковых стола на складе учитываются поштучно (иначе не понять,
   * какой пропал), но в списке это один вид, а не четыре позиции. Ключ —
   * базовый инв. номер плюс название, чтобы разные виды с похожей нумерацией
   * не слиплись.
   */
  const groups = useMemo(() => {
    const map = new Map<string, { key: string; name: string; units: Asset[] }>();
    for (const a of filtered) {
      const key = `${baseInvNumber(a.invNumber)}|${a.name}`;
      if (!map.has(key)) map.set(key, { key, name: a.name, units: [] });
      map.get(key)!.units.push(a);
    }
    return Array.from(map.values()).map((g) => {
      g.units.sort((x, y) => String(x.invNumber).localeCompare(String(y.invNumber)));
      // «Отсканировано» — по последней дате обхода в этой партии: экземпляры с
      // той же датой попали в последний обход, остальные пропущены.
      const days = g.units.map((u) => (u.lastInventoriedAt ? new Date(u.lastInventoriedAt).toISOString().slice(0, 10) : '')).filter(Boolean);
      const lastDay = days.sort().slice(-1)[0] || null;
      return {
        ...g,
        head: g.units[0],
        total: g.units.length,
        lastDay,
        scanned: lastDay ? g.units.filter((u) => u.lastInventoriedAt && new Date(u.lastInventoriedAt).toISOString().slice(0, 10) === lastDay).length : 0,
        cost: g.units.reduce((s, u) => s + (Number(u.initialCost) || 0), 0),
      };
    });
  }, [filtered]);

  /** Позиции, которые ещё лежат одной карточкой на несколько штук. */
  const splittable = useMemo(() => assets.filter((a) => (a.quantity || 1) > 1 && baseInvNumber(a.invNumber) === a.invNumber), [assets]);

  async function split(a: Asset) {
    if (!confirm(`Разбить «${a.name}» на ${a.quantity} экземпляров? У каждого будет своя наклейка. Обратно не схлопнуть.`)) return;
    const res = await fetch('/api/assets/split', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: a.id }),
    });
    const json = await res.json();
    setMsg({ ok: res.ok, text: res.ok ? json.message : json.error || 'Не удалось разбить' });
    await load();
  }

  /** Развернуть все партии разом: по одной их щёлкать — на час работы. */
  async function splitAll() {
    if (!confirm(`Развернуть ${splittable.length} партий на ${splittable.reduce((n, a) => n + (a.quantity || 1), 0)} карточек? Обратно не схлопнуть.`)) return;
    setSplitting(true);
    let done = 0;
    try {
      for (const a of splittable) {
        const res = await fetch('/api/assets/split', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: a.id }),
        });
        if (res.ok) done++;
      }
      setMsg({ ok: true, text: `Развёрнуто партий: ${done} из ${splittable.length}` });
      await load();
    } finally {
      setSplitting(false);
    }
  }

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

  /**
   * Закрытие обхода. Одним запросом: и отметки в карточках, и сам акт —
   * ненайденное сервер считает сам, чтобы список не зависел от того, что
   * успело подгрузиться в телефон.
   */
  async function audit(auditId: string, ids: string[]) {
    const res = await fetch('/api/assets/audits', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: auditId, scanned: ids }),
    });
    const json = await res.json().catch(() => ({}));
    setScanOpen(false);
    if (!res.ok) {
      setMsg({ ok: false, text: json.error || 'Не удалось закрыть обход' });
      return;
    }
    setMsg({
      ok: json.missing === 0,
      text: json.missing === 0
        ? `Обход закрыт: всё на месте, ${json.scanned} шт.`
        : `Обход закрыт: нашли ${json.scanned}, не нашли ${json.missing} — список в истории обходов.`,
    });
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
          {locations.length > 0 && (
            <select className="select" value={place} onChange={(e) => setPlace(e.target.value)} style={{ width: 'auto' }}>
              <option value="all">Все места</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          )}
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 'auto' }}>
            <option value="all">Все статусы</option>
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn--sm" onClick={() => setScanOpen(true)}>📷 Инвентаризация</button>
          <button type="button" className="btn btn--sm" onClick={() => setTagsOpen(true)}>🏷 Наклейки</button>
          <button type="button" className="btn btn--sm" onClick={() => setAuditsOpen(true)}>📋 Обходы</button>
          {splittable.length > 0 && (
            <button type="button" className="btn btn--sm" onClick={splitAll} disabled={splitting}>
              {splitting ? 'Разбиваю…' : `✂️ Развернуть партии (${splittable.length})`}
            </button>
          )}
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
                {groups.map((g) => {
                  const a = g.head;
                  const st = STATUS[a.status || 'in_use'] || STATUS.in_use;
                  const batch = g.total > 1;
                  const open = openGroup === g.key;
                  return (
                    <tr key={g.key} style={{ verticalAlign: 'top' }}>
                      <td style={{ ...td, fontFamily: 'monospace', fontWeight: 600 }}>
                        {batch ? baseInvNumber(a.invNumber) : a.invNumber}
                        {!batch && tagByAsset.get(a.id) && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>🏷 {tagByAsset.get(a.id)}</div>
                        )}
                        {batch && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {g.units.filter((u) => tagByAsset.get(u.id)).length} из {g.total} с наклейкой
                          </div>
                        )}
                      </td>
                      <td style={td}>
                        {g.name}
                        {batch && (
                          <button type="button" className="btn btn--sm" style={{ marginLeft: 8 }} onClick={() => setOpenGroup(open ? null : g.key)}>
                            {open ? 'свернуть' : `${g.total} шт`}
                          </button>
                        )}
                        {open && (
                          /* Экземпляры партии: здесь и видно, какой именно
                             из четырёх столов не попал в последний обход. */
                          <div style={{ marginTop: 6 }}>
                            {g.units.map((u) => {
                              const seen = g.lastDay && u.lastInventoriedAt
                                && new Date(u.lastInventoriedAt).toISOString().slice(0, 10) === g.lastDay;
                              return (
                                <div key={u.id} style={{ fontSize: 12, padding: '3px 0', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center' }}>
                                  <b style={{ fontFamily: 'monospace' }}>{u.invNumber}</b>
                                  <span style={{ color: 'var(--text-muted)' }}>{unitLabel(u, assets)}</span>
                                  <span style={{ color: 'var(--text-muted)' }}>{tagByAsset.get(u.id) ? `🏷 ${tagByAsset.get(u.id)}` : 'без наклейки'}</span>
                                  <span style={{ marginLeft: 'auto', color: seen ? 'var(--success)' : 'var(--text-faint)' }}>
                                    {seen ? '✅ в последнем обходе' : '—'}
                                  </span>
                                  <button type="button" className="btn btn--sm" onClick={() => setEditing(toForm(u))}>✎</button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </td>
                      <td style={{ ...td, color: 'var(--text-muted)' }}>{a.category}</td>
                      <td style={{ ...td, color: 'var(--text-muted)' }}>
                        {(a.locationId && locations.find((l) => l.id === a.locationId)?.name) || a.location}
                      </td>
                      <td style={{ ...td, color: 'var(--text-muted)' }}>{a.responsiblePerson}</td>
                      <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {batch ? g.total : a.quantity}
                        {batch && g.lastDay && (
                          <div style={{ fontSize: 11, color: g.scanned === g.total ? 'var(--success)' : 'var(--warning)' }}>
                            обход: {g.scanned}/{g.total}
                          </div>
                        )}
                      </td>
                      <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{money(g.cost)}</td>
                      <td style={{ ...td, color: st.color, fontWeight: 600, whiteSpace: 'nowrap' }}>{st.label}</td>
                      <td style={{ ...td, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {g.lastDay ? new Date(g.lastDay).toLocaleDateString('ru-RU') : '—'}
                      </td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>
                        {!batch && (a.quantity || 1) > 1 && (
                          <>
                            <button type="button" className="btn btn--sm" onClick={() => split(a)} title="Разбить на экземпляры">✂️</button>{' '}
                          </>
                        )}
                        <button type="button" className="btn btn--sm" onClick={() => setQrAsset(a)} title="Стикер">🏷</button>{' '}
                        <button type="button" className="btn btn--sm" onClick={() => setEditing(toForm(a))} title="Изменить">✎</button>{' '}
                        {!batch && <button type="button" className="btn btn--sm btn--danger" onClick={() => remove(a)} title="Удалить">✕</button>}
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
      {auditsOpen && <AuditsModal locations={locations} onClose={() => setAuditsOpen(false)} />}
      {tagsOpen && <TagsModal locations={locations} onClose={() => setTagsOpen(false)} onChanged={load} />}
      {scanOpen && (
        <InventoryScanModal
          assets={assets}
          tags={tags}
          locations={locations}
          onFinish={audit}
          onBound={load}
          onClose={() => setScanOpen(false)}
        />
      )}
    </div>
  );
}
