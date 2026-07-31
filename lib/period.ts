export type Period = { from: string; to: string };

function pad(n: number): string { return String(n).padStart(2, '0'); }

// Вся арифметика ниже — строго в UTC поверх сдвинутой на +5 эпохи. Локальные
// геттеры здесь использовать нельзя: на сервере (UTC) и на маке они дают
// разные ответы, и «сегодня» разъезжается с ташкентским календарём.
function ymd(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function todayTashkent(): string {
  return new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);
}

export function yesterdayTashkent(): string {
  const d = new Date(Date.now() + 5 * 3600_000);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function presetPeriod(preset: string): Period {
  const today = new Date(Date.now() + 5 * 3600_000);
  today.setUTCHours(0, 0, 0, 0);
  const shift = (days: number) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() + days);
    return d;
  };
  const to = ymd(today);
  if (preset === 'today') return { from: to, to };
  if (preset === 'yesterday') {
    const yd = ymd(shift(-1));
    return { from: yd, to: yd };
  }
  if (preset === '7d') return { from: ymd(shift(-6)), to };
  if (preset === '30d') return { from: ymd(shift(-29)), to };
  if (preset === 'this_month') {
    const f = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    return { from: ymd(f), to };
  }
  if (preset === 'last_month') {
    const f = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
    const t = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0));
    return { from: ymd(f), to: ymd(t) };
  }
  return { from: to, to };
}

export function parsePeriod(search: URLSearchParams | { from?: string; to?: string; preset?: string }): Period {
  const get = (k: string) => (search instanceof URLSearchParams ? search.get(k) : (search as any)[k]);
  const from = get('from');
  const to = get('to');
  const preset = get('preset');
  if (from && to) return { from, to };
  return presetPeriod(preset || 'this_month');
}

export function fmtMoney(n: number): string {
  return n.toLocaleString('ru-RU');
}

export function fmtDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}.${m[2]}.${m[1]}`;
}
