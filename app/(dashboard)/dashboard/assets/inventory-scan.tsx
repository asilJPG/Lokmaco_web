'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Asset, AssetLocation, AssetTag } from '@/db/schema';
import { looksLikeTag, normalizeTagCode } from '@/lib/asset-tags';
import { unitLabel } from '@/lib/inv-number';

type Feedback = {
  ok: boolean;
  duplicate?: boolean;
  unbound?: boolean;
  code: string;
  name: string;
  unit?: string;
  location?: string;
  serial?: string;
};

/**
 * Обход с камерой: наводишь на наклейку — единица засчитана.
 *
 * Сканируем **в браузере телефона**, без отдельного приложения: обход делают
 * с того, что уже в кармане. Отсюда два требования, которые и определяют весь
 * код ниже — работать на iPhone и не сажать батарею за десять минут.
 */
export function InventoryScanModal({
  assets, tags, locations, onFinish, onBound, onClose,
}: {
  assets: Asset[];
  tags: AssetTag[];
  locations: AssetLocation[];
  onFinish: (ids: string[]) => Promise<void>;
  onBound: () => Promise<void>;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);

  const [placeId, setPlaceId] = useState('all');
  const [scannedIds, setScannedIds] = useState<Set<string>>(new Set());
  const [last, setLast] = useState<Feedback | null>(null);
  const [error, setError] = useState('');
  const [supported, setSupported] = useState(true);
  const [showMissing, setShowMissing] = useState(false);
  const [manual, setManual] = useState('');
  const [saving, setSaving] = useState(false);
  /** Код непривязанной наклейки, которую предлагаем оформить прямо на месте. */
  const [binding, setBinding] = useState<string | null>(null);

  // Обходят по одному помещению за раз, поэтому и «осталось» должно считаться
  // по нему же: иначе после полного обхода кухни счётчик показывает 12 из 88 и
  // выглядит как незаконченная работа.
  const scope = useMemo(
    () => (placeId === 'all' ? assets : assets.filter((a) => a.locationId === placeId)),
    [assets, placeId]
  );

  const byId = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);
  const byInv = useMemo(() => {
    const m = new Map<string, Asset>();
    for (const a of assets) if (a.invNumber) m.set(a.invNumber.trim().toUpperCase(), a);
    return m;
  }, [assets]);
  const tagMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of tags) if (t.assetId) m.set(t.code, t.assetId);
    return m;
  }, [tags]);
  const placeName = useMemo(() => new Map(locations.map((l) => [l.id, l.name])), [locations]);

  /**
   * В обходе встречаются оба вида QR: универсальная наклейка (ссылка вида
   * `/tag/LKM-0007`) и старый стикер с инвентарным номером в тексте.
   */
  function resolve(raw: string): { asset: Asset | null; code: string; unbound?: boolean } | null {
    const code = normalizeTagCode(raw);
    if (code && tagMap.has(code)) {
      const asset = byId.get(tagMap.get(code)!);
      if (asset) return { asset, code };
    }
    // Наклейка наша, но ни к чему не привязана — это не «не найдено»,
    // а «её ещё не оформили», и человеку это надо сказать прямо.
    if (code && looksLikeTag(raw)) return { asset: null, code, unbound: true };

    const text = String(raw || '');
    const m = text.match(/Инв\.\s*№\s*[:：]?\s*([A-Za-zА-Яа-я0-9\-_]+)/i);
    const inv = m ? m[1].trim().toUpperCase() : (/^[A-Z0-9\-_]{3,}$/i.test(text.trim()) ? text.trim().toUpperCase() : null);
    if (!inv) return null;
    return { asset: byInv.get(inv) || null, code: inv };
  }

  function register(raw: string) {
    const hit = resolve(raw);
    if (!hit) return;

    if (hit.unbound) {
      setLast({ ok: false, unbound: true, code: hit.code, name: 'Наклейка ни к чему не привязана' });
      return;
    }
    if (!hit.asset) {
      setLast({ ok: false, code: hit.code, name: 'Не найдено в базе' });
      return;
    }

    const asset = hit.asset;
    let already = false;
    setScannedIds((prev) => {
      if (prev.has(asset.id)) { already = true; return prev; }
      const next = new Set(prev);
      next.add(asset.id);
      return next;
    });
    setLast({
      ok: !already,
      duplicate: already,
      code: hit.code,
      name: asset.name,
      unit: unitLabel(asset, assets),
      location: (asset.locationId && placeName.get(asset.locationId)) || asset.location || '',
      serial: asset.serialNumber || '',
    });
    // Вибрация — единственная обратная связь, когда телефон в вытянутой руке
    // и на экран не смотришь. Повтор отличается ритмом.
    if (navigator.vibrate) navigator.vibrate(already ? [40, 60, 40] : 60);
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setSupported(false);
        setError('Камера недоступна в этом браузере');
        return;
      }
      // ⚠️ getUserMedia не работает в незащищённом контексте — по http сканер
      // не откроется вообще, и это надо сказать словами, а не «ошибка камеры».
      if (!window.isSecureContext) {
        setSupported(false);
        setError('Камера работает только по https. Откройте сайт по защищённой ссылке.');
        return;
      }

      try {
        /**
         * ⚠️ `BarcodeDetector` есть **только в Chromium**. В WebKit его нет ни
         * в одной версии Safari, а на iPhone все браузеры (включая Chrome и
         * Яндекс) — это WebKit. Раньше сканер там просто не работал. Поэтому
         * запасной путь — jsQR: медленнее, но работает везде, где есть камера.
         */
        let detect: (v: HTMLVideoElement) => Promise<string[]> | string[];
        const Detector = (window as unknown as {
          BarcodeDetector?: new (o: { formats: string[] }) => { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
        }).BarcodeDetector;

        if (Detector) {
          const d = new Detector({ formats: ['qr_code'] });
          detect = async (video) => (await d.detect(video)).map((c) => c.rawValue || '');
        } else {
          const { default: jsQR } = await import('jsqr');
          detect = (video) => {
            const canvas = canvasRef.current;
            if (!canvas || !video.videoWidth) return [];
            // Кадр целиком jsQR жуёт слишком долго — хватает 640px по ширине.
            const scale = Math.min(1, 640 / video.videoWidth);
            const w = Math.round(video.videoWidth * scale);
            const h = Math.round(video.videoHeight * scale);
            if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) return [];
            ctx.drawImage(video, 0, 0, w, h);
            const code = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
            return code?.data ? [code.data] : [];
          };
        }

        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        // Программное декодирование дорогое: 10 кадров в секунду достаточно,
        // чтобы поймать наклейку, и телефон при этом не греется.
        let lastRun = 0;
        const loop = async () => {
          if (cancelled || !videoRef.current) return;
          const now = performance.now();
          if (now - lastRun >= 100) {
            lastRun = now;
            try {
              for (const raw of await detect(videoRef.current)) register(raw);
            } catch { /* кадр не распознался — не страшно */ }
          }
          rafRef.current = requestAnimationFrame(loop);
        };
        rafRef.current = requestAnimationFrame(loop);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Не удалось открыть камеру');
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scannedInScope = scope.filter((a) => scannedIds.has(a.id)).length;
  const missing = scope.filter((a) => !scannedIds.has(a.id));

  return (
    <div className="scan-overlay">
      <div className="scan-sheet">
        <div className="scan-sheet__head">
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>📷 Инвентаризация</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Наведите камеру на наклейку</div>
          </div>
          <button type="button" className="btn btn--sm" onClick={onClose}>✕</button>
        </div>

        <div className="scan-sheet__video">
          {supported ? (
            <>
              <video ref={videoRef} playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <canvas ref={canvasRef} style={{ display: 'none' }} />
              <div className="scan-reticle" />
            </>
          ) : (
            <div style={{ padding: 24, color: '#fff', textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>📷</div>
              <div>{error || 'Сканер недоступен'}</div>
            </div>
          )}
        </div>

        <div className={`scan-feedback ${last ? (last.ok ? 'scan-feedback--ok' : last.duplicate ? 'scan-feedback--dup' : 'scan-feedback--bad') : ''}`}>
          {last ? (
            <>
              <span style={{ fontSize: 18 }}>{last.ok ? '✅' : last.duplicate ? '🔁' : '⚠️'}</span>
              <div style={{ fontSize: 13, lineHeight: 1.4 }}>
                <b style={{ fontFamily: 'monospace' }}>{last.code}</b> — {last.name}
                {last.unit && <b style={{ color: 'var(--accent)' }}> · {last.unit}</b>}
                {last.duplicate && <span style={{ color: 'var(--warning)', fontWeight: 700 }}> · уже отсканирован</span>}
                {last.unbound && (
                  /* Наклейка наша, но пустая. Отправлять человека за этим на
                     другой экран — значит бросить обход на середине. */
                  <button type="button" className="btn btn--sm" style={{ marginLeft: 8 }} onClick={() => setBinding(last.code)}>
                    Привязать
                  </button>
                )}
                {(last.location || last.serial) && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {last.location ? `📍 ${last.location}` : ''}
                    {last.location && last.serial ? ' · ' : ''}
                    {last.serial ? `№ ${last.serial}` : ''}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Наведите на QR-код…</div>
          )}
        </div>

        <div className="scan-sheet__body">
          {locations.length > 0 && (
            <select className="select" value={placeId} onChange={(e) => setPlaceId(e.target.value)}>
              <option value="all">Всё оборудование ({assets.length})</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name} ({assets.filter((a) => a.locationId === l.id).length})</option>
              ))}
            </select>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>Отсканировано</span>
            <span style={{ fontSize: 20, fontWeight: 800 }}>
              {scannedInScope} <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 600 }}>из {scope.length}</span>
            </span>
          </div>

          {/* Наклейка бывает залеплена или содрана — тогда номер вбивают руками,
              иначе единица останется «не найденной» без всякой вины обходчика. */}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="input"
              value={manual}
              placeholder="Код наклейки или инв. номер"
              onChange={(e) => setManual(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { register(manual); setManual(''); } }}
            />
            <button type="button" className="btn btn--sm" onClick={() => { register(manual); setManual(''); }}>Добавить</button>
          </div>

          <button type="button" className="btn btn--sm" onClick={() => setShowMissing((v) => !v)}>
            {showMissing ? 'Скрыть ненайденное' : `Не найдено: ${missing.length}`}
          </button>

          {showMissing && (
            <div className="scan-missing">
              {missing.length === 0 ? (
                <div className="empty-state">Всё на месте</div>
              ) : missing.map((a) => (
                <div key={a.id} style={{ padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                  <b style={{ fontFamily: 'monospace' }}>{a.invNumber}</b> · {a.name}
                  {unitLabel(a, assets) && <span style={{ color: 'var(--text-muted)' }}> · {unitLabel(a, assets)}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="scan-sheet__foot">
          <button type="button" className="btn" onClick={onClose}>Отмена</button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={scannedIds.size === 0 || saving}
            onClick={async () => {
              setSaving(true);
              try { await onFinish(Array.from(scannedIds)); } finally { setSaving(false); }
            }}
          >
            {saving ? 'Сохраняю…' : `Отметить ${scannedIds.size} шт.`}
          </button>
        </div>
      </div>

      {binding && (
        <BindTagModal
          code={binding}
          assets={assets}
          locations={locations}
          onClose={() => setBinding(null)}
          onDone={async () => {
            setBinding(null);
            setLast(null);
            await onBound();
          }}
        />
      )}
    </div>
  );
}

/**
 * «Подошёл, отсканировал, выбрал что это» — привязка пустой наклейки к единице.
 *
 * Порядок намеренно обратный привычному: сначала клеим пустые наклейки, а
 * выбираем оборудование, когда предмет уже перед глазами. Ошибиться так почти
 * невозможно, а вот наклейку, напечатанную «под морозилку», легко налепить не
 * на ту морозилку — и потом это уже не выловить.
 */
function BindTagModal({ code, assets, locations, onClose, onDone }: {
  code: string;
  assets: Asset[];
  locations: AssetLocation[];
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [assetId, setAssetId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const found = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return assets
      .filter((a) => (a.name || '').toLowerCase().includes(q) || (a.invNumber || '').toLowerCase().includes(q))
      .slice(0, 12);
  }, [assets, query]);

  const chosen = assets.find((a) => a.id === assetId);

  async function bind(force = false) {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/assets/tags', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, asset_id: assetId, location_id: locationId || null, force }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 409) {
        // Перепривязка занятой наклейки — только осознанно: случайный скан не
        // должен молча переклеить учёт.
        if (confirm(`Наклейка уже на «${json.current?.name || 'другом оборудовании'}». Переклеить?`)) return bind(true);
        setError('Привязка отменена');
        return;
      }
      if (!res.ok) { setError(json.error || 'Не удалось привязать'); return; }
      await onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="scan-overlay" style={{ zIndex: 1300 }}>
      <div className="scan-sheet">
        <div className="scan-sheet__head">
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>🏷 Привязать наклейку</div>
            <div style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--text-muted)' }}>{code}</div>
          </div>
          <button type="button" className="btn btn--sm" onClick={onClose}>✕</button>
        </div>

        <div className="scan-sheet__body">
          {error && <div className="banner banner--error">{error}</div>}

          <input
            className="input"
            placeholder="Что это? Название или инв. номер"
            value={chosen ? `${chosen.invNumber} · ${chosen.name}` : query}
            onChange={(e) => { setAssetId(''); setQuery(e.target.value); }}
          />

          {!chosen && found.map((a) => (
            <button
              key={a.id}
              type="button"
              className="btn btn--sm"
              style={{ justifyContent: 'flex-start', textAlign: 'left' }}
              onClick={() => { setAssetId(a.id); setLocationId(a.locationId || ''); }}
            >
              <b style={{ fontFamily: 'monospace' }}>{a.invNumber}</b>&nbsp;· {a.name}
              {unitLabel(a, assets) && <span style={{ color: 'var(--text-muted)' }}>&nbsp;· {unitLabel(a, assets)}</span>}
            </button>
          ))}

          <select className="select" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            <option value="">Место не указано</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>

        <div className="scan-sheet__foot">
          <button type="button" className="btn" onClick={onClose}>Отмена</button>
          <button type="button" className="btn btn--primary" disabled={!assetId || busy} onClick={() => bind(false)}>
            {busy ? 'Сохраняю…' : 'Привязать'}
          </button>
        </div>
      </div>
    </div>
  );
}
