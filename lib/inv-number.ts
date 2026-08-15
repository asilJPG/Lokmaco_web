/**
 * Разбор инвентарного номера.
 *
 * Партия из N штук разворачивается в карточки `EQ-00690-01 … EQ-00690-20`,
 * и по базе `EQ-00690` они собираются обратно в одну строку списка.
 *
 * ⚠️ Наивное `replace(/-\d+$/, '')` тут не работает: у обычной позиции
 * `EQ-00690` оно съедало номер целиком и превращало её в `EQ`. Из-за этого все
 * позиции схлопывались в одну «партию», а сверка с iiko считала, что в базе нет
 * ничего.
 *
 * ⚠️ Считать третий сегмент суффиксом экземпляра — тоже мало. У заведённых
 * руками номер трёхсегментный от рождения (`INV-1-5375`, `INV-INV-2147`), и
 * они попадали под то же правило: «Морозилка» и «Стол холодильный» слипались в
 * одну партию `INV-1`, `unitLabel` рисовал «№5375 из 1», а разбивка на
 * экземпляры отказывала с «эта позиция уже разбита». Поэтому суффикс
 * экземпляра распознаётся по форме: **2–3 цифры**, как их печатает
 * `unitInvNumber` (ширина `max(2, len(total))`, а больше 200 штук за раз не
 * разбиваем). Случайные четырёхзначные хвосты ручных номеров под это не
 * подходят — и правильно.
 */

/** Номер экземпляра в партии или `null`, если это не суффикс экземпляра. */
export function unitSuffix(inv: string | null | undefined): number | null {
  const parts = String(inv || '').trim().split('-');
  if (parts.length < 3) return null;
  const last = parts[parts.length - 1];
  if (!/^\d{2,3}$/.test(last)) return null;
  return parseInt(last, 10);
}

export function baseInvNumber(inv: string | null | undefined): string {
  const s = String(inv || '').trim();
  if (unitSuffix(s) === null) return s;
  return s.split('-').slice(0, -1).join('-');
}

/** Номер конкретного экземпляра партии: EQ-00690 + 7 из 20 → EQ-00690-07. */
export function unitInvNumber(baseInv: string, index: number, total: number): string {
  const width = Math.max(2, String(total).length);
  return `${baseInv}-${String(index).padStart(width, '0')}`;
}

/**
 * «№3 из 7» — какой именно экземпляр партии перед тобой.
 *
 * Без этого при сканировании двадцати одинаковых столов непонятно, какой из
 * них засчитан, и обход превращается в угадайку.
 */
export function unitLabel(asset: { invNumber?: string | null }, all: { invNumber?: string | null }[]): string {
  const inv = String(asset?.invNumber || '');
  const index = unitSuffix(inv);
  if (index === null) return '';
  const base = baseInvNumber(inv);
  const total = (all || []).filter((a) => baseInvNumber(a.invNumber) === base).length;
  return total > 1 ? `№${index} из ${total}` : `№${index}`;
}
