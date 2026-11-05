/**
 * Сверка закупа на базаре: хватает ли накладных на потраченные наличные.
 *
 * Кассир в расходах смены записывает, сколько выдал снабженцу на базар.
 * Снабженец на следующий день закупается, а остаток возвращает. Бухгалтер
 * вносит этот остаток, и между двумя отметками сходится арифметика:
 *
 *   потрачено = прошлый остаток + выдано − новый остаток
 *   внесено   = сумма приходов «Наличные» за те же дни
 *
 * Разница — это накладные, которые не внесены в базу (или внесены не на ту
 * сумму). Считаем накопительно между отметками, а не по дням: накладные
 * вносят пачками и с опозданием, и посуточная сверка давала бы ложные тревоги.
 */

const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_KEY = process.env.SUPABASE_KEY || "";

/** Тип записи в журнале: отметка «остаток у снабженца». */
export const BALANCE_ACTION = "bazaar_balance";

/**
 * Поставщик «Наличные» — так в приходах помечен закуп с руки (рядом стоят
 * «Оплата по счету» и «Корпоративная карта»: это способы оплаты, а не
 * настоящие поставщики).
 */
export const CASH_SUPPLIER = "Наличные";

/** Расход кассира, который считается выдачей на базар: «бозор» (узб.), «базар». */
const BAZAAR_EXPENSE = /(бозор|базар|bozor|bazar)/i;

/**
 * Допуск на расхождение: чуть-чуть всегда «плывёт» — сдача, округление,
 * мелкая покупка без накладной. Меньше — не тревога.
 */
export const TOLERANCE_MIN = 50_000;
export const TOLERANCE_PCT = 0.02;

const DAY = 24 * 60 * 60 * 1000;
const TASHKENT = 5 * 60 * 60 * 1000;

/** Дата по Ташкенту `ГГГГ-ММ-ДД` — сутки считаем по ресторану, а не по UTC. */
export function tashkentDate(iso) {
  return new Date(new Date(iso).getTime() + TASHKENT).toISOString().slice(0, 10);
}

export function addDays(date, n) {
  return new Date(new Date(`${date}T00:00:00Z`).getTime() + n * DAY).toISOString().slice(0, 10);
}

const sumOf = (items) => items.reduce((s, x) => s + x.amount, 0);

/** Сумма прихода по позициям. */
export function invoiceTotal(details) {
  return (details?.items || []).reduce(
    (s, it) => s + (Number(it.total) || Number(it.price) * Number(it.quantity) || 0),
    0
  );
}

/** Допустимое расхождение для суммы `expected`. */
export function toleranceFor(expected) {
  return Math.max(TOLERANCE_MIN, Math.abs(expected) * TOLERANCE_PCT);
}

/**
 * Главный расчёт. Чистая функция: на входе отметки, выдачи и приходы,
 * на выходе окна между отметками.
 *
 * @param counts   [{ id, date, leftover, comment, by }]  — по одной на дату
 * @param given    [{ date, amount, name }]               — выдано по датам смен
 * @param invoices [{ id, date, total, document }]        — приходы «Наличные»
 */
export function computeWindows(counts, given, invoices) {
  const sorted = [...counts].sort((a, b) => a.date.localeCompare(b.date));
  const windows = [];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];

    // Выдача в вечер смены S идёт на закуп дня S+1. Поэтому в окно закупов
    // (prev, cur] попадают выдачи со сменами [prev, cur): вечерняя выдача
    // в день отметки уже относится к следующему окну.
    const givenIn = given.filter((g) => g.date >= prev.date && g.date < cur.date);
    const invIn = invoices.filter((v) => v.date > prev.date && v.date <= cur.date);

    const givenSum = sumOf(givenIn);
    const spent = prev.leftover + givenSum - cur.leftover;
    const entered = invIn.reduce((s, v) => s + v.total, 0);
    const diff = spent - entered; // > 0: накладных не хватает

    const tolerance = toleranceFor(spent);
    let status = "ok";
    if (diff > tolerance) status = "missing";
    else if (diff < -tolerance) status = "over";

    // Приходы по дням — чтобы глазами найти день, где провал
    const byDay = {};
    for (const v of invIn) {
      byDay[v.date] ||= { date: v.date, count: 0, total: 0 };
      byDay[v.date].count++;
      byDay[v.date].total += v.total;
    }

    windows.push({
      from: prev.date,
      to: cur.date,
      countId: cur.id,
      openingLeftover: prev.leftover,
      leftover: cur.leftover,
      comment: cur.comment || "",
      by: cur.by || "",
      given: givenIn,
      givenSum,
      spent,
      entered,
      invoiceCount: invIn.length,
      byDay: Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date)),
      diff,
      tolerance,
      status,
      // Отрицательные «потрачено»: остаток больше, чем было денег — ошибка ввода
      suspicious: spent < 0,
    });
  }

  return windows.reverse(); // свежие сверху
}

