import { sql } from 'drizzle-orm';
import { db } from '@/db/client';

/**
 * Счётчик неудачных входов — в БД, а не в памяти процесса.
 *
 * Раньше это была обычная Map. На Vercel процессов десятки и они поднимаются
 * под нагрузкой, поэтому «5 попыток» размазывались по инстансам: код из 4 цифр
 * перебирался за часы. Общий счётчик в БД видят все инстансы сразу.
 *
 * Считаем в двух разрезах: по IP (обычный перебор) и глобально (перебор с
 * ботнета — там смена IP бесплатна, а общий поток промахов виден всегда).
 */

const GLOBAL_KEY = '__global__';
const WINDOW_MS = 5 * 60_000;

export type LimitVerdict = { allowed: true } | { allowed: false; retryAfterMs: number };

async function peek(key: string): Promise<{ attempts: number; resetAt: Date } | null> {
  const res = (await db.execute(sql`
    select attempts, reset_at from login_attempts where key = ${key} and reset_at > now()
  `)) as unknown as { rows: { attempts: number; reset_at: string }[] };
  const row = res.rows[0];
  return row ? { attempts: Number(row.attempts), resetAt: new Date(row.reset_at) } : null;
}

async function bump(key: string, windowMs: number): Promise<void> {
  const secs = Math.round(windowMs / 1000);
  await db.execute(sql`
    insert into login_attempts (key, attempts, reset_at)
    values (${key}, 1, now() + make_interval(secs => ${secs}))
    on conflict (key) do update set
      attempts = case when login_attempts.reset_at < now() then 1 else login_attempts.attempts + 1 end,
      reset_at = case when login_attempts.reset_at < now()
                      then now() + make_interval(secs => ${secs})
                      else login_attempts.reset_at end
  `);
}

/** Пускать ли ещё одну попытку входа с этого IP. */
export async function checkLoginLimit(
  ip: string,
  { max = 5, globalMax = 40 }: { max?: number; globalMax?: number } = {}
): Promise<LimitVerdict> {
  const [byIp, global] = await Promise.all([peek(ip), peek(GLOBAL_KEY)]);
  if (byIp && byIp.attempts >= max) {
    return { allowed: false, retryAfterMs: byIp.resetAt.getTime() - Date.now() };
  }
  if (global && global.attempts >= globalMax) {
    return { allowed: false, retryAfterMs: global.resetAt.getTime() - Date.now() };
  }
  return { allowed: true };
}

/** Промах: увеличиваем оба счётчика. */
export async function noteLoginFailure(ip: string): Promise<void> {
  await Promise.all([bump(ip, WINDOW_MS), bump(GLOBAL_KEY, WINDOW_MS)]);
}

/** Удачный вход — снимаем блокировку с этого IP. */
export async function clearLoginFailures(ip: string): Promise<void> {
  await db.execute(sql`delete from login_attempts where key = ${ip}`);
}
