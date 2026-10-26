import { sendBackup } from "@/lib/backup";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Снять резервную копию прямо сейчас — кнопкой, не дожидаясь ночи.
 *
 * Лежит под `/api/iiko/`, чтобы middleware проверил сессию: так админу не
 * нужно таскать `CRON_SECRET` в адресной строке.
 */
export async function GET(request) {
  try {
    const userId = request.headers.get("x-user-id");
    const [baseRole] = (request.headers.get("x-user-role") || "").split(":");

    if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (baseRole !== "admin") {
      return Response.json({ error: "Доступ только для администратора" }, { status: 403 });
    }

    const result = await sendBackup();
    return Response.json(result, { status: result.error ? 502 : 200 });
  } catch (e) {
    console.error("[/api/iiko/backup]", e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
