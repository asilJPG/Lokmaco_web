import { sql } from 'drizzle-orm';
import { db } from '@/db/client';

/**
 * Кэш ответов iiko на два этажа: память процесса + таблица `iiko_cache`.
 *
 * Только память тут не работает: на Vercel инстансов десятки и они поднимаются
 * заново под каждую волну запросов, так что Map почти всегда пустая и за каждый
 * справочник платится полный круг «прочитать креды из БД → auth → запрос →
 * logout». Этаж в БД переживает холодный старт и общий для всех инстансов, а
 * память остаётся сверху, чтобы тёплый инстанс не ходил в БД вообще.
 *
 * Хранить тут стоит только справочники, которые меняются раз в никогда (склады,
 * номенклатура). Для документов и отчётов кэш опасен: покажем вчерашнее.
 */

type Entry = { data: unknown; at: number };

// Память переживает между запросами внутри одного инстанса, поэтому висит на
// globalThis: маршруты Next собираются в отдельные бандлы, и модуль в каждом
// из них свой — без общего объекта кэш был бы отдельный на каждый роут.
const globalForCache = globalThis as unknown as {
  iikoCacheMem?: Map<string, Entry>;
  iikoCacheInflight?: Map<string, Promise<unknown>>;
};

const mem = globalForCache.iikoCacheMem ?? new Map<string, Entry>();
const inflight = globalForCache.iikoCacheInflight ?? new Map<string, Promise<unknown>>();
globalForCache.iikoCacheMem = mem;
globalForCache.iikoCacheInflight = inflight;

function memKey(key: string, filialId: number): string {
  return `${key}:${filialId}`;
}

async function readDb(key: string, filialId: number, ttlMs: number): Promise<unknown | undefined> {
  const secs = Math.ceil(ttlMs / 1000);
  const res = (await db.execute(sql`
    select payload from iiko_cache
    where key = ${key} and filial_id = ${filialId}
      and updated_at > now() - make_interval(secs => ${secs})
  `)) as unknown as { rows: { payload: unknown }[] };
  return res.rows[0]?.payload;
}

async function writeDb(key: string, filialId: number, data: unknown): Promise<void> {
  await db.execute(sql`
    insert into iiko_cache (key, filial_id, payload, updated_at)
    values (${key}, ${filialId}, ${JSON.stringify(data)}::jsonb, now())
    on conflict (key, filial_id) do update set payload = excluded.payload, updated_at = now()
  `);
}

/**
 * Достать значение из кэша или посчитать его `loader`-ом.
 *
 * Порядок: память → БД → loader. Промах пишет сразу в оба этажа.
 * Ошибки самого кэша (БД недоступна, таблицы ещё нет) намеренно проглатываются:
 * кэш — ускорение, а не источник правды, и ронять из-за него живой запрос в iiko
 * нельзя. Ошибка `loader`-а, наоборот, пробрасывается как есть.
 */
export async function cached<T>(
  key: string,
  filialId: number,
  ttlMs: number,
  loader: () => Promise<T>
): Promise<T> {
  const mk = memKey(key, filialId);

  const hit = mem.get(mk);
  if (hit && Date.now() - hit.at < ttlMs) return hit.data as T;

  // Параллельные запросы на одном инстансе делят одну загрузку: иначе десяток
  // одновременных открытий страницы дал бы десяток логинов в iiko.
  const running = inflight.get(mk);
  if (running) return running as Promise<T>;

  const task = (async () => {
    try {
      const fromDb = await readDb(key, filialId, ttlMs);
      if (fromDb !== undefined) {
        mem.set(mk, { data: fromDb, at: Date.now() });
        return fromDb as T;
      }
    } catch {
      // молча идём в loader
    }

    const fresh = await loader();
    mem.set(mk, { data: fresh, at: Date.now() });
    try {
      await writeDb(key, filialId, fresh);
    } catch {
      // не смогли положить в БД — следующий холодный инстанс просто сходит в iiko
    }
    return fresh;
  })();

  inflight.set(mk, task);
  try {
    return await task;
  } finally {
    inflight.delete(mk);
  }
}

/** Сбросить запись обоих этажей — например, когда поменяли реквизиты филиала. */
export async function invalidateCached(key: string, filialId: number): Promise<void> {
  mem.delete(memKey(key, filialId));
  try {
    await db.execute(sql`delete from iiko_cache where key = ${key} and filial_id = ${filialId}`);
  } catch {
    // см. выше: кэш не должен ронять запрос
  }
}
