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

        /*
        // Send Telegram notification
        try {
          const tgToken = process.env.TG_BOT_TOKEN;
          const tgChatId = process.env.TG_CHAT_ID;
          if (tgToken && tgChatId) {
            const itemsText = items.map(it => `• ${it.product_name || "Товар"}: ${it.quantity} ${it.unit || "шт"}`).join("\n");
            const roleMap = {
              admin: "Администратор",
              director: "Директор",
              supplier: "Снабженец",
              kitchen: "Шеф-повар",
              prep_chef: "Смесь-повар",
              bar: "Бармен",
              cashier: "Кассир"
            };
            const userRole = roleMap[user.role.split(":")[0]] || user.role;
            const commentText = comment ? comment.trim() : "нет";
            
            const message = `🔄 *Внутреннее перемещение № ${result.documentNumber}*\n\n` +
              `👤 *Кто:* ${user.name} (${userRole})\n` +
              `📤 *Откуда:* ${store_from_name || "Неизвестный склад"}\n` +
              `📥 *Куда:* ${store_to_name || "Неизвестный склад"}\n\n` +
              `📦 *Состав:* \n${itemsText}\n\n` +
              `💬 *Комментарий:* ${commentText}`;

            await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: tgChatId,
                text: message,
                parse_mode: "Markdown",
              }),
            });
          }
        } catch (tgError) {
          console.error("Failed to send Telegram notification:", tgError.message);
        }
        */
      }
      return Response.json({ success: true, documentNumber: result.documentNumber });
    } else {
      if (user) {
        const details = {
          status: "failed",
          error: result.error || "Неизвестная ошибка iiko",
          store_from,
          store_from_name: store_from_name || "Неизвестный склад",
          store_to,
          store_to_name: store_to_name || "Неизвестный склад",
          items: items.map(it => ({
            product_id: it.product_id,
            product_name: it.product_name || "Товар",
            quantity: it.quantity,
            unit: it.unit || "шт"
          })),
          comment: comment || "",
        };
        await logAction(user.tg_id, user.name, "transfer", "СБОЙ", details);
      }
      return Response.json({ success: false, error: result.error }, { status: 500 });
    }
  } catch (e) {
    console.error("[/api/iiko/transfer]", e.message);
    try {
      const { store_from, store_from_name, store_to, store_to_name, items, comment, user } = await request.clone().json().catch(() => ({}));
      if (user) {
        const details = {
          status: "failed",
          error: e.message,
          store_from,
          store_from_name: store_from_name || "Неизвестный склад",
          store_to,
          store_to_name: store_to_name || "Неизвестный склад",
          items: (items || []).map(it => ({
            product_id: it.product_id,
            product_name: it.product_name || "Товар",
            quantity: it.quantity,
            unit: it.unit || "шт"
          })),
          comment: comment || "",
        };
        await logAction(user.tg_id, user.name, "transfer", "СБОЙ", details);
      }
    } catch (_) {}
    return Response.json({ error: e.message }, { status: 500 });
  }
}
