'use client';

import { useMemo } from 'react';
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

/**
 * Акт инвентаризации — как в iiko: и недостача, и излишки.
 *
 * У каждой позиции две величины: **книжный остаток** (сколько числится) и
 * **факт** (сколько нашли), а между ними разница. Односторонний список «чего
 * не нашли» на вопрос «сошлось ли» не отвечает: найденное не там, где
 * числится, тоже расхождение.
 *
 * Каждая карточка ОС — это одна единица, поэтому книжный остаток всегда 1, а
 * факт 0 или 1. Партия из двадцати столов — это двадцать строк, и в акте видно,
 * какой именно стол пропал.
 */
export function ActModal({ act, locations, onClose }: {
  act: Act;
  locations: AssetLocation[];
  onClose: () => void;
}) {
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
          <button type="button" className="btn btn--sm" onClick={onClose}>✕</button>
        </div>

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
                      {/* Код ОС — из iiko; у заведённых руками его нет, тогда
                          показываем инвентарный, как и в файле акта. */}
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
