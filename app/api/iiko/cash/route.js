import { logAction } from "@/lib/supabase.js";

export async function POST(request) {
  try {
    const { cash, card, online, surplus, shortage, comment, user } = await request.json();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const tashkent = new Date(now.getTime() + 5 * 60 * 60 * 1000);
    const dn = `CSH-${formatCompact(tashkent)}`;

    const details = {
      cash: parseFloat(cash) || 0,
      card: parseFloat(card) || 0,
      online: parseFloat(online) || 0,
      surplus: parseFloat(surplus) || 0,
      shortage: parseFloat(shortage) || 0,
      comment: comment || "",
    };

    const success = await logAction(user.tg_id, user.name, "cash", dn, details);

    if (success) {
      return Response.json({ success: true, documentNumber: dn });
    } else {
      return Response.json({ success: false, error: "Failed to save cash report" }, { status: 500 });
    }
  } catch (e) {
    console.error("[/api/iiko/cash]", e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function formatCompact(d) {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
}
