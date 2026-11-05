import { getActionsList } from "@/lib/supabase.js";

export const dynamic = "force-dynamic";

/**
 * Реквизиты чека закупки видит только админ: снабженец о том, что чеки
 * читаются для кешбэка, знать не должен. Вырезаем на сервере — скрыть
 * поле в интерфейсе мало, оно всё равно уехало бы в ответе.
 */
function withoutReceipt(action) {
  if (!action?.details || typeof action.details !== "object" || !("receipt" in action.details)) {
    return action;
  }
  const { receipt, ...details } = action.details;
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