// ---------------------------------------------------------------------------
// Загрузка из журнала
// ---------------------------------------------------------------------------

async function query(path) {
  // no-store: Next кеширует обычный fetch между вызовами, а здесь нужны свежие данные
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    cache: "no-store",
    // Зависший запрос не должен держать страницу минутами: случайный обрыв
    // сети — это ошибка на экране, а не вечная загрузка
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error(`Журнал недоступен (${res.status})`);
  return res.json();
}

/** Отметки остатка — по одной на дату (последняя по времени побеждает). */
export async function loadCounts() {
  const rows = await query(
    `bot_actions?action_type=eq.${BALANCE_ACTION}&select=id,created_at,user_name,details&order=created_at.asc&limit=2000`
  );
  const byDate = new Map();
  for (const r of rows) {
    const d = r.details || {};
    if (d.deleted_at) continue; // удалена вручную — в сверке не участвует
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date || "") || !Number.isFinite(Number(d.leftover))) continue;
    byDate.set(d.date, {
      id: r.id,
      date: d.date,
      leftover: Number(d.leftover),
      comment: d.comment || "",
      by: r.user_name || "",
      at: r.created_at,
    });
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Выдачи на базар из расходов кассира, начиная с даты смены `since`. */
export async function loadGiven(since) {
  const rows = await query(
    `bot_actions?action_type=eq.cash&created_at=gte.${encodeURIComponent(new Date(`${addDays(since, -2)}T00:00:00Z`).toISOString())}` +
      `&select=created_at,details&order=created_at.asc&limit=3000`
  );
  const out = [];
  for (const r of rows) {
    const date = r.details?.selected_date || tashkentDate(r.created_at);
    for (const e of r.details?.expenses || []) {
      const amount = Number(e.amount) || 0;
      if (amount > 0 && BAZAAR_EXPENSE.test(String(e.name || ""))) {
        out.push({ date, amount, name: String(e.name || "") });
      }
    }
  }
  return out.filter((g) => g.date >= since);
}

/** Приходы за наличные, начиная с даты `since` (по Ташкенту). */
export async function loadCashInvoices(since) {
  const rows = await query(
    `bot_actions?action_type=eq.invoice&created_at=gte.${encodeURIComponent(new Date(`${addDays(since, -1)}T00:00:00Z`).toISOString())}` +
      `&select=id,created_at,document_number,details&order=created_at.asc&limit=5000`
  );
  return rows
    .filter((r) => r.details?.status !== "failed" && r.details?.supplier_name === CASH_SUPPLIER)
    .map((r) => ({
      id: r.id,
      date: tashkentDate(r.created_at),
      total: invoiceTotal(r.details),
      document: r.document_number || "",
    }))
    .filter((v) => v.date >= since);
}

/** Полная сверка: всё нужное читается из журнала. */
export async function buildReconciliation() {
  const counts = await loadCounts();
  if (counts.length === 0) return { counts, windows: [], baseline: null };

  const since = counts[0].date;
  const [given, invoices] = await Promise.all([loadGiven(since), loadCashInvoices(since)]);

  return {
    counts,
    baseline: counts[0],
    windows: computeWindows(counts, given, invoices),
  };
}

/** Находит запись остатка на дату — чтобы повторный ввод исправлял, а не плодил дубли. */
export async function findCountRow(date) {
  const rows = await query(
    `bot_actions?action_type=eq.${BALANCE_ACTION}&details->>date=eq.${encodeURIComponent(date)}&select=id,details&order=created_at.desc&limit=5`
  );
  return rows.find((r) => !r.details?.deleted_at) || null;
}

/** Запись по id — для удаления. */
export async function getCountRow(id) {
  const rows = await query(
    `bot_actions?id=eq.${encodeURIComponent(id)}&action_type=eq.${BALANCE_ACTION}&select=id,details&limit=1`
  );
  return rows[0] || null;
}
