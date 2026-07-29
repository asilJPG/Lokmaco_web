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
    const { store_id, store_name, items, comment } = body;

    const [baseRole, userStoreId] = (user.role || "").split(":");
    const allowedRoles = ["admin", "director", "kitchen", "prep_chef", "bar", "supplier"];
    if (!allowedRoles.includes(baseRole)) {
      return Response.json({ error: "Доступ запрещен для вашей роли" }, { status: 403 });
    }

    if (userStoreId && store_id !== userStoreId) {
      return Response.json({ error: "Вы можете проводить инвентаризацию только на своем складе" }, { status: 403 });
    }

    if (!store_id || !items?.length) {
      return Response.json({ error: "Missing store_id or items" }, { status: 400 });
    }

    const now = new Date();
    // Tashkent time (+5 hours)
    const tashkent = new Date(now.getTime() + 5 * 60 * 60 * 1000);
    const dn = `INV-${formatCompact(tashkent)}`;
    const dateStr = formatDMY(tashkent);

    // Using corrected <productId> and <amountContainer> tags with XML escaping
    const itemsXml = items
      .map((it) => `<item><productId>${escapeXml(String(it.product_id || ""))}</productId><amountContainer>${escapeXml(String(it.quantity || 0))}</amountContainer></item>`)
      .join("");

    const commentXml = comment ? `<comment>${escapeXml(comment)}</comment>` : "";

    // Corrected tag name: <storeId> instead of <defaultStore>!
    const xml = `<?xml version="1.0" encoding="UTF-8"?><document><documentNumber>${dn}</documentNumber><dateIncoming>${dateStr}</dateIncoming><useDefaultDocumentTime>false</useDefaultDocumentTime><storeId>${escapeXml(String(store_id))}</storeId>${commentXml}<items>${itemsXml}</items></document>`;

    const success = await withIikoSession(async (token) => {
      return await iikoPostXml("documents/import/incomingInventory", xml, token);
    });

    if (success) {
      const details = {
        store_name: store_name || "Неизвестный склад",
        items: items.map(it => ({
          product_name: it.product_name || "Товар",
          quantity: it.quantity,
          unit: it.unit || "шт"
        })),
        comment: comment || "",
      };
      await logAction(user.tg_id, user.name, "inventory", dn, details);
      return Response.json({ success: true, documentNumber: dn });
    } else {
      const details = {
        status: "failed",
        error: "iiko rejected the inventory document",
        store_id,
        store_name: store_name || "Неизвестный склад",
        items: items.map(it => ({
          product_id: it.product_id,
          product_name: it.product_name || "Товар",
          quantity: it.quantity,
          unit: it.unit || "шт"
        })),
        comment: comment || "",
      };
      await logAction(user.tg_id, user.name, "inventory", "СБОЙ", details);
      return Response.json({ success: false, error: "iiko rejected the inventory document" }, { status: 500 });
    }
  } catch (e) {
    console.error("[/api/iiko/inventory]", e.message);
    try {
      const userId = request.headers.get("x-user-id");
      const userRole = request.headers.get("x-user-role") || "";
      const userTgId = request.headers.get("x-user-tg-id") || "";
      const userName = decodeURIComponent(request.headers.get("x-user-name") || "");
      
      if (userId) {
        const { store_id, store_name, items, comment } = body || {};
        const details = {
          status: "failed",
          error: e.message,
          store_id: store_id || "",
          store_name: store_name || "Неизвестный склад",
          items: (items || []).map(it => ({
            product_id: it.product_id,
            product_name: it.product_name || "Товар",
            quantity: it.quantity,
            unit: it.unit || "шт"
          })),
          comment: comment || "",
        };
        await logAction(userTgId, userName, "inventory", "СБОЙ", details);
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
