'use client';

import { useEffect, useState } from 'react';

type Scan = { id: number; path: string; url: string; from: string | null; subject: string | null; createdAt: string };

/**
 * Сканы, пришедшие с МФУ по почте.
 *
 * Ничего грузить руками не нужно: снабженец отсканировал накладную на принтере,
 * она приехала сюда и ждёт. Клик — позиции распознаются и подставляются в форму
 * ниже, дальше как обычно: проверить и провести.
 */
export function ScanInbox({ onPick }: { onPick: (path: string) => void | Promise<void> }) {
  const [scans, setScans] = useState<Scan[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [ready, setReady] = useState(false);

  async function load() {
    try {
      const res = await fetch('/api/iiko/scans');
      const j = await res.json();
      setScans(j.scans || []);
    } catch {
      // Очередь сканов — не главный путь оформления прихода: если она не
      // ответила, форма должна работать дальше как ни в чём не бывало.
    } finally {
      setReady(true);
    }
  }

  useEffect(() => { load(); }, []);

  async function use(scan: Scan) {
    setBusyId(scan.id);
    try {
      await onPick(scan.path);
      await fetch('/api/iiko/scans', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: scan.id, status: 'used' }),
      });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function dismiss(scan: Scan) {
    setBusyId(scan.id);
    try {
      await fetch('/api/iiko/scans', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: scan.id, status: 'dismissed' }),
      });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  if (!ready || scans.length === 0) return null;

  return (
    <section className="card">
      <div className="card__title">
        <span className="card__title-text">📠 Сканы накладных ({scans.length})</span>
        <button type="button" className="btn btn--sm" onClick={load}>↻ Обновить</button>
      </div>
      <div className="scan-list">
        {scans.map((s) => (
          <div key={s.id} className="scan-item">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.url} alt="Скан накладной" />
            <div className="scan-item__body">
              <div className="scan-item__meta">
                {new Date(s.createdAt).toLocaleString('ru-RU')}
                {s.from ? ` · ${s.from}` : ''}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="btn btn--primary btn--sm" disabled={busyId === s.id} onClick={() => use(s)}>
                  {busyId === s.id ? '⏳ Читаю…' : '📄 Распознать'}
                </button>
                <button type="button" className="btn btn--sm" disabled={busyId === s.id} onClick={() => dismiss(s)}>
                  Убрать
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
