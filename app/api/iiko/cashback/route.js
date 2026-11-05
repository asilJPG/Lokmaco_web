import { updateActionDetails } from "@/lib/supabase.js";
import { loadCashbackItems, sortQueue, summarize, WINDOW_DAYS } from "@/lib/cashback.js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_KEY = process.env.SUPABASE_KEY || "";

/** Только админ: реквизиты чеков видит он, снабженец о кешбэке не знает. */
function guard(request) {
  const userId = request.headers.get("x-user-id");
  const [baseRole] = (request.headers.get("x-user-role") || "").split(":");
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (baseRole !== "admin") {
    return Response.json({ error: "Доступ только для администратора" }, { status: 403 });
  }
  return null;
}

/** Очередь чеков для кешбэка. */
export async function GET(request) {
  const denied = guard(request);
  if (denied) return denied;

  try {
    const items = sortQueue(await loadCashbackItems());
    return Response.json({ success: true, windowDays: WINDOW_DAYS, summary: summarize(items), items });
  } catch (e) {
    console.error("[/api/iiko/cashback GET]", e.message);
    return Response.json({ error: "Не удалось загрузить чеки" }, { status: 500 });
  }
}

/** Отметка «внесено в приложение» (или снятие отметки). */
export async function POST(request) {
  const denied = guard(request);
  if (denied) return denied;

  try {
    const { id, registered } = await request.json();
    if (!id || typeof registered !== "boolean") {
      return Response.json({ error: "Нужны id и registered (true/false)" }, { status: 400 });
    }

    // Читаем запись заново: details целиком перезаписывается, и работать
    // с устаревшей копией из браузера нельзя — затрутся чужие поля.
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/bot_actions?id=eq.${encodeURIComponent(id)}&action_type=eq.invoice&select=id,details`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }, cache: "no-store" }
    );
    if (!res.ok) throw new Error(`Журнал недоступен (${res.status})`);
    const row = (await res.json())?.[0];
    if (!row?.details?.receipt) {
      return Response.json({ error: "Чек не найден" }, { status: 404 });
    }

    const details = { ...row.details };
    if (registered) {
      details.receipt_registered_at = new Date().toISOString();
      details.receipt_registered_by = decodeURIComponent(request.headers.get("x-user-name") || "");
    } else {
      delete details.receipt_registered_at;
      delete details.receipt_registered_by;
    }

    const ok = await updateActionDetails(id, details);
    if (!ok) return Response.json({ error: "Не удалось сохранить отметку" }, { status: 502 });

    return Response.json({ success: true });
  } catch (e) {
    console.error("[/api/iiko/cashback POST]", e.message);
    return Response.json({ error: "Не удалось сохранить отметку" }, { status: 500 });
  }
}
