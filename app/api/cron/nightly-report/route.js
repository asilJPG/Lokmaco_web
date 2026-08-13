import { buildNightlyReport } from "@/lib/nightly-report";
import { sendTelegramText } from "@/lib/telegram";

export const dynamic = "force-dynamic";
// Четыре OLAP-запроса плюс возможные повторы: короткого лимита не хватит.
export const maxDuration = 300;

const REPORT_CHAT_ID = process.env.TG_REPORT_CHAT_ID || process.env.TG_CHAT_ID || "";

/**
 * Ночной отчёт. Раньше его слал Python-бот со своего сервера; теперь считает
 * сайт по расписанию, а бот нужен только как учётка для отправки — постоянный
 * процесс Telegram не требует.
 *
 * Лежит вне `/api/iiko/`, потому что вызывается планировщиком без сессии.
 * Доступ по секрету: Vercel Cron шлёт `Authorization: Bearer $CRON_SECRET`.
 */
async function handle(request) {
  const secret = process.env.CRON_SECRET || "";
  const auth = request.headers.get("authorization") || "";

  if (!secret) {
    console.error("[nightly] CRON_SECRET не задан — эндпоинт закрыт");
    return Response.json({ error: "Not configured" }, { status: 503 });
  }
  if (auth !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!REPORT_CHAT_ID) {
    console.error("[nightly] не задан TG_REPORT_CHAT_ID");
    return Response.json({ error: "Не указан чат для отчёта" }, { status: 503 });
  }

  try {
    const report = await buildNightlyReport();

    // Два сообщения намеренно: касса и топ вместе перебивают лимит Telegram
    const okCash = await sendTelegramText(REPORT_CHAT_ID, report.cash);
    const okTop = await sendTelegramText(REPORT_CHAT_ID, report.top);

    return Response.json({
      success: okCash && okTop,
      date: report.date,
      attempts: report.attempts,
    });
  } catch (e) {
    console.error("[nightly]", e.message);
    // О сбое сообщаем в тот же чат — иначе отчёт молча пропадёт
    await sendTelegramText(REPORT_CHAT_ID, `❌ Ночной отчёт не собрался: ${e.message}`);
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
