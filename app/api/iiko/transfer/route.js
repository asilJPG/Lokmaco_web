import { createTransfer } from "@/lib/iiko-web";
import { logAction, createPendingTransfer, getPendingTransfersList, updatePendingTransfer, getPendingTransferById } from "@/lib/supabase.js";

// Helper to send Telegram notifications
async function sendTelegramAlert(message) {
  try {
    const tgToken = process.env.TG_BOT_TOKEN;
    const tgChatId = process.env.TG_CHAT_ID;
    if (tgToken && tgChatId) {
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
}

export async function GET(request) {
  try {
    const userRole = request.headers.get("x-user-role") || "";
    const tgId = request.headers.get("x-user-tg-id") || "";

    const [baseRole, userStoreId] = userRole.split(":");
    const isGlobal = ["admin", "director", "supplier"].includes(baseRole);

    const { searchParams } = new URL(request.url);
    const storeId = isGlobal ? searchParams.get("store_id") : userStoreId;

    if (!tgId) {
      return Response.json({ error: "Missing tg_id" }, { status: 400 });
    }

    const list = await getPendingTransfersList();

    // Filter list:
    // - incoming: (status === 'pending_receiver' && store_to === storeId) || (status === 'pending_sender' && store_from === storeId)
    // - returned: status === 'pending_creator' && creator_tg_id === tgId
    const incoming = list.filter(
      (item) =>
        (item.status === "pending_receiver" && String(item.store_to) === String(storeId)) ||
        (item.status === "pending_sender" && String(item.store_from) === String(storeId))
    );
    const returned = list.filter(
      (item) => item.status === "pending_creator" && String(item.creator_tg_id) === String(tgId)
    );

    return Response.json({ success: true, incoming, returned });
  } catch (e) {
    console.error("[/api/iiko/transfer GET]", e.message);
    return Response.json({ success: false, error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

export async function POST(request) {
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

    const body = await request.json();
    const {
      action,
      id,
      store_from,
      store_from_name,
      store_to,
      store_to_name,
      items,
      comment,
      receiver_comment
    } = body;

    const [baseRole, userStoreId] = (user.role || "").split(":");
    const allowedRoles = ["admin", "director", "supplier", "kitchen", "prep_chef", "bar"];
    if (!allowedRoles.includes(baseRole)) {
      return Response.json({ error: "Доступ запрещен для вашей роли" }, { status: 403 });
    }

    if (!action) {
      // 1. Initial creation (draft/pending transfer)
      if (userStoreId && store_from !== userStoreId && store_to !== userStoreId) {
        return Response.json({ error: "Вы можете перемещать товары только со своего или на свой склад" }, { status: 403 });
      }

      if (!store_from || !store_to || !items?.length) {
        return Response.json({ error: "Missing store_from, store_to or items" }, { status: 400 });
      }

      let status = "pending_receiver";
      if (userStoreId) {
        if (String(store_to) === String(userStoreId)) {
          status = "pending_sender";
        } else if (String(store_from) === String(userStoreId)) {
          status = "pending_receiver";
        }
      }

      const pendingTransfer = {
        creator_tg_id: String(user.tg_id),
        creator_name: user.name,
        creator_role: user.role,
        store_from,
        store_from_name,
        store_to,
        store_to_name,
        items: items.map(it => ({
          product_id: it.product_id,
          product_name: it.product_name,
          quantity: it.quantity,
          unit: it.unit || "шт",
          received_quantity: null
        })),
        comment: comment || "",
        status: status
      };

      const inserted = await createPendingTransfer(pendingTransfer);
      if (inserted) {
        const itemsText = items.map(it => `• ${it.product_name}: ${it.quantity} ${it.unit || "шт"}`).join("\n");
        const actionWord = status === "pending_sender" ? "ожидает выдачи / отправитель" : "ожидает подтверждения / получатель";
        const alertMsg = `⏳ *Новое перемещение (${actionWord})*\n\n` +
          `👤 *Кто создал:* ${user.name}\n` +
          `📤 *Откуда:* ${store_from_name}\n` +
          `📥 *Куда:* ${store_to_name}\n\n` +
          `📦 *Состав:* \n${itemsText}\n\n` +
          `💬 *Комментарий:* ${comment || "нет"}`;
        await sendTelegramAlert(alertMsg);

        return Response.json({ success: true, pending: true, id: inserted.id });
      } else {
        return Response.json({ error: "Не удалось создать черновик перемещения в БД" }, { status: 500 });
      }
    }

    // Process actions
    if (!id) {
      return Response.json({ error: "Missing pending transfer id" }, { status: 400 });
    }

    const pendingDoc = await getPendingTransferById(id);
    if (!pendingDoc) {
      return Response.json({ error: "Перемещение не найдено" }, { status: 404 });
    }

    const isBypassRole = ["admin", "director"].includes(baseRole);

    // Authorization checks for receiver actions
    if (["approve_by_receiver", "reject_by_receiver", "modify_by_receiver"].includes(action)) {
      if (pendingDoc.status === "pending_receiver") {
        if (!isBypassRole && String(pendingDoc.store_to) !== String(userStoreId)) {
          return Response.json({ error: "Доступ запрещен: вы не являетесь получателем этого перемещения" }, { status: 403 });
        }
      } else if (pendingDoc.status === "pending_sender") {
        if (!isBypassRole && String(pendingDoc.store_from) !== String(userStoreId)) {
          return Response.json({ error: "Доступ запрещен: вы не являетесь отправителем этого перемещения" }, { status: 403 });
        }
      } else {
        return Response.json({ error: "Неверный статус документа для этого действия" }, { status: 400 });
      }
    }

    // Authorization checks for creator actions
    if (["approve_by_creator", "reject_by_creator"].includes(action)) {
      if (!isBypassRole && String(pendingDoc.creator_tg_id) !== String(user.tg_id)) {
        return Response.json({ error: "Доступ запрещен: вы не являетесь создателем этого перемещения" }, { status: 403 });
      }
    }

    if (action === "approve_by_receiver") {
      const result = await createTransfer(store_from, store_to, items, comment || "");
      if (result.success) {
        await updatePendingTransfer(id, "accepted");
        const details = {
          store_from_name,
          store_to_name,
          items: items.map(it => ({
            product_name: it.product_name,
            quantity: it.quantity,
            unit: it.unit || "шт"
          })),
          comment: comment || ""
        };
        await logAction(user.tg_id, user.name, "transfer", result.documentNumber, details);

        const itemsText = items.map(it => `• ${it.product_name}: ${it.quantity} ${it.unit || "шт"}`).join("\n");
        const alertMsg = `✅ *Перемещение № ${result.documentNumber} принято получателем!*\n\n` +
          `👤 *Принял:* ${user.name}\n` +
          `📤 *Откуда:* ${store_from_name}\n` +
          `📥 *Куда:* ${store_to_name}\n\n` +
          `📦 *Состав:* \n${itemsText}\n\n` +
          `💬 *Комментарий:* ${comment || "нет"}`;
        await sendTelegramAlert(alertMsg);

        return Response.json({ success: true, documentNumber: result.documentNumber });
      } else {
        return Response.json({ success: false, error: result.error }, { status: 500 });
      }
    }

    if (action === "reject_by_receiver") {
      await updatePendingTransfer(id, "rejected", { receiver_comment: receiver_comment || "" });
      const details = {
        status: "rejected_by_receiver",
        store_from_name,
        store_to_name,
        items,
        comment,
        receiver_comment
      };
      await logAction(user.tg_id, user.name, "transfer_rejected", "ОТКЛОНЕНО", details);

      const alertMsg = `❌ *Перемещение ОТКЛОНЕНО получателем*\n\n` +
        `👤 *Кто отклонил:* ${user.name}\n` +
        `📤 *Откуда:* ${store_from_name}\n` +
        `📥 *Куда:* ${store_to_name}\n\n` +
        `💬 *Комментарий получателя:* ${receiver_comment || "нет"}`;
      await sendTelegramAlert(alertMsg);

      return Response.json({ success: true });
    }

    if (action === "modify_by_receiver") {
      await updatePendingTransfer(id, "pending_creator", {
        items: items,
        receiver_comment: receiver_comment || ""
      });

      const itemsText = items.map(it => {
        const diff = it.received_quantity !== null && parseFloat(it.received_quantity) !== parseFloat(it.quantity)
          ? ` (факт: *${it.received_quantity} ${it.unit}* вместо ${it.quantity} ${it.unit})`
          : ` (${it.quantity} ${it.unit})`;
        return `• ${it.product_name}:${diff}`;
      }).join("\n");
      const alertMsg = `⚠️ *Перемещение возвращено с изменениями*\n\n` +
        `👤 *Кто изменил:* ${user.name}\n` +
        `📤 *Откуда:* ${store_from_name}\n` +
        `📥 *Куда:* ${store_to_name}\n\n` +
        `📦 *Корректировки:* \n${itemsText}\n\n` +
        `💬 *Комментарий получателя:* ${receiver_comment || "нет"}`;
      await sendTelegramAlert(alertMsg);

      return Response.json({ success: true });
    }

    if (action === "approve_by_creator") {
      const prepared = items.map(it => ({
        product_id: it.product_id,
        product_name: it.product_name,
        quantity: it.received_quantity != null ? parseFloat(it.received_quantity) : parseFloat(it.quantity),
        unit: it.unit || "шт"
      })).filter(it => it.quantity > 0);

      const result = await createTransfer(store_from, store_to, prepared, receiver_comment || comment || "");
      if (result.success) {
        await updatePendingTransfer(id, "accepted");
        const details = {
          store_from_name,
          store_to_name,
          items: prepared,
          comment: comment || "",
          receiver_comment: receiver_comment || ""
        };
        await logAction(user.tg_id, user.name, "transfer", result.documentNumber, details);

        const itemsText = prepared.map(it => `• ${it.product_name}: ${it.quantity} ${it.unit || "шт"}`).join("\n");
        const alertMsg = `✅ *Снабженец принял изменения. Перемещение № ${result.documentNumber} создано!*\n\n` +
          `👤 *Утвердил:* ${user.name}\n` +
          `📤 *Откуда:* ${store_from_name}\n` +
          `📥 *Куда:* ${store_to_name}\n\n` +
          `📦 *Итоговый состав:* \n${itemsText}\n\n` +
          `💬 *Комментарий получателя:* ${receiver_comment || "нет"}`;
        await sendTelegramAlert(alertMsg);

        return Response.json({ success: true, documentNumber: result.documentNumber });
      } else {
        return Response.json({ success: false, error: result.error }, { status: 500 });
      }
    }

    if (action === "reject_by_creator") {
      await updatePendingTransfer(id, "rejected");
      const details = {
        status: "rejected_by_creator",
        store_from_name,
        store_to_name,
        items,
        comment,
        receiver_comment
      };
      await logAction(user.tg_id, user.name, "transfer_rejected", "ОТКЛОНЕНО", details);

      const alertMsg = `❌ *Изменения перемещения отклонены создателем. Перемещение отменено.*\n\n` +
        `👤 *Кто отклонил:* ${user.name}\n` +
        `📤 *Откуда:* ${store_from_name}\n` +
        `📥 *Куда:* ${store_to_name}`;
      await sendTelegramAlert(alertMsg);

      return Response.json({ success: true });
    }

    return Response.json({ error: "Invalid action" }, { status: 400 });
  } catch (e) {
    console.error("[/api/iiko/transfer POST]", e.message);
    return Response.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
