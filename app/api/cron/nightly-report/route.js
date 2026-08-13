import { buildNightlyReport } from "@/lib/nightly-report";
import { sendTelegramText } from "@/lib/telegram";

export const dynamic = "force-dynamic";
// Четыре OLAP-запроса плюс возможные повторы: короткого лимита не хватит.
export const maxDuration = 300;

const REPORT_CHAT_ID = String(process.env.TG_REPORT_CHAT_ID || "").trim();

// У бота отчётов своя учётка, отдельная от бота сайта: он уже состоит в нужном
// чате. Если переменной нет — шлём под ботом сайта, но тогда его придётся
// добавить в чат вручную, иначе Telegram ответит «chat not found».
const REPORT_BOT_TOKEN = String(process.env.TG_REPORT_BOT_TOKEN || "").trim();

/**
 * Ночной отчёт. Раньше его слал Python-бот со своего сервера; теперь считает
 * сайт по расписанию, а бот нужен только как учётка для отправки — постоянный
 * процесс Telegram не требует.
 *
 * Лежит вне `/api/iiko/`, потому что вызывается планировщиком без сессии.
 * Доступ по секрету: Vercel Cron шлёт `Authorization: Bearer $CRON_SECRET`.
 */
async function handle(request) {
  // Значение из панели окружения легко приезжает с пробелом или переносом
  // строки на конце — сравнение по сырому значению тогда не сходится.
  const secret = String(process.env.CRON_SECRET || "").trim();
  const auth = String(request.headers.get("authorization") || "").trim();

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

    // Одно сообщение: касса и топ вместе. Разбиваем на два, только если не
    // влезаем в лимит Telegram (4096 символов) — например, в день с большим
    // меню, когда категорий и блюд много.
    const joined = `${report.cash}\n\n━━━━━━━━━━━━━━━━━━━━\n\n${report.top}`;

    let sent;
    if (joined.length <= 4000) {
      sent = await sendTelegramText(REPORT_CHAT_ID, joined, REPORT_BOT_TOKEN);
    } else {
      const okCash = await sendTelegramText(REPORT_CHAT_ID, report.cash, REPORT_BOT_TOKEN);
      const okTop = await sendTelegramText(REPORT_CHAT_ID, report.top, REPORT_BOT_TOKEN);
      sent = okCash && okTop;
    }

    return Response.json({
      success: sent,
      date: report.date,
      attempts: report.attempts,
      length: joined.length,
      split: joined.length > 4000,
    });
  } catch (e) {
    console.error("[nightly]", e.message);
    // О сбое сообщаем в тот же чат — иначе отчёт молча пропадёт
    await sendTelegramText(REPORT_CHAT_ID, `❌ Ночной отчёт не собрался: ${e.message}`, REPORT_BOT_TOKEN);
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
