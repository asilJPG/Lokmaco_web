/**
 * Базовый инвентарный номер позиции.
 *
 * Партия из N штук разворачивается в карточки `EQ-00690-01 … EQ-00690-20`,
 * и по базе `EQ-00690` они собираются обратно в одну строку списка.
 *
 * Наивное `replace(/-\d+$/, "")` тут не работает: у обычной позиции `EQ-00690`
 * оно съедало номер целиком и превращало её в `EQ`. Из-за этого все позиции
 * схлопывались в одну «партию», а сверка с iiko считала, что в базе нет ничего.
 * Поэтому смотрим на количество сегментов: суффикс экземпляра — это третий.
 */
export function baseInvNumber(inv) {
  const s = String(inv || "").trim();
  const parts = s.split("-");
  return parts.length >= 3 ? parts.slice(0, -1).join("-") : s;
}

/** Номер конкретного экземпляра партии: EQ-00690 + 7 из 20 -> EQ-00690-07 */
export function unitInvNumber(baseInv, index, total) {
  const width = Math.max(2, String(total).length);
  return `${baseInv}-${String(index).padStart(width, "0")}`;
}
