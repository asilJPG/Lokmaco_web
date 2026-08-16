'use client';

import { useEffect, useState } from 'react';

export type Store = { id: string; name: string };

/**
 * Справочник складов на клиенте — **один на всю вкладку**.
 *
 * Раньше каждый смонтированный `StoreSelect` дёргал `/api/iiko/stores` из
 * useEffect: на странице перемещения их два («откуда» и «куда») — и уходило два
 * одинаковых запроса, а до ответа оба селекта стояли пустые и задизейбленные.
 * Отсюда три этажа:
 *   1) модульный кэш + общий in-flight промис — сколько бы селектов ни было на
 *      странице, запрос ровно один;
 *   2) sessionStorage — при следующем открытии любой страницы со складами
 *      список виден мгновенно, свежий подтягивается фоном и молча заменяет;
 *   3) у `StoreSelect` ещё проп `initial` — если страница получила список на
 *      сервере, ждать клиентского запроса вообще не нужно.
 *
 * ⚠️ Живёт отдельно от `StoreSelect`, потому что список нужен не только
 * селекту: «Остатки» берут склады из тяжёлого ответа `/api/iiko/balances`, и до
 * его прихода (несколько секунд) выпадающий список стоял пустым, хотя сам
 * справочник уже лежал в этом кэше.
 *
 * На сервере он тоже кэшируется на полчаса (`lib/iiko-cache.ts`), так что
 * промах здесь стоит недорого.
 */

const SS_KEY = 'lokmaco:stores';

let cache: Store[] | null = null;
let cacheAt = 0;
let inflight: Promise<Store[]> | null = null;

// Пока живёт вкладка, перепроверять справочник чаще этого незачем: склады
// меняются раз в никогда, а переходов между страницами со складами много.
const FRESH_MS = 5 * 60_000;

/** Что можно показать прямо сейчас, без запроса. Для начального состояния. */
export function peekStores(): Store[] | null {
  return cache;
}

function readSession(): Store[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(SS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Формат мог протухнуть между версиями — доверяем только явно годному.
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((s) => s && typeof s.id === 'string' && typeof s.name === 'string');
  } catch {
    return null;
  }
}

function writeSession(stores: Store[]): void {
  try {
    window.sessionStorage.setItem(SS_KEY, JSON.stringify(stores));
  } catch {
    // приватный режим / переполнение — не повод ронять селект
  }
}

/** Один запрос на вкладку: параллельные вызовы получают тот же промис. */
export function loadStores(): Promise<Store[]> {
  if (cache && Date.now() - cacheAt < FRESH_MS) return Promise.resolve(cache);
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch('/api/iiko/stores');
      const data = await res.json();
      const stores: Store[] = Array.isArray(data.stores) ? data.stores : [];
      if (data.error) throw new Error(data.error);
      cache = stores;
      cacheAt = Date.now();
      writeSession(stores);
      return stores;
    } finally {
      // Промис держим только на время запроса: повторное открытие страницы
      // через полчаса должно уметь сходить за списком заново.
      inflight = null;
    }
  })();
  return inflight;
}

/** Поднять список из sessionStorage в модульный кэш — до сетевого ответа. */
function hydrateFromSession(): Store[] | null {
  const stale = readSession();
  if (stale && stale.length > 0) {
    if (!cache) cache = stale;
    return stale;
  }
  return null;
}

/**
 * Склады для любого раздела: сразу из кэша, дальше — свежие фоном.
 *
 * `error` заполняется, только если показать нечего: список из sessionStorage
 * рабочий, и пугать пользователя сорванным фоновым обновлением незачем.
 */
export function useStores(initial?: Store[]): { stores: Store[]; loading: boolean; error: string | null } {
  const [stores, setStores] = useState<Store[]>(() => initial ?? cache ?? []);
  const [loading, setLoading] = useState(() => !(initial?.length || cache?.length));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    if (stores.length === 0) {
      // sessionStorage читаем в эффекте, а не в начальном состоянии: на сервере его нет,
      // и чтение при первом рендере разошлось бы с разметкой при гидрации.
      const stale = hydrateFromSession();
      if (stale) { setStores(stale); setLoading(false); }
    }

    loadStores()
      .then((fresh) => {
        if (!alive || fresh.length === 0) return;
        setStores(fresh);
        setError(null);
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : 'fetch failed');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => { alive = false; };
    // Один раз на монтирование: список общий для всей страницы.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { stores, loading, error };
}
