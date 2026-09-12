'use client';

import { useMemo, useState } from 'react';
import type { AssetAudit, AssetLocation } from '@/db/schema';
import {
  type Inv3Data,
  downloadInv3HtmlFile,
  downloadInv3ExcelFile,
  printInv3Window,
} from '@/lib/inv3-export';

/** Строка акта — снимок карточки на момент закрытия обхода, а не текущее её состояние. */
export type ActRow = { id: string; inv_number: string; name: string; code?: string; cost?: number };
export type Act = Omit<AssetAudit, 'scanned' | 'missing' | 'surplus'> & {
  scanned: ActRow[];
  missing: ActRow[];
  surplus: ActRow[];
};

const money = (n: number) => Math.round(n).toLocaleString('ru-RU');
const day = (v: string | Date | null) => (v ? new Date(v).toLocaleDateString('ru-RU') : '—');

export function ActModal({ act: initialAct, locations, onClose, onDeleted, onUpdated }: {
  act: Act;
  locations: AssetLocation[];
  onClose: () => void;
  onDeleted?: (id: string) => void;
  onUpdated?: (act: Act) => void;
}) {
  const [act, setAct] = useState<Act>(initialAct);
  const [editing, setEditing] = useState(false);
  const [editDate, setEditDate] = useState(() => (act.actDate ? String(act.actDate).slice(0, 10) : (act.startedAt ? new Date(act.startedAt).toISOString().slice(0, 10) : '')));
  const [editPerformedBy, setEditPerformedBy] = useState(() => act.performedBy || act.startedBy || '');
  const [editNote, setEditNote] = useState(() => act.note || '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const rows = useMemo(() => [
    ...act.missing.map((r) => ({ ...r, fact: 0, book: 1 })),
    ...act.surplus.map((r) => ({ ...r, fact: 1, book: 0 })),
    ...act.scanned.map((r) => ({ ...r, fact: 1, book: 1 })),
  ], [act]);

  const shortage = act.missing.reduce((s, r) => s + (r.cost || 0), 0);
  const excess = act.surplus.reduce((s, r) => s + (r.cost || 0), 0);
  const place = act.locationId
    ? locations.find((l) => l.id === act.locationId)?.name || 'место удалено'
    : 'всё оборудование';

  const inv3Data = useMemo<Inv3Data>(() => ({
    organization: 'OOO "The Lokmaco Fergana"',
    department: place,
    docNumber: act.id ? String(act.id).slice(0, 8) : '1',
    docDate: day(act.actDate || act.startedAt),
    startDate: day(act.startedAt),
    endDate: act.finishedAt ? day(act.finishedAt) : day(act.startedAt),
    performedBy: act.performedBy || act.startedBy || 'Материально ответственное лицо',
    responsiblePerson: act.performedBy || act.startedBy || 'Материально ответственное лицо',
    items: rows.map((r) => ({
      id: r.id,
      name: r.name,
      inv_number: r.inv_number,
      code: r.code || r.inv_number,
      cost: r.cost || 0,
      unit: 'шт',
      fact: r.fact,
      book: r.book,
    })),
  }), [act, place, rows]);

  async function saveMeta() {
    setSaving(true);
    try {
      const res = await fetch('/api/assets/audits', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: act.id,
          action: 'update_meta',
          act_date: editDate || null,
          performed_by: editPerformedBy.trim(),
          note: editNote.trim(),
        }),
      });
      const json = await res.json();
      if (json.success && json.audit) {
        const next: Act = {
          ...act,
          actDate: json.audit.actDate,
          performedBy: json.audit.performedBy,
          note: json.audit.note,
        };
        setAct(next);
        setEditing(false);
        onUpdated?.(next);
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteAudit() {
    if (!confirm('Удалить эту инвентаризацию? Данные обхода и акт будут удалены.')) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/assets/audits?id=${act.id}`, { method: 'DELETE' });
      if (res.ok) {
        onDeleted?.(act.id);
        onClose();
      }
    } finally {
      setDeleting(false);
    }
  }

  /** Файл акта в CSV */
  function downloadCsv() {
    const esc = (v: string | number) => {
      const t = String(v);
      return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
    };
    const head = [
      ['АКТ ИНВЕНТАРИЗАЦИИ ОСНОВНЫХ СРЕДСТВ'],
      ['Дата', day(act.actDate || act.startedAt)],
      ['Место', place],
      ['Проводит', act.performedBy || act.startedBy],
      ['Закрыт', act.finishedAt ? new Date(act.finishedAt).toLocaleString('ru-RU') : '—'],
      [],
      ['№', 'Наименование', 'Код ОС', 'Кол-во факт', 'Кол-во по учёту', 'Разница', 'Сумма'],
    ];
    const body = rows.map((r, i) => [
      i + 1, r.name, r.code || r.inv_number, r.fact, r.book, r.fact - r.book, Math.round(r.cost || 0),
    ]);
    const foot = [
      [],
      ['Недостача, позиций', act.missing.length, '', '', '', '', Math.round(shortage)],
      ['Излишки, позиций', act.surplus.length, '', '', '', '', Math.round(excess)],
      ['Найдено, позиций', act.scanned.length],
      [],
      ['МОЛ', '', '', '', 'Подпись'],
      ['Проводил', act.performedBy || act.startedBy, '', '', 'Подпись'],
    ];
    const csv = '﻿' + [...head, ...body, ...foot].map((r) => r.map(esc).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `акт-инвентаризации-${(act.actDate || String(act.startedAt)).slice(0, 10)}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="scan-overlay">
      <div className="scan-sheet act-sheet">
        <div className="scan-sheet__head">
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>📄 Акт инвентаризации (ИНВ-3)</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {day(act.actDate || act.startedAt)} · {place} · проводит {act.performedBy || act.startedBy}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button type="button" className="btn btn--sm" onClick={() => setEditing(!editing)} title="Изменить дату или ответственных">
              ✏️ {editing ? 'Отмена' : 'Изменить'}
            </button>
            <button type="button" className="btn btn--sm btn--danger" disabled={deleting} onClick={deleteAudit} title="Удалить инвентаризацию">
              🗑️
            </button>
            <button type="button" className="btn btn--sm" onClick={onClose}>✕</button>
          </div>
        </div>

        {editing && (
          <div className="card" style={{ margin: '8px 12px', padding: 12, background: 'var(--surface-muted)' }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>✏️ Редактирование реквизитов инвентаризации</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Дата акта</label>
                <input
                  type="date"
                  className="input input--inline"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Кто проводит / Ответственные</label>
                <input
                  className="input input--inline"
                  placeholder="Асиль, Шодиев..."
                  value={editPerformedBy}
                  onChange={(e) => setEditPerformedBy(e.target.value)}
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Примечание</label>
                <input
                  className="input input--inline"
                  placeholder="Комментарий к инвентаризации..."
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="button" className="btn btn--sm" onClick={() => setEditing(false)}>Отмена</button>
              <button type="button" className="btn btn--sm btn--primary" disabled={saving} onClick={saveMeta}>
                {saving ? 'Сохраняю…' : 'Сохранить изменения'}
              </button>
            </div>
          </div>
        )}

        <div className="act-totals">
          <div className={act.missing.length ? 'act-total act-total--bad' : 'act-total'}>
            <span>Недостача</span>
            <b>{act.missing.length} шт · {money(shortage)}</b>
          </div>
          <div className={act.surplus.length ? 'act-total act-total--warn' : 'act-total'}>
            <span>Излишки</span>
            <b>{act.surplus.length} шт · {money(excess)}</b>
          </div>
          <div className="act-total act-total--ok">
            <span>Совпало</span>
            <b>{act.scanned.length} шт</b>
          </div>
        </div>

        <div className="scan-sheet__body">
          <div className="xls-wrap" style={{ maxHeight: '52vh' }}>
            <table className="xls">
              <thead>
                <tr>
                  <th className="xls__rownum">№</th>
                  <th>Наименование</th>
                  <th className="col-wide">Код ОС</th>
                  <th style={{ textAlign: 'right' }}>Факт</th>
                  <th style={{ textAlign: 'right' }}>Учёт</th>
                  <th style={{ textAlign: 'right' }}>Разница</th>
                  <th style={{ textAlign: 'right' }} className="col-cost">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const diff = r.fact - r.book;
                  return (
                    <tr key={`${r.id}-${i}`} className={diff === 0 ? undefined : 'act-row--diff'}>
                      <td className="xls__rownum">{i + 1}</td>
                      <td className="xls__name">
                        {r.name}
                        <span className="xls__sub">{r.inv_number}</span>
                      </td>
                      <td className="xls__mono col-wide">{r.code || r.inv_number}</td>
                      <td className="xls__num">{r.fact}</td>
                      <td className="xls__num">{r.book}</td>
                      <td className="xls__num" style={{ color: diff === 0 ? undefined : 'var(--danger)', fontWeight: diff === 0 ? undefined : 700 }}>
                        {diff > 0 ? `+${diff}` : diff}
                      </td>
                      <td className="xls__num col-cost">{money(r.cost || 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {act.note && <div className="banner">💬 {act.note}</div>}
        </div>

        <div className="scan-sheet__foot" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <button type="button" className="btn" onClick={onClose}>Закрыть</button>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn--sm" onClick={() => printInv3Window(inv3Data)}>
              🖨️ Печать
            </button>
            <button type="button" className="btn btn--sm" onClick={() => downloadInv3ExcelFile(inv3Data)}>
              📊 Excel (.xls)
            </button>
            <button type="button" className="btn btn--sm btn--primary" onClick={() => downloadInv3HtmlFile(inv3Data)}>
              📥 Скачать ИНВ-3 (.html)
            </button>
            <button type="button" className="btn btn--sm" onClick={downloadCsv} title="Скачать простой CSV">
              CSV
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
