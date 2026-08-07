'use client';

import { useEffect, useState } from 'react';

type ParsedItem = { product_name?: string; as_written?: string; quantity?: number; unit?: string; price?: number; needs_review?: boolean; product_id?: string };
type Parsed = { items: ParsedItem[]; supplier?: string; doc_number?: string };
type Scan = {
  id: number; path: string; url: string; from: string | null; subject: string | null; createdAt: string;
  parsed: Parsed | null; parseError: string | null;
};

/**
 * Сканы, пришедшие с МФУ по почте.
 *
 * Ничего грузить руками не нужно: снабженец отсканировал накладную на принтере,
 * она приехала сюда и ждёт. Клик — позиции распознаются и подставляются в форму
 * ниже, дальше как обычно: проверить и провести.
 */
export function ScanInbox({ onPick, onUse }: {
  onPick: (path: string) => void | Promise<void>;
  onUse: (parsed: Parsed) => void;
}) {
  const [scans, setScans] = useState<Scan[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(false);
  const [note, setNote] = useState<string | null>(null);

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

  /**
   * Забрать почту прямо сейчас, не дожидаясь фонового таймера. Нужно ровно
   * для одного случая: человек отсканировал и стоит у принтера — минута
   * ожидания здесь ощущается дольше, чем есть.
   */
  async function checkMail() {
    setChecking(true);
    setNote(null);
    try {
      const res = await fetch('/api/iiko/scans/refresh', { method: 'POST' });
      const j = await res.json();
      if (j.configured === false) {
        setNote('Почтовый мост не настроен — сканы приедут, когда сработает таймер.');
      } else if (!j.ok) {
        setNote(j.error || 'Почту проверить не удалось');
      }
      await load();
    } catch {
      setNote('Почту проверить не удалось');
    } finally {
      setChecking(false);
    }
  }

  async function use(scan: Scan) {
    setBusyId(scan.id);
    try {
      // Разобранное приехало вместе со сканом — подставляем мгновенно.
      // Ходим к модели заново только если при приёме распознать не вышло.
      if (scan.parsed?.items?.length) onUse(scan.parsed);
      else await onPick(scan.path);
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

  if (!ready) return null;

  if (scans.length === 0) {
    // Пустую очередь не прячем целиком: кнопка «Проверить почту» нужна именно
    // тогда, когда скан ещё не приехал.
    return (
      <section className="card">
        <div className="card__title">
          <span className="card__title-text">📠 Сканы накладных</span>
          <button type="button" className="btn btn--sm" onClick={checkMail} disabled={checking}>
            {checking ? '⏳ Проверяю…' : '📥 Проверить почту'}
          </button>
        </div>
        <div className="empty-state">Новых сканов нет</div>
        {note && <div className="banner banner--warn">{note}</div>}
      </section>
    );
  }

  return (
    <section className="card">
      <div className="card__title">
        <span className="card__title-text">📠 Сканы накладных ({scans.length})</span>
        <button type="button" className="btn btn--sm" onClick={checkMail} disabled={checking}>
          {checking ? '⏳ Проверяю…' : '📥 Проверить почту'}
        </button>
      </div>
      {note && <div className="banner banner--warn" style={{ marginBottom: 12 }}>{note}</div>}
      <div className="scan-list">
        {scans.map((s) => (
          <div key={s.id} className="scan-item">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.url} alt="Скан накладной" />
            <div className="scan-item__body">
              <div className="scan-item__meta">
                {new Date(s.createdAt).toLocaleString('ru-RU')}
                {s.parsed?.supplier ? ` · ${s.parsed.supplier}` : ''}
                {s.parsed?.doc_number ? ` · № ${s.parsed.doc_number}` : ''}
              </div>

              {s.parsed?.items?.length ? (
                <div className="scan-item__items">
                  {s.parsed.items.slice(0, 4).map((it, i) => (
                    <div key={i}>
                      {it.needs_review && <span title={`В накладной: ${it.as_written}`}>⚠️ </span>}
                      {it.product_name} — {it.quantity} {it.unit} × {Number(it.price || 0).toLocaleString('ru-RU')}
                    </div>
                  ))}
                  {s.parsed.items.length > 4 && <div>…и ещё {s.parsed.items.length - 4}</div>}
                </div>
              ) : s.parseError ? (
                <div className="banner banner--warn" style={{ padding: '4px 8px', fontSize: 12 }}>
                  Распознать не вышло: {s.parseError}
                </div>
              ) : null}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="btn btn--primary btn--sm" disabled={busyId === s.id} onClick={() => use(s)}>
                  {busyId === s.id ? '⏳ Читаю…' : s.parsed?.items?.length ? '✓ Взять в приход' : '📄 Распознать'}
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
