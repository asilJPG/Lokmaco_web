import { withIikoSession, iikoPostXml } from "@/lib/iiko";
import { logAction } from "@/lib/supabase.js";

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
    const { store_id, store_name, supplier_id, supplier_name, account_id, account_name, sum, comment } = body;

    const [baseRole, userStoreId] = (user.role || "").split(":");
    const allowedRoles = ["admin", "director", "supplier"];
    if (!allowedRoles.includes(baseRole)) {
      return Response.json({ error: "Доступ запрещен для вашей роли" }, { status: 403 });
    }

    if (userStoreId && store_id !== userStoreId) {
      return Response.json({ error: "Вы можете оформлять акты только на свой склад" }, { status: 403 });
    }

    if (!store_id || !account_id || !sum) {
      return Response.json({ error: "Не все обязательные поля заполнены" }, { status: 400 });
    }

    const sumVal = parseFloat(sum) || 0;
    if (sumVal <= 0) {
      return Response.json({ error: "Сумма услуги должна быть больше нуля" }, { status: 400 });
    }

    // Date calculations (UTC+5 Tashkent offset)
    const now = new Date();
    const tashkent = new Date(now.getTime() + 5 * 60 * 60 * 1000);
    const dateStr = formatDMY(tashkent);
    const dn = "Автоматический";

    // Build XML
    // Supplier: 'Представительские' (f94a2411-4e2a-4d0a-a3c5-f5a4d4e0042d) by default or if role is supplier
    // Product: 'Транспорт расходы' (69aab99f-deeb-4bf1-804b-0b13373910a0)
    const isSupplierRole = baseRole === "supplier";
    const supplierId = isSupplierRole ? "f94a2411-4e2a-4d0a-a3c5-f5a4d4e0042d" : (supplier_id || "f94a2411-4e2a-4d0a-a3c5-f5a4d4e0042d");
    const supplierName = isSupplierRole ? "Представительские" : (supplier_name || "Представительские");
    const productId = "69aab99f-deeb-4bf1-804b-0b13373910a0";

    const itemsXml = `<item><num>1</num><product>${escapeXml(productId)}</product><amount>1</amount><price>${escapeXml(String(sumVal))}</price><sum>${escapeXml(String(sumVal))}</sum><store>${escapeXml(String(store_id))}</store></item>`;

    const finalComment = `[Счет: ${account_name}] ${comment || ""} (Создал: ${user.name}) (Сгенерировано через сайт)`.trim();
    const commentXml = `<comment>${escapeXml(finalComment)}</comment>`;

    const xml = `<?xml version="1.0" encoding="UTF-8"?><document><dateIncoming>${dateStr}</dateIncoming><useDefaultDocumentTime>false</useDefaultDocumentTime><defaultStore>${escapeXml(String(store_id))}</defaultStore><supplier>${escapeXml(supplierId)}</supplier>${commentXml}<items>${itemsXml}</items></document>`;

    const success = await withIikoSession(async (token) => {
      return await iikoPostXml("documents/import/incomingInvoice", xml, token);
    });

    const details = {
      supplier_id: supplierId,
      supplier_name: supplierName,
      store_id: store_id,
      store_name: store_name || "Неизвестный склад",
      account_id: account_id,
      account_name: account_name,
      sum: sumVal,
      comment: finalComment,
    };

    if (success) {
      await logAction(user.tg_id, user.name, "services", dn, details);
      return Response.json({ success: true, documentNumber: dn });
    } else {
      await logAction(user.tg_id, user.name, "services", "СБОЙ", details);
      return Response.json({ success: false, error: "iiko rejected the document" }, { status: 500 });
    }
  } catch (e) {
    console.error("[/api/iiko/services]", e.message);
    try {
      const userId = request.headers.get("x-user-id");
      const userRole = request.headers.get("x-user-role") || "";
      const userTgId = request.headers.get("x-user-tg-id") || "";
      const userName = decodeURIComponent(request.headers.get("x-user-name") || "");

      if (userId) {
        const { store_id, store_name, account_id, account_name, sum, comment } = body || {};
        const details = {
          error: e.message,
          store_id: store_id || "",
          store_name: store_name || "Неизвестный склад",
          account_id: account_id || "",
          account_name: account_name || "",
          sum: parseFloat(sum) || 0,
          comment: comment || "",
        };
        await logAction(userTgId, userName, "services", "СБОЙ", details);
      }
    } catch (_) {}
    return Response.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function formatDMY(d) {
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

function escapeXml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
