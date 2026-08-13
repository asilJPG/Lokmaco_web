import { http1Fetch } from "@/lib/iiko";
import { sendInvoiceReport } from "@/lib/telegram.js";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_KEY || "";

export const dynamic = "force-dynamic";

/**
 * Повторная отправка фотоотчёта о приходе в Telegram.
 *
 * Нужна, когда отчёт не дошёл по внешней причине — бот не был в канале,
 * переменная окружения не подхватилась, хранилище ответило ошибкой.
 * Сам приход при этом давно проведён в iiko и не трогается.
 */
export async function POST(request) {
  try {
    const userId = request.headers.get("x-user-id");
    const [baseRole] = (request.headers.get("x-user-role") || "").split(":");

    if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (baseRole !== "admin") {
      return Response.json({ error: "Доступ только для администратора" }, { status: 403 });
    }

    const { id } = await request.json();
    if (!id) return Response.json({ error: "Не указан id прихода" }, { status: 400 });

    const url = `${SUPABASE_URL}/rest/v1/bot_actions?id=eq.${id}&action_type=eq.invoice&select=*`;
    const res = await http1Fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });
    if (!res.ok) throw new Error(`Lookup failed: ${res.status}`);

    const rows = await res.json();
    const rec = rows?.[0];
    if (!rec) return Response.json({ error: "Приход не найден" }, { status: 404 });

    const details = rec.details || {};

    // Дата берётся из самой записи: отчёт описывает тот приход, а не момент
    // повторной отправки.
    const d = new Date(new Date(rec.created_at).getTime() + 5 * 60 * 60 * 1000);
    const pad = (n) => String(n).padStart(2, "0");
    const dateTime =
      `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()} ` +
      `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;

    const ok = await sendInvoiceReport({
      dateTime,
      documentNumber: `${rec.document_number || "—"} от ${dateTime}`,
      supplierName: details.supplier_name || "—",
      storeName: details.store_name || "—",
      userName: rec.user_name || "—",
      items: details.items || [],
      details,
    });

    if (!ok) {
      return Response.json(
        { error: "Telegram не принял отчёт — смотрите логи сервера" },
        { status: 502 }
      );
    }

    const photos = (details.photos || []).filter(
      (p) => p.kind === "invoice" || p.kind === "collage"
    ).length;

    return Response.json({ success: true, photos });
  } catch (e) {
    console.error("[/api/iiko/invoice/resend]", e.message);
    return Response.json({ error: "Не удалось отправить отчёт" }, { status: 500 });
  }
}
