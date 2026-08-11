'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Asset, AssetLocation, AssetTag } from '@/db/schema';

type TagRow = AssetTag & { asset?: Asset | null };

/**
 * QR рисуем **сами** и **вектором**, а не картинкой.
 *
 * Внешний сервис не годится: лист на сотню наклеек — это сотня запросов
 * наружу, половина не успевает, и из принтера выезжают пустые рамки, которые
 * уже наклеены. Печатать при этом приходится там, где интернета может не быть.
 *
 * ⚠️ И не `<img src="data:…">`: браузер декодирует картинку асинхронно, а
 * `window.print()` уходит сразу — на лист выезжали только подписи, без кодов.
 * SVG попадает в разметку готовым, ждать нечего.
 */
async function qrSvg(text: string): Promise<string> {
  const QRCode = (await import('qrcode')).default;
  return QRCode.toString(text, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
}

/**
 * Печать пачки наклеек.
 *
 * ⚠️ Лист рендерится **в саму страницу** под `@media print`, а не в новое окно:
 * `window.open` после `await` браузер не считает результатом клика, возвращает
 * null, и обращение к его document падает.
 */
async function printSheet(codes: string[]) {
  const origin = window.location.origin;
  const cells = await Promise.all(codes.map(async (code) => {
    const svg = await qrSvg(`${origin}/tag/${code}`);
    return `<div class="tag-cell">
      ${svg}
      <div class="tag-cell__code">${code}</div>
      <div class="tag-cell__cap">Инвентарная наклейка оборудования</div>
    </div>`;
  }));

  let host = document.getElementById('print-tags');
  if (!host) {
    host = document.createElement('div');
    host.id = 'print-tags';
    document.body.appendChild(host);
  }
  host.innerHTML = `<div class="tag-sheet">${cells.join('')}</div>`;

  document.body.classList.add('printing-tags');
  // Даём браузеру разложить страницу перед печатью: без кадра ожидания
  // диалог иногда открывается по старой раскладке.
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  window.print();
  setTimeout(() => {
    document.body.classList.remove('printing-tags');
    host!.innerHTML = '';
  }, 1000);
}

/**
 * Универсальные наклейки: печатаются пустой пачкой, привязка к конкретной
 * единице делается сканированием на месте. Так исключается путаница «наклеил
 * ярлык от одной морозилки на другую» — выбор идёт, когда предмет перед глазами.
 */
export function TagsModal({ locations, onClose, onChanged }: {
  locations: AssetLocation[];
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [tags, setTags] = useState<TagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [count, setCount] = useState('24');
  const [filter, setFilter] = useState<'all' | 'free' | 'bound'>('all');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/assets/tags');
      const json = await res.json();
      setTags(json.success ? json.data : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const shown = useMemo(() => tags.filter((t) => (
    filter === 'free' ? !t.assetId : filter === 'bound' ? !!t.assetId : true
  )), [tags, filter]);

  const free = tags.filter((t) => !t.assetId);

  async function create() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/assets/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: Number(count) || 0 }),
      });
      const json = await res.json();
      if (!res.ok) { setMsg({ ok: false, text: json.error || 'Не удалось создать' }); return; }
      await load();
      // Сразу на печать: пачку заводят ровно затем, чтобы её распечатать.
      await printSheet((json.tags || []).map((t: AssetTag) => t.code));
      setMsg({ ok: true, text: `Готово: ${json.tags.length} наклеек, ${json.tags[0].code} — ${json.tags[json.tags.length - 1].code}` });
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function unbind(code: string) {
    if (!confirm(`Отвязать наклейку ${code}? Оборудование останется, наклейка станет свободной.`)) return;
    await fetch('/api/assets/tags', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, unbind: true }),
    });
    await load();
    await onChanged();
  }

  async function removeFree() {
    if (!confirm(`Удалить все свободные наклейки (${free.length} шт.)? Напечатанные станут нерабочими.`)) return;
    const res = await fetch('/api/assets/tags?free=1', { method: 'DELETE' });
    const json = await res.json();
    setMsg({ ok: res.ok, text: res.ok ? `Удалено: ${json.removed}` : json.error });
    await load();
  }

  return (
    <div className="scan-overlay">
      <div className="scan-sheet">
        <div className="scan-sheet__head">
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>🏷 Наклейки</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Всего {tags.length} · свободных {free.length}
            </div>
          </div>
          <button type="button" className="btn btn--sm" onClick={onClose}>✕</button>
        </div>

        <div className="scan-sheet__body">
          {msg && <div className={`banner ${msg.ok ? 'banner--success' : 'banner--error'}`}>{msg.text}</div>}

          <div className="banner">
            Печатаются <b>пустыми</b>. Клей на что угодно, а что это за предмет — выберешь при
            сканировании, когда он перед глазами.
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="input"
              type="number"
              min={1}
              max={500}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              style={{ maxWidth: 120 }}
            />
            <button type="button" className="btn btn--primary" disabled={busy} onClick={create}>
              {busy ? 'Готовлю…' : '🖨 Напечатать пачку'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(['all', 'free', 'bound'] as const).map((f) => (
              <button
                key={f}
                type="button"
                className={`btn btn--sm ${filter === f ? 'btn--primary' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? 'Все' : f === 'free' ? `Свободные (${free.length})` : `Привязанные (${tags.length - free.length})`}
              </button>
            ))}
            {free.length > 0 && (
              <>
                <button type="button" className="btn btn--sm" onClick={() => printSheet(free.map((t) => t.code))}>
                  🖨 Перепечатать свободные
                </button>
                <button type="button" className="btn btn--sm btn--danger" onClick={removeFree}>Удалить свободные</button>
              </>
            )}
          </div>

          <div className="scan-missing">
            {loading ? (
              <div className="empty-state">Загрузка…</div>
            ) : shown.length === 0 ? (
              <div className="empty-state">Наклеек нет — напечатай первую пачку</div>
            ) : shown.map((t) => (
              <div key={t.code} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                <b style={{ fontFamily: 'monospace' }}>{t.code}</b>
                <span style={{ flex: 1, color: t.assetId ? undefined : 'var(--text-muted)' }}>
                  {t.asset ? `${t.asset.name}${t.asset.locationId ? ` · ${locations.find((l) => l.id === t.asset!.locationId)?.name || ''}` : ''}` : 'свободна'}
                </span>
                {t.assetId && (
                  <button type="button" className="btn btn--sm" onClick={() => unbind(t.code)}>Отвязать</button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="scan-sheet__foot">
          <button type="button" className="btn" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  );
}
