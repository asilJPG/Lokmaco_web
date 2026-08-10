'use client';

import { useEffect, useState } from 'react';
import type { AssetAudit, AssetLocation } from '@/db/schema';

type Snapshot = { id: string; inv_number: string; name: string };
type Audit = Omit<AssetAudit, 'scanned' | 'missing'> & { scanned: Snapshot[]; missing: Snapshot[] };

const dt = (v: string | Date | null) => (v ? new Date(v).toLocaleString('ru-RU') : '—');

/**
 * История обходов — то, ради чего инвентаризация вообще документ.
 *
 * Здесь живёт ответ на главный вопрос: чего не нашли и когда. Раньше этот
 * список существовал только в браузере до нажатия кнопки.
 */
export function AuditsModal({ locations, onClose }: { locations: AssetLocation[]; onClose: () => void }) {
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
                    {a.startedBy} · {dt(a.startedAt)}
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: 13 }}>
                  {a.finishedAt ? (
                    <>
                      <div>✅ {a.scanned.length}</div>
                      <div style={{ color: a.missing.length ? 'var(--danger)' : 'var(--text-muted)' }}>
                        {a.missing.length ? `⚠️ не нашли ${a.missing.length}` : 'всё на месте'}
                      </div>
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
                  <button type="button" className="btn btn--sm" onClick={() => exportCsv(a)}>📥 Акт (CSV)</button>
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
