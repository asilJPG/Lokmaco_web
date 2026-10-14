import { sweepDeliveredPhotos, purgeBucket } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Уборка хранилища фотографий.
 *
 * Снимки живут в бакете только до отправки в Telegram — обычно их удаляет сам
 * роут прихода. Сюда попадают хвосты: `mode=sweep` сносит то, у чего есть
 * расписка Telegram, `mode=all` выносит бакет подчистую (разовая операция по
 * старым приходам, снимки которых давно лежат в группе).
 */
async function handle(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = request.headers.get("x-user-id");
    const [baseRole] = (request.headers.get("x-user-role") || "").split(":");
    const authHeader = String(request.headers.get("authorization") || "").trim();
    const cronSecret = String(process.env.CRON_SECRET || "").trim();
    const querySecret = String(searchParams.get("secret") || "").trim();

    const isCron = Boolean(cronSecret && (authHeader === `Bearer ${cronSecret}` || querySecret === cronSecret));
    const isAdmin = Boolean(userId && baseRole === "admin");

    if (!isAdmin && !isCron) {
      return Response.json({ error: "Доступ только для администратора" }, { status: 403 });
    }

    const mode = String(searchParams.get("mode") || "sweep");

    // Полная зачистка необратима, поэтому её не дадим запустить расписанию:
    // только администратор руками.
    if (mode === "all") {
      if (!isAdmin) {
        return Response.json({ error: "Полная зачистка — только вручную админом" }, { status: 403 });
      }
      // Укладываемся в лимит функции с запасом: если не успели — вернём
      // done: false, и вызов повторяют, пока не станет true.
      const result = await purgeBucket({ budgetMs: 200_000 });
      return Response.json({ mode, ...result });
    }

    const days = Math.max(0, parseInt(searchParams.get("days") || "0", 10) || 0);
    const result = await sweepDeliveredPhotos({ days });

    return Response.json(result);
  } catch (e) {
    console.error("[cleanup-photos]", e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
