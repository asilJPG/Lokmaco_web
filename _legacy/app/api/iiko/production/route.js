import { createProduction } from "@/lib/iiko-web";
import { logAction } from "@/lib/supabase.js";

export async function POST(request) {
  let body = {};
  try {
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role") || "";
    const userTgId = request.headers.get("x-user-tg-id") || "";
    const userName = decodeURIComponent(request.headers.get("x-user-name") || "");

    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = {
      id: userId,
      role: userRole,
      tg_id: userTgId,
      name: userName
    };

    body = await request.json();
    const { items, comment } = body;

    const [baseRole] = (user.role || "").split(":");
    const allowedRoles = ["admin", "prep_chef", "bar"];
    if (!allowedRoles.includes(baseRole)) {
      return Response.json({ error: "Доступ запрещен для вашей роли" }, { status: 403 });
    }

    const result = await createProduction(items, comment);

    const details = {
      items: items.map(it => ({
        product_id: it.product_id,
        product_name: it.product_name,
        quantity: it.quantity,
        unit: it.unit,
        code: it.code,
      })),
      comment: comment || "",
    };

    if (result.success) {
      await logAction(user.tg_id, user.name, "production", result.documentNumber || "PROD", details);
      return Response.json({ success: true, documentNumber: result.documentNumber });
    } else {
      await logAction(user.tg_id, user.name, "production", "СБОЙ", { ...details, error: result.error });
      return Response.json({ success: false, error: result.error }, { status: 500 });
    }
  } catch (e) {
    console.error("[/api/iiko/production]", e.message);
    try {
      const userId = request.headers.get("x-user-id");
      const userRole = request.headers.get("x-user-role") || "";
      const userTgId = request.headers.get("x-user-tg-id") || "";
      const userName = decodeURIComponent(request.headers.get("x-user-name") || "");

      if (userId) {
        const { items, comment } = body || {};
        const details = {
          error: e.message,
          items: (items || []).map(it => ({
            product_id: it.product_id,
            product_name: it.product_name || "Товар",
            quantity: it.quantity,
            unit: it.unit || "шт",
            code: it.code || "",
          })),
          comment: comment || "",
        };
        await logAction(userTgId, userName, "production", "СБОЙ", details);
      }
    } catch (_) {}
    return Response.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
