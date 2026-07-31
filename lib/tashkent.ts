/**
 * Время для документов iiko.
 *
 * iiko ждёт локальное ташкентское время. Считать его через локальные геттеры
 * (`new Date().getHours()`) нельзя: на Vercel сервер живёт в UTC, и документ
 * получал бы UTC-часы с подписью «+05:00» — то есть уезжал на 5 часов назад, а
 * вечером ещё и на предыдущую дату. Поэтому сдвигаем эпоху на +5 и читаем
 * только UTC-геттерами: результат одинаковый и на маке, и на сервере.
 */
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function tashkentNow(): Date {
  return new Date(Date.now() + TASHKENT_OFFSET_MS);
}

/** `YYYY-MM-DD` по ташкентскому календарю. */
export function tashkentDate(d: Date = tashkentNow()): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** `HH:MM:SS` по ташкентским часам. */
export function tashkentTime(d: Date = tashkentNow()): string {
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

/** `YYYY-MM-DDTHH:MM:SS` без зоны — формат XML API (`v2/documents/*`). */
export function tashkentStampNaive(d: Date = tashkentNow()): string {
  return `${tashkentDate(d)}T${tashkentTime(d)}`;
}

/** Пара штампов с явной зоной — формат iikoWeb JSON API. */
export function tashkentStamps(d: Date = tashkentNow()): { dateIncoming: string; dateIncomingMs: string } {
  const base = `${tashkentDate(d)}T${tashkentTime(d)}`;
  return { dateIncoming: `${base}+05:00`, dateIncomingMs: `${base}.000+05:00` };
}
