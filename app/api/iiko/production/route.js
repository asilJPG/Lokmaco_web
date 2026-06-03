import { createProduction } from "@/lib/iiko-web";
import { logAction } from "@/lib/supabase.js";

export async function POST(request) {
  try {
    const { items, comment, user } = await request.json();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [baseRole] = (user.role || "").split(":");
    const allowedRoles = ["admin", "prep_chef"];
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
    } else {
      await logAction(user.tg_id, user.name, "production", "СБОЙ", { ...details, error: result.error });
    }

    if (result.success) {
      return Response.json({ success: true, documentNumber: result.documentNumber });
    } else {
      return Response.json({ success: false, error: result.error }, { status: 500 });
    }
  } catch (e) {
    console.error("[/api/iiko/production]", e.message);
    try {
      const { items, comment, user } = await request.clone().json().catch(() => ({}));
      if (user) {
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
        await logAction(user.tg_id, user.name, "production", "СБОЙ", details);
      }
    } catch (_) {}
    return Response.json({ error: e.message }, { status: 500 });
  }
}
