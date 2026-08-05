'use client';

import { useEffect, useState } from 'react';

export type Store = { id: string; name: string };

/**
 * Справочник складов на клиенте.
 *
 * Раньше каждый смонтированный StoreSelect дёргал /api/iiko/stores из useEffect:
 * на странице перемещения их два («откуда» и «куда») — и уходило два одинаковых
 * запроса, а до их ответа оба селекта стояли пустые и задизейбленные. Теперь три
 * этажа:
 *   1) модульный кэш + общий in-flight промис — сколько бы селектов ни было на
 *      странице, запрос ровно один;
 *   2) sessionStorage — при следующем открытии любой страницы со складами список
 *      виден мгновенно, свежий подтягивается фоном и молча заменяет показанный;
 *   3) проп `initial` — если страница уже получила список на сервере, ждать
 *      клиентского запроса вообще не нужно.
 */

const SS_KEY = 'lokmaco:stores';

let cache: Store[] | null = null;
let cacheAt = 0;
let inflight: Promise<Store[]> | null = null;

// Пока живёт вкладка, перепроверять справочник чаще этого незачем: склады
// меняются раз в никогда, а переходов между страницами со складами много.
const FRESH_MS = 5 * 60_000;

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

/** Один запрос на страницу: параллельные вызовы получают тот же промис. */
function loadStores(): Promise<Store[]> {
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

export function StoreSelect({
  value,
  onChange,
  label = 'Склад',
  exclude,
  initial,
}: {
  value: string;
  onChange: (v: string, name: string) => void;
  label?: string;
  exclude?: string;
  initial?: Store[];
}) {
  // Начальное состояние берём синхронно, ещё до первого кадра: сервер (initial),
  // затем кэш модуля. sessionStorage читаем в эффекте — на сервере его нет, и
  // чтение прямо здесь дало бы расхождение разметки при гидрации.
  const [stores, setStores] = useState<Store[]>(() => initial ?? cache ?? []);
  const [loading, setLoading] = useState(() => !(initial?.length || cache?.length));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    if (stores.length === 0) {
      const stale = readSession();
      if (stale && stale.length > 0) {
        cache = stale;
        setStores(stale);
        setLoading(false);
      }
    }

    // Обновляем в фоне в любом случае: показанный список мог устареть, а
    // подмена его свежим для пользователя незаметна.
    loadStores()
      .then((fresh) => {
        if (!alive || fresh.length === 0) return;
        setStores(fresh);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : 'fetch failed');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
    // Один раз на монтирование: список общий для всей страницы.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const list = exclude ? stores.filter((s) => s.id !== exclude) : stores;
  const busy = loading && stores.length === 0;

  return (
    <div className="field">
      <label className="field__label">{label}</label>
      <select
        className="select"
        value={value}
        onChange={(e) => {
          const s = stores.find((x) => x.id === e.target.value);
          onChange(e.target.value, s?.name || '');
        }}
        disabled={busy}
      >
        <option value="">{busy ? 'Загрузка…' : '— выбери —'}</option>
        {list.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
      {/* Ошибку показываем, только если показывать больше нечего: список из
          sessionStorage рабочий, и пугать им из-за сорванного фонового
          обновления незачем. */}
      {error && stores.length === 0 && (
        <div className="field__hint" style={{ color: 'var(--warning)' }}>iiko: {error}</div>
      )}
    </div>
  );
}
