import { getActionsList } from "@/lib/supabase.js";

export const dynamic = "force-dynamic";

/**
 * Реквизиты чека закупки видит только админ: снабженец о том, что чеки
 * читаются для кешбэка, знать не должен. Вырезаем на сервере — скрыть
 * поле в интерфейсе мало, оно всё равно уехало бы в ответе.
 */
function withoutReceipt(action) {
  const d = action?.details;
  if (!d || typeof d !== "object") return action;
  if (!("receipt" in d) && !("receipt_sent" in d) && !("receipt_checked_at" in d)) return action;
  // eslint-disable-next-line no-unused-vars
  const { receipt, receipt_sent, receipt_checked_at, ...details } = d;
  return { ...action, details };
}

export async function GET(request) {
  try {
    const [baseRole] = (request.headers.get("x-user-role") || "").split(":");
    const list = await getActionsList();
    const history = baseRole === "admin" ? list : list.map(withoutReceipt);
    return Response.json({ success: true, history });
  } catch (e) {
    console.error("[/api/iiko/history] error:", e.message);
    return Response.json({ success: false, error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
