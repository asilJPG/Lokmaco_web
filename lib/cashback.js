import { fiscalUrl, formatFiscalDate } from "./fiscal-receipt.js";

/**
 * Очередь чеков закупок для кешбэка Soliq.
 *
 * Регистрация чека в приложении Soliq — только руками и только физлицом, так
 * что сайт ничего не регистрирует. Он ведёт учёт: какие чеки ещё можно
 * внести, сколько осталось времени и какие уже внесены.
 */

const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_KEY = process.env.SUPABASE_KEY || "";

/**
 * Срок: чек не регистрируется, если с даты его выдачи прошло 10 календарных
 * дней (по материалам buxgalter.uz; официального текста правил мы не видели —
 * сверить в приложении). Считаем по-строгому: на десятый день уже «истёк».
 */
export const WINDOW_DAYS = 10;
/** «Горит» — осталось не больше стольких дней. */
export const URGENT_DAYS = 2;

const DAY = 24 * 60 * 60 * 1000;
const TASHKENT_OFFSET = 5 * 60 * 60 * 1000;

/** Номер календарного дня по Ташкенту — чтобы считать дни, а не часы. */
function tashkentDayNumber(date) {
  return Math.floor((date.getTime() + TASHKENT_OFFSET) / DAY);
}

/** Дата чека из QR/текста (`ГГГГММДДччммсс`, по Ташкенту) или null. */
function parseFiscalDate(c) {
  const m = String(c || "").match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const date = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}+05:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Состояние одного чека на момент `now`.
 *   `registered` — внесён в приложение (отметка человека)
 *   `expired`    — прошло 10 дней, внести уже нельзя
 *   `active`     — ещё можно; `daysLeft` — сколько календарных дней осталось
 */
export function receiptState(row, now = new Date()) {
  const d = row.details || {};
  const receipt = d.receipt;

  // Дата выдачи — из самого чека; нет её — берём момент прихода (чек получен
  // в тот же день, ошибка не больше суток). У прочитанного по тексту дату тоже
  // могла перепутать нейросеть, а ошибка здесь стоит денег: поздняя дата даст
  // ложное «ещё можно». Поэтому берём более раннюю из двух — срок выйдет
  // короче, а не длиннее.
  const fiscal = parseFiscalDate(receipt?.datetime);
  const invoiceAt = new Date(row.created_at);
  const issued =
    fiscal && receipt?.source === "ocr"
      ? new Date(Math.min(fiscal.getTime(), invoiceAt.getTime()))
      : fiscal || invoiceAt;
  const daysSince = tashkentDayNumber(now) - tashkentDayNumber(issued);
  const daysLeft = WINDOW_DAYS - daysSince;

  let status = "active";
  if (d.receipt_registered_at) status = "registered";
  else if (daysLeft <= 0) status = "expired";

  return { status, daysLeft: Math.max(daysLeft, 0), issuedAt: issued.toISOString() };
}

/** Приводит запись журнала к виду для раздела: только то, что нужно показать. */
export function toCashbackItem(row, now = new Date()) {
  const d = row.details || {};
  const r = d.receipt || {};
  const { status, daysLeft, issuedAt } = receiptState(row, now);

  return {
    id: row.id,
    status,
    daysLeft,
    issuedAt,
    invoiceAt: row.created_at,
    document: row.document_number || "",
    supplier: d.supplier_name || "",
    fm: r.fm || "",
    sign: r.sign || "",
    receiptNo: r.receipt_no || "",
    fiscalDate: formatFiscalDate(r.datetime),
    link: fiscalUrl(r),
    source: r.source || "",
    confirmed: Boolean(r.confirmed),
    registeredAt: d.receipt_registered_at || null,
    registeredBy: d.receipt_registered_by || "",
  };
}

/** Чеки за последние `days` дней — с запасом: истёкшие тоже показываем. */
export async function loadCashbackItems({ days = 40, now = new Date() } = {}) {
  const since = new Date(now.getTime() - days * DAY).toISOString();
  const url =
    `${SUPABASE_URL}/rest/v1/bot_actions?action_type=eq.invoice` +
    `&created_at=gte.${encodeURIComponent(since)}` +
    `&select=id,created_at,document_number,details&order=created_at.desc&limit=2000`;

  // no-store: иначе Next отдаст журнал, снятый при первом запросе
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Журнал недоступен (${res.status})`);

  const rows = await res.json();
  return rows
    .filter((row) => row.details?.status !== "failed" && row.details?.receipt)
    .map((row) => toCashbackItem(row, now));
}

/** Порядок в очереди: сначала горящие, внесённые и истёкшие — в конец. */
export function sortQueue(items) {
  const rank = { active: 0, expired: 1, registered: 2 };
  return [...items].sort((a, b) => {
    if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
    if (a.status === "active") return a.daysLeft - b.daysLeft || a.issuedAt.localeCompare(b.issuedAt);
    return b.issuedAt.localeCompare(a.issuedAt);
  });
}

export function summarize(items) {
  const count = (fn) => items.filter(fn).length;
  return {
    active: count((i) => i.status === "active"),
    urgent: count((i) => i.status === "active" && i.daysLeft <= URGENT_DAYS),
    registered: count((i) => i.status === "registered"),
    expired: count((i) => i.status === "expired"),
  };
}
