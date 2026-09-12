'use client';

import { useEffect, useState } from 'react';
import type { AssetLocation } from '@/db/schema';
import type { Act } from './act-modal';
import { downloadInv3HtmlFile, type Inv3Data } from '@/lib/inv3-export';

type Audit = Act;

const dt = (v: string | Date | null) => (v ? new Date(v).toLocaleString('ru-RU') : '—');
const day = (v: string | Date | null) => (v ? new Date(v).toLocaleDateString('ru-RU') : '—');

/**
 * История обходов — то, ради чего инвентаризация вообще документ.
 *
 * Здесь живёт ответ на главный вопрос: чего не нашли и когда. Раньше этот
 * список существовал только в браузере до нажатия кнопки.
 */
export function AuditsModal({ locations, onClose, onOpenAct }: {
  locations: AssetLocation[];
  onClose: () => void;
  onOpenAct: (a: Act) => void;
}) {
  const [audits, setAudits] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/assets/audits');
        const json = await res.json();
        setAudits(json.audits || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const placeName = (id: string | null) => (id ? locations.find((l) => l.id === id)?.name || 'место удалено' : 'всё оборудование');

  /** Скачивание в формате ИНВ-3 */
  function exportInv3(a: Audit) {
    const place = placeName(a.locationId);
    const rows = [
      ...a.missing.map((r) => ({ ...r, fact: 0, book: 1 })),
      ...a.surplus.map((r) => ({ ...r, fact: 1, book: 0 })),
      ...a.scanned.map((r) => ({ ...r, fact: 1, book: 1 })),
    ];
    const data: Inv3Data = {
      organization: 'OOO "The Lokmaco Fergana"',
      department: place,
      docNumber: a.id ? String(a.id).slice(0, 8) : '1',
      docDate: day(a.actDate || a.startedAt),
      startDate: day(a.startedAt),
      endDate: a.finishedAt ? day(a.finishedAt) : day(a.startedAt),
      performedBy: a.performedBy || a.startedBy || 'Материально ответственное лицо',
      responsiblePerson: a.performedBy || a.startedBy || 'Материально ответственное лицо',
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
    };
    downloadInv3HtmlFile(data);
  }

  /** Акт обхода в CSV — то, что распечатывают и подписывают с МОЛ. */
  function exportCsv(a: Audit) {
    const rows: string[][] = [['Статус', 'Инв. №', 'Наименование']];
    for (const s of a.scanned) rows.push(['найдено', s.inv_number, s.name]);
    for (const s of a.missing) rows.push(['НЕ НАЙДЕНО', s.inv_number, s.name]);
    const esc = (v: string) => (/[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const csv = '﻿' + rows.map((r) => r.map(esc).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `акт-инвентаризации-${new Date(a.startedAt).toISOString().slice(0, 10)}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="scan-overlay">
      <div className="scan-sheet">
        <div className="scan-sheet__head">
          <div style={{ fontSize: 16, fontWeight: 800 }}>📋 Обходы инвентаризации</div>
          <button type="button" className="btn btn--sm" onClick={onClose}>✕</button>
        </div>

        <div className="scan-sheet__body">
          {loading ? (
            <div className="empty-state">Загрузка…</div>
          ) : audits.length === 0 ? (
            <div className="empty-state">Обходов ещё не было</div>
          ) : audits.map((a) => (
            <div key={a.id} className="card" style={{ padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{placeName(a.locationId)}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {a.performedBy || a.startedBy} · {a.actDate ? new Date(a.actDate).toLocaleDateString('ru-RU') : dt(a.startedAt)}
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: 13 }}>
                  {a.finishedAt ? (
                    <>
                      <div>✅ {a.scanned.length}</div>
                      <div style={{ color: a.missing.length ? 'var(--danger)' : 'var(--text-muted)' }}>
                        {a.missing.length ? `⚠️ не нашли ${a.missing.length}` : 'всё на месте'}
                      </div>
                      {(a.surplus?.length || 0) > 0 && (
                        <div style={{ color: 'var(--warning)' }}>излишки {a.surplus.length}</div>
                      )}
                    </>
                  ) : (
                    <div style={{ color: 'var(--warning)' }}>не закрыт</div>
                  )}
                </div>
              </div>

              {a.finishedAt && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn--sm" onClick={() => setOpenId(openId === a.id ? null : a.id)}>
                    {openId === a.id ? 'Свернуть' : 'Показать позиции'}
                  </button>
                  {/* Акт — отдельным окном: в нём и недостача, и излишки, и
                      книжный остаток. Список «показать позиции» остаётся для
                      быстрого взгляда, не открывая документ. */}
                  <button type="button" className="btn btn--sm btn--primary" onClick={() => onOpenAct(a)}>📄 Акт (ИНВ-3)</button>
                  <button type="button" className="btn btn--sm" onClick={() => exportInv3(a)}>📥 ИНВ-3</button>
                  <button type="button" className="btn btn--sm" onClick={() => exportCsv(a)}>CSV</button>
                </div>
              )}

              {openId === a.id && (
                <div className="scan-missing" style={{ marginTop: 8 }}>
                  {a.missing.map((s) => (
                    <div key={s.id} style={{ fontSize: 13, padding: '3px 0', color: 'var(--danger)' }}>
                      ⚠️ <b style={{ fontFamily: 'monospace' }}>{s.inv_number}</b> · {s.name}
                    </div>
                  ))}
                  {a.scanned.map((s) => (
                    <div key={s.id} style={{ fontSize: 13, padding: '3px 0', color: 'var(--text-muted)' }}>
                      ✅ <b style={{ fontFamily: 'monospace' }}>{s.inv_number}</b> · {s.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="scan-sheet__foot">
          <button type="button" className="btn" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  );
}
