import { withIikoSession, iikoPostXml } from "@/lib/iiko";
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
    const { supplier_id, supplier_name, store_id, store_name, items, comment } = body;

    const [baseRole, userStoreId] = (user.role || "").split(":");
    const allowedRoles = ["admin", "director", "supplier"];
    if (!allowedRoles.includes(baseRole)) {
      return Response.json({ error: "Доступ запрещен для вашей роли" }, { status: 403 });
    }

    if (userStoreId && store_id !== userStoreId) {
      return Response.json({ error: "Вы можете оформлять приходы только на свой склад" }, { status: 403 });
    }

    if (!supplier_id || !store_id || !items?.length) {
      return Response.json({ error: "Missing supplier_id, store_id or items" }, { status: 400 });
    }

    // Generate document number (same format as bot.py)
    const now = new Date();
    // UTC+5 for Tashkent
    const tashkent = new Date(now.getTime() + 5 * 60 * 60 * 1000);
    const dn = `TG-${formatCompact(tashkent)}`;
    const dateStr = formatDMY(tashkent);

    // Build XML with security escaping
    const itemsXml = items
      .map((it, idx) => {
        const qty = it.quantity || 0;
        const price = it.price || 0;
        const sum = qty * price;
        return `<item><num>${idx + 1}</num><product>${escapeXml(String(it.product_id || ""))}</product><amount>${escapeXml(String(qty))}</amount><price>${escapeXml(String(price))}</price><sum>${escapeXml(String(sum))}</sum><store>${escapeXml(String(store_id))}</store></item>`;
      })
      .join("");

    const commentXml = comment ? `<comment>${escapeXml(comment)}</comment>` : "";

    const xml = `<?xml version="1.0" encoding="UTF-8"?><document><documentNumber>${dn}</documentNumber><dateIncoming>${dateStr}</dateIncoming><defaultStore>${escapeXml(String(store_id))}</defaultStore><supplier>${escapeXml(String(supplier_id))}</supplier>${commentXml}<items>${itemsXml}</items></document>`;

    const success = await withIikoSession(async (token) => {
      return await iikoPostXml("documents/import/incomingInvoice", xml, token);
    });

    if (success) {
      const details = {
        supplier_name: supplier_name || "Неизвестный поставщик",
        store_name: store_name || "Неизвестный склад",
        items: items.map(it => ({
          product_name: it.product_name || "Товар",
          quantity: it.quantity,
          price: it.price,
          unit: it.unit || "шт"
        })),
        comment: comment || "",
      };
      await logAction(user.tg_id, user.name, "invoice", dn, details);
      return Response.json({ success: true, documentNumber: dn });
    } else {
      const details = {
        status: "failed",
        error: "iiko rejected the document",
        supplier_id,
        supplier_name: supplier_name || "Неизвестный поставщик",
        store_id,
        store_name: store_name || "Неизвестный склад",
        items: items.map(it => ({
          product_id: it.product_id,
          product_name: it.product_name || "Товар",
          quantity: it.quantity,
          price: it.price,
          unit: it.unit || "шт"
        })),
        comment: comment || "",
      };
      await logAction(user.tg_id, user.name, "invoice", "СБОЙ", details);
      return Response.json({ success: false, error: "iiko rejected the document" }, { status: 500 });
    }
  } catch (e) {
    console.error("[/api/iiko/invoice]", e.message);
    try {
      const userId = request.headers.get("x-user-id");
      const userRole = request.headers.get("x-user-role") || "";
      const userTgId = request.headers.get("x-user-tg-id") || "";
      const userName = decodeURIComponent(request.headers.get("x-user-name") || "");
      
      if (userId) {
        const { supplier_id, supplier_name, store_id, store_name, items, comment } = body || {};
        const details = {
          status: "failed",
          error: e.message,
          supplier_id: supplier_id || "",
          supplier_name: supplier_name || "Неизвестный поставщик",
          store_id: store_id || "",
          store_name: store_name || "Неизвестный склад",
          items: (items || []).map(it => ({
            product_id: it.product_id,
            product_name: it.product_name || "Товар",
            quantity: it.quantity,
            price: it.price,
            unit: it.unit || "шт"
          })),
          comment: comment || "",
        };
        await logAction(userTgId, userName, "invoice", "СБОЙ", details);
      }
    } catch (_) {}
    return Response.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function formatCompact(d) {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
}

function formatDMY(d) {
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()} 09:00:00`;
}

function escapeXml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
