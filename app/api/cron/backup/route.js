import { sendBackup } from "@/lib/backup";
import { sendTelegramText } from "@/lib/telegram";

export const dynamic = "force-dynamic";
// Выгрузка всех таблиц страницами по тысяче — короткого лимита не хватит.
export const maxDuration = 300;

const REPORT_CHAT_ID = String(process.env.TG_REPORT_CHAT_ID || "").trim();
const REPORT_BOT_TOKEN = String(process.env.TG_REPORT_BOT_TOKEN || "").trim();

/**
 * Ночная резервная копия базы.
 *
 * Лежит вне `/api/iiko/`, потому что вызывается планировщиком без сессии.
 * Доступ по секрету: Vercel Cron шлёт `Authorization: Bearer $CRON_SECRET`.
 */
async function handle(request) {
  // Значение из панели окружения легко приезжает с пробелом на конце —
  // сравнение по сырому значению тогда не сходится.
  const secret = String(process.env.CRON_SECRET || "").trim();
  const auth = String(request.headers.get("authorization") || "").trim();

  if (!secret) {
    console.error("[backup] CRON_SECRET не задан — эндпоинт закрыт");
    return Response.json({ error: "Not configured" }, { status: 503 });
  }
  if (auth !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await sendBackup();

    // О несделанной копии надо узнать сразу, а не когда она понадобится.
    if (result.error && REPORT_CHAT_ID) {
      await sendTelegramText(REPORT_CHAT_ID, `❌ Резервная копия не ушла: ${result.error}`, REPORT_BOT_TOKEN);
    }

    return Response.json(result, { status: result.error ? 502 : 200 });
  } catch (e) {
    console.error("[backup]", e.message);
    if (REPORT_CHAT_ID) {
      await sendTelegramText(REPORT_CHAT_ID, `❌ Резервная копия не собралась: ${e.message}`, REPORT_BOT_TOKEN);
    }
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
