export type Period = { from: string; to: string };

function pad(n: number): string { return String(n).padStart(2, '0'); }

function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayTashkent(): string {
  return new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);
}

export function presetPeriod(preset: string): Period {
  const today = new Date(Date.now() + 5 * 3600_000);
  today.setHours(0, 0, 0, 0);
  const to = ymd(today);
  if (preset === 'today') return { from: to, to };
  if (preset === 'yesterday') {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    const yd = ymd(y);
    return { from: yd, to: yd };
  }
  if (preset === '7d') {
    const f = new Date(today);
    f.setDate(f.getDate() - 6);
    return { from: ymd(f), to };
  }
  if (preset === '30d') {
    const f = new Date(today);
    f.setDate(f.getDate() - 29);
    return { from: ymd(f), to };
  }
  if (preset === 'this_month') {
    const f = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: ymd(f), to };
  }
  if (preset === 'last_month') {
    const f = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const t = new Date(today.getFullYear(), today.getMonth(), 0);
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
