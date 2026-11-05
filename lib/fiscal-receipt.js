/**
 * Фискальные реквизиты чека закупки: номер ФМ и фискальный признак.
 *
 * QR на чеке онлайн-ККТ — это ссылка вида
 *   https://ofd.soliq.uz/check?t=UZ170703100597&r=2421&c=20230104121801&s=514343190161
 * где (по примерам из документации интеграторов Click и Fbox, официального
 * описания у Soliq мы не нашли):
 *   t — номер фискального модуля (ФМ): две буквы и 12 цифр. Буквы разные —
 *       на живых чеках встречаются UZ, VG, LG, UG, YZ, так что «UZ» из
 *       примеров документации — лишь частный случай
 *   r — номер чека
 *   c — дата и время, ГГГГММДДччммсс
 *   s — фискальный признак
 *
 * Модуль чистый и без зависимостей: им пользуются и браузер (сразу после
 * снимка), и сервер (перед записью в журнал). Разбор значений в обоих местах
 * обязан совпадать, поэтому правило проверки лежит здесь, а не в двух копиях.
 */

/** Номер ФМ: две латинские буквы и 12 цифр (префикс бывает любой). */
const FM_RE = /^[A-Z]{2}\d{12}$/;
/** Фискальный признак — только цифры, на чеках встречается от 10 до 16. */
const SIGN_RE = /^\d{10,16}$/;

/** Приводит ввод к виду, в котором его хранят: латиница заглавными, без пробелов. */
export function cleanFm(value) {
  const s = String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (s.length < 3) return s;
  // После двух букв страны идут одни цифры, так что буквы в хвосте — это
  // ошибка распознавания: «O» вместо нуля, «I» вместо единицы.
  return s.slice(0, 2) + s.slice(2).replace(/O/g, "0").replace(/[IL]/g, "1");
}

export function cleanSign(value) {
  return String(value || "").replace(/\D/g, "");
}

/**
 * Делит номер ФМ на буквенный префикс и сам номер: `VG541170038484` →
 * `VG` и `541170038484`. В приложение Soliq вносят номер без префикса, и его
 * надо уметь скопировать отдельно.
 */
export function splitFm(value) {
  const s = cleanFm(value);
  const m = s.match(/^([A-Z]{2})(\d+)$/);
  return m ? { prefix: m[1], number: m[2] } : { prefix: "", number: s };
}

export function isValidFm(value) {
  return FM_RE.test(cleanFm(value));
}

export function isValidSign(value) {
  return SIGN_RE.test(cleanSign(value));
}

/** «20230104121801» → «04.01.2023 12:18:01», иначе пустая строка. */
export function formatFiscalDate(c) {
  const m = String(c || "").match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
  return m ? `${m[3]}.${m[2]}.${m[1]} ${m[4]}:${m[5]}:${m[6]}` : "";
}

/**
 * Разбирает текст из QR. Возвращает реквизиты или null, если это не чек
 * налоговой — например, QR магазина, который ведёт на сайт магазина.
 */
export function parseFiscalQr(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;

  let params;
  try {
    const url = new URL(raw);
    if (!/(^|\.)soliq\.uz$/i.test(url.hostname)) return null;
    params = url.searchParams;
  } catch {
    return null;
  }

  const fm = cleanFm(params.get("t"));
  const sign = cleanSign(params.get("s"));
  // Без обоих реквизитов чек для нас бесполезен
  if (!isValidFm(fm) || !isValidSign(sign)) return null;

  return {
    fm,
    sign,
    receipt_no: cleanSign(params.get("r")),
    datetime: String(params.get("c") || ""),
    url: raw,
    source: "qr",
  };
}

/** Ссылка на чек по реквизитам — чтобы открыть его на сайте налоговой. */
export function fiscalUrl({ fm, sign, receipt_no, datetime }) {
  if (!isValidFm(fm) || !isValidSign(sign)) return "";
  const q = new URLSearchParams({ t: cleanFm(fm) });
  if (receipt_no) q.set("r", cleanSign(receipt_no));
  if (datetime) q.set("c", String(datetime));
  q.set("s", cleanSign(sign));
  return `https://ofd.soliq.uz/check?${q.toString()}`;
}

/**
 * Приводит присланные реквизиты к хранимому виду. Всё, что не прошло проверку,
 * отбрасывается: в журнал пишем только то, что похоже на настоящие реквизиты.
 *
 * `confirmed` — человек сам посмотрел и подтвердил значения. Распознанное
 * по тексту без подтверждения помечается: нейросеть путает цифры.
 */
export function normalizeReceipt(input) {
  if (!input || typeof input !== "object") return null;

  const fm = cleanFm(input.fm);
  const sign = cleanSign(input.sign);
  const hasFm = isValidFm(fm);
  const hasSign = isValidSign(sign);
  if (!hasFm && !hasSign) return null;

  const source = ["qr", "ocr", "manual"].includes(input.source) ? input.source : "manual";

  return {
    fm: hasFm ? fm : "",
    sign: hasSign ? sign : "",
    receipt_no: cleanSign(input.receipt_no).slice(0, 12),
    datetime: /^\d{14}$/.test(String(input.datetime || "")) ? String(input.datetime) : "",
    source,
    // QR читается машиной без ошибок; всё остальное — только после проверки глазами
    confirmed: source === "qr" ? true : Boolean(input.confirmed),
  };
}

/**
 * Обычная длина фискального признака — 12 цифр: так у всех, что прочитаны из
 * QR. Другая длина у распознанного по тексту — почти наверняка ошибка
 * нейросети (лишняя или потерянная цифра), и такой результат стоит показать
 * человеку с предупреждением, а не отдавать как есть.
 */
export function isUsualSignLength(sign) {
  return cleanSign(sign).length === 12;
}
