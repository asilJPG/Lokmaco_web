'use client';

import { useRef, useState } from 'react';
import { compressImage } from './image';
import { PHOTO_LABELS, type PhotoKind } from '@/lib/storage';

export type Photo = { path: string; url: string; kind: PhotoKind };

const HINT: Record<PhotoKind, string> = {
  goods: 'Что реально привезли',
  invoice: 'Бумага от поставщика',
};

/**
 * Фото товара и фото накладной.
 *
 * Прикладывать необязательно — приход создаётся и без них. Смысл в другом:
 * отсутствие фото видно в истории, поэтому потом можно проверить, что за
 * приход это был, а не верить на слово.
 */
export function PhotoInput({
  kind, photo, onChange, disabled,
}: { kind: PhotoKind; photo: Photo | null; onChange: (p: Photo | null) => void; disabled?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File) {
    setError(null);
    setBusy(true);
    try {
      // Жмём до отправки: снимок с телефона это 3–8 МБ, а на мобильном
      // интернете такая загрузка занимает минуты и упирается в лимит тела.
      const small = await compressImage(file);
      const form = new FormData();
      form.append('kind', kind);
      form.append('file', small);
      const res = await fetch('/api/uploads', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok || !data.path) {
        setError(data.error || 'Не удалось загрузить фото');
        return;
      }
      onChange({ path: data.path, url: data.url, kind });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function remove() {
    if (!photo) return;
    onChange(null);
    // Файл в хранилище чистим следом; если не вышло — останется сирота,
    // это не повод мешать человеку оформлять приход.
    fetch(`/api/uploads/${photo.path}`, { method: 'DELETE' }).catch(() => {});
  }

  return (
    <div className="photo-slot">
      <div className="photo-slot__head">
        <span className="photo-slot__title">{PHOTO_LABELS[kind]}</span>
        <span className="photo-slot__hint">{HINT[kind]}</span>
      </div>

      {photo ? (
        <div className="photo-slot__preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.url} alt={PHOTO_LABELS[kind]} />
          <button type="button" className="btn btn--danger btn--sm" onClick={remove} disabled={disabled}>✕ Убрать</button>
        </div>
      ) : (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            // capture открывает сразу камеру на телефоне — снимать накладную
            // удобнее, чем искать её в галерее.
            capture="environment"
            style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void pick(f); }}
          />
          <button
            type="button"
            className="btn photo-slot__btn"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || busy}
          >
            {busy ? '⏳ Загружаю…' : '📷 Снять или выбрать'}
          </button>
        </>
      )}
      {error && <div className="banner banner--error" style={{ marginTop: 8 }}>{error}</div>}
    </div>
  );
}
