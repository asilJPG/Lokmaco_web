import { withIikoSession, iikoPostXml } from "@/lib/iiko";
import { logAction } from "@/lib/supabase.js";

export async function POST(request) {
  try {
    const { store_id, store_name, items, comment, user } = await request.json();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [baseRole, userStoreId] = (user.role || "").split(":");
    const allowedRoles = ["admin", "director", "kitchen", "prep_chef", "bar"];
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
    const tashkent = new Date(now.getTime() + 5 * 60 * 60 * 1000);
    const dn = `INV-${formatCompact(tashkent)}`;
    const dateStr = formatDMY(tashkent);

    const itemsXml = items
      .map((it) => `<item><product>${it.product_id || ""}</product><amount>${it.quantity || 0}</amount></item>`)
      .join("");

    const commentXml = comment ? `<comment>${escapeXml(comment)}</comment>` : "";

    const xml = `<?xml version="1.0" encoding="UTF-8"?><document><documentNumber>${dn}</documentNumber><dateIncoming>${dateStr}</dateIncoming><useDefaultDocumentTime>false</useDefaultDocumentTime><defaultStore>${store_id}</defaultStore>${commentXml}<items>${itemsXml}</items></document>`;

    const success = await withIikoSession(async (token) => {
      return await iikoPostXml("documents/import/incomingInventory", xml, token);
    });

    if (success) {
      if (user) {
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
      }
      return Response.json({ success: true, documentNumber: dn });
    } else {
      return Response.json({ success: false, error: "iiko rejected the inventory document" }, { status: 500 });
    }
  } catch (e) {
    console.error("[/api/iiko/inventory]", e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function formatCompact(d) {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
}

function formatDMY(d) {
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
}

function escapeXml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
