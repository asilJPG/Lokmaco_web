/**
 * Общее для эндпоинтов обедов руководства.
 *
 * Учёт ведётся только на сайте: в iiko такие заказы закрываются «без оплаты»,
 * поэтому на выручку и отчётность для франчайзера они не влияют. Запросов к
 * iiko здесь нет и быть не должно.
 */

export const MEALS_ROLES = ["admin", "cashier"];

/** Сегодня по Ташкенту — рабочие сутки заведения, а не UTC. */
export function todayTashkent() {
  return new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Границы месяца «YYYY-MM»; без аргумента — текущий по Ташкенту. */
export function monthRange(month) {
  const m = /^\d{4}-\d{2}$/.test(String(month || ""))
    ? month
    : todayTashkent().slice(0, 7);
  const [y, mm] = m.split("-").map(Number);
  const last = new Date(Date.UTC(y, mm, 0)).getUTCDate();
  return { month: m, from: `${m}-01`, to: `${m}-${String(last).padStart(2, "0")}` };
}

/**
 * bot_actions.tg_id и manager_meals.entered_by_tg_id — bigint. Заголовок может
 * приехать пустым: middleware пишет String(user.tg_id || ""), а у админа с
 * tg_id = 0 это даёт "". Строку сюда подставлять нельзя — Postgres ответит 400.
 */
export function parseTgId(raw) {
  const n = Number(raw);
  return raw !== null && raw !== "" && Number.isFinite(n) ? n : 0;
}

export function guard(request) {
  const userId = request.headers.get("x-user-id");
  const [baseRole] = (request.headers.get("x-user-role") || "").split(":");

  if (!userId) return { error: "Unauthorized", status: 401 };
  if (!MEALS_ROLES.includes(baseRole)) {
    return { error: "Доступ только для кассира и администратора", status: 403 };
  }
  return {
    baseRole,
    userName: decodeURIComponent(request.headers.get("x-user-name") || "Кассир"),
    tgId: parseTgId(request.headers.get("x-user-tg-id")),
  };
}

/**
 * Токен из QR: либо ссылка вида `https://сайт/m/<uuid>`, либо сам uuid.
 * Камера телефона отдаёт ссылку, сканер внутри приложения — тот же текст.
 */
export function normalizeManagerToken(raw) {
  const s = String(raw || "").trim();
  const fromUrl = s.match(/\/m\/([0-9a-fA-F-]{36})/);
  const token = (fromUrl ? fromUrl[1] : s).toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(token)
    ? token
    : null;
}
