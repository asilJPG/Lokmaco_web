/**
 * POST /api/iiko/transfer
 *
 * Mirrors bot.py import_transfer():
 *   Uses iikoWeb API to create INTERNAL_TRANSFER
 *   auth → create DRAFT → load → save as PROCESSED
 *
 * Body: {
 *   store_from: "UUID" (usually MAIN_STORE_ID),
 *   store_to: "UUID" (Кухня or Бар),
 *   items: [{product_id, quantity}],
 *   comment: "optional"
 * }
 */

import { createTransfer } from "@/lib/iiko-web";
import { logAction } from "@/lib/supabase.js";

export async function POST(request) {
  try {
    const { store_from, store_from_name, store_to, store_to_name, items, comment, user } = await request.json();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [baseRole, userStoreId] = (user.role || "").split(":");
    const allowedRoles = ["admin", "director", "supplier", "kitchen", "prep_chef", "bar"];
    if (!allowedRoles.includes(baseRole)) {
      return Response.json({ error: "Доступ запрещен для вашей роли" }, { status: 403 });
    }

    if (userStoreId && store_from !== userStoreId && store_to !== userStoreId) {
      return Response.json({ error: "Вы можете перемещать товары только со своего или на свой склад" }, { status: 403 });
    }

    if (!store_from || !store_to || !items?.length) {
      return Response.json({ error: "Missing store_from, store_to or items" }, { status: 400 });
    }

    const result = await createTransfer(store_from, store_to, items, comment || "");

    if (result.success) {
      if (user) {
        const details = {
          store_from_name: store_from_name || "Неизвестный склад",
          store_to_name: store_to_name || "Неизвестный склад",
          items: items.map(it => ({
            product_name: it.product_name || "Товар",
            quantity: it.quantity,
            unit: it.unit || "шт"
          })),
          comment: comment || "",
        };
        await logAction(user.tg_id, user.name, "transfer", result.documentNumber, details);
      }
      return Response.json({ success: true, documentNumber: result.documentNumber });
    } else {
      return Response.json({ success: false, error: result.error }, { status: 500 });
    }
  } catch (e) {
    console.error("[/api/iiko/transfer]", e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
