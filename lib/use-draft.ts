'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Черновик формы в localStorage.
 *
 * Зачем: инвентаризация склада — это полчаса вбивания цифр с телефона. Телефон
 * засыпает, iOS выгружает вкладку из памяти — и всё введённое пропадает. В
 * легаси (`components/LocmacoApp.jsx`, ключ `locmaco_inventory_draft_<storeId>`)
 * черновик был, в v2 его потеряли.
 *
 * Правила, которые здесь зашиты:
 * - ключ учитывает контекст (склад/филиал), иначе черновик одного склада
 *   затрёт черновик другого и человек проведёт чужие остатки;
 * - запись с задержкой — на каждое нажатие в localStorage не пишем;
 * - восстановление никогда не молчаливое: хук возвращает `restoredAt`, форма
 *   обязана показать плашку. Иначе непонятно, откуда в полях цифры;
 * - старше `MAX_AGE_MS` не восстанавливаем — склад давно пересчитали;
 * - localStorage может быть недоступен (приватный режим, отключённые куки) —
 *   любое обращение обёрнуто в try/catch, страница из-за черновика не падает.
 */

const PREFIX = 'lokmaco_v2';
/** Черновик живёт 3 дня: более старые данные к текущему остатку отношения не имеют. */
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;
const DEFAULT_DELAY_MS = 600;

type Stored<T> = { savedAt: number; data: T };

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* приватный режим или переполнение — черновик просто не сохранится */
  }
}

function safeRemove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* см. safeSet */
  }
}

/**
 * Филиал берём из куки `current_filial` (она специально не httpOnly): у одного
 * пользователя может быть несколько филиалов со своей номенклатурой, и
 * черновик из одного филиала во втором — это мусор.
 */
function currentFilialKey(): string {
  try {
    const m = document.cookie.match(/(?:^|;\s*)current_filial=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : 'all';
  } catch {
    return 'all';
  }
}

export type UseDraftOptions<T> = {
  /** Имя формы: `inventory`, `transfer`, `production`, `writeoff`. */
  name: string;
  /**
   * Контекст черновика — обычно склад. `null` = контекст ещё не выбран,
   * тогда ничего не пишем и не восстанавливаем.
   */
  scope: string | null;
  /** Текущее состояние формы. */
  value: T;
  /** Пустую форму не сохраняем и удаляем существующий черновик. */
  isEmpty: (value: T) => boolean;
  /** Вызывается один раз на найденный черновик — форма подставляет данные. */
  onRestore: (value: T) => void;
  delayMs?: number;
};

export type UseDraftResult = {
  /** Время сохранения восстановленного черновика (мс) или `null`. */
  restoredAt: number | null;
  /** Удалить черновик из хранилища и убрать плашку. Обязательно после отправки. */
  clear: () => void;
};

export function useDraft<T>({
  name,
  scope,
  value,
  isEmpty,
  onRestore,
  delayMs = DEFAULT_DELAY_MS,
}: UseDraftOptions<T>): UseDraftResult {
  const [restoredAt, setRestoredAt] = useState<number | null>(null);

  // Колбэки и значение держим в ref: иначе новая стрелка на каждый рендер
  // перезапускала бы эффект восстановления и он крутился бы бесконечно.
  const isEmptyRef = useRef(isEmpty);
  const onRestoreRef = useRef(onRestore);
  isEmptyRef.current = isEmpty;
  onRestoreRef.current = onRestore;

  const key = scope ? `${PREFIX}_${name}_draft_${scope}` : null;
  const keyRef = useRef<string | null>(null);
  /** Ключ, для которого попытка восстановления уже отработала. */
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!key) {
      setRestoredAt(null);
      setLoadedKey(null);
      return;
    }
    // Полный ключ собираем уже в браузере: филиал лежит в куке.
    const full = `${key}_${currentFilialKey()}`;
    keyRef.current = full;
    setRestoredAt(null);

    const raw = safeGet(full);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Stored<T>;
        if (!parsed || typeof parsed.savedAt !== 'number') throw new Error('bad draft');
        if (Date.now() - parsed.savedAt > MAX_AGE_MS) {
          safeRemove(full); // протухший черновик не показываем и не копим
        } else {
          onRestoreRef.current(parsed.data);
          setRestoredAt(parsed.savedAt);
        }
      } catch {
        safeRemove(full); // битый JSON лечится удалением, а не падением страницы
      }
    }
    setLoadedKey(full);
  }, [key]);

  useEffect(() => {
    const full = keyRef.current;
    // Пока не отработало восстановление для этого ключа, писать нельзя:
    // стартовое пустое состояние формы затёрло бы найденный черновик.
    if (!key || !full || loadedKey !== full) return;

    const t = setTimeout(() => {
      if (isEmptyRef.current(value)) safeRemove(full);
      else safeSet(full, JSON.stringify({ savedAt: Date.now(), data: value } satisfies Stored<T>));
    }, delayMs);
    return () => clearTimeout(t);
  }, [value, key, loadedKey, delayMs]);

  const clear = useCallback(() => {
    if (keyRef.current) safeRemove(keyRef.current);
    setRestoredAt(null);
  }, []);

  return { restoredAt, clear };
}

/** «сегодня в 14:32» / «03.08 в 14:32» — человеку важно, насколько черновик свежий. */
export function formatDraftTime(ts: number): string {
  const d = new Date(ts);
  const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const today = new Date();
  const sameDay =
    d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  if (sameDay) return `сегодня в ${time}`;
  return `${d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })} в ${time}`;
}
