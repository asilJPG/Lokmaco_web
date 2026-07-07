import { createWriteoff } from "@/lib/iiko";
import { logAction } from "@/lib/supabase";

export const dynamic = "force-dynamic";

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
    const { items, comment, storeId, accountId } = body;

    const [baseRole, userStoreId] = (user.role || "").split(":");
    const allowedRoles = ["admin", "bar"];
    if (!allowedRoles.includes(baseRole)) {
      return Response.json({ error: "Доступ запрещен для вашей роли" }, { status: 403 });
    }

    const targetStoreId = userStoreId || storeId;
    if (!targetStoreId) {
      return Response.json({ error: "Не указан склад для проведения акта" }, { status: 400 });
    }

    let targetAccountId = "6f983109-eb1f-4517-917b-9912d5eeda16"; // Пищевые потери и списания
    if (baseRole === "admin" && accountId) {
      targetAccountId = accountId;
    }

    const result = await createWriteoff(targetStoreId, items, comment, targetAccountId);

    const details = {
      items: items.map(it => ({
        product_id: it.product_id,
        product_name: it.product_name,
        quantity: it.quantity,
        unit: it.unit,
        code: it.code,
      })),
      comment: comment || "",
      store_id: targetStoreId,
      account_id: targetAccountId,
    };

    if (result.success) {
      await logAction(user.tg_id, user.name, "writeoff", result.documentNumber || "WRITEOFF", details);
      return Response.json({ success: true, documentNumber: result.documentNumber });
    } else {
      await logAction(user.tg_id, user.name, "writeoff", "СБОЙ", { ...details, error: result.error });
      return Response.json({ success: false, error: result.error }, { status: 500 });
    }
  } catch (e) {
    console.error("[/api/iiko/writeoff]", e.message);
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
        await logAction(userTgId, userName, "writeoff", "СБОЙ", details);
      }
    } catch (logErr) {
      console.error("Failed to log writeoff failure action:", logErr.message);
    }
    return Response.json({ error: e.message }, { status: 500 });
  }
}
