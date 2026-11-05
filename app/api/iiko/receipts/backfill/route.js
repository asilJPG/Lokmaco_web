import { updateActionDetails } from "@/lib/supabase.js";
import { readReceiptFromPhotos, invoicePhotosOf } from "@/lib/receipt-ocr.js";
import { sendReceiptNote, receiptChannelConfigured } from "@/lib/telegram.js";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_KEY = process.env.SUPABASE_KEY || "";

// Чтение идёт в несколько потоков: чек читается до нескольких секунд, и по
// одному на всё не хватало времени — прогон по 86 приходам упирался в лимит.
const READ_CONCURRENCY = 4;
// Новые чеки не начинаем читать позже этого: чтение одного может занять до
// ~100 с (две модели, два снимка), а после него ещё идёт отправка в канал.
const READ_BUDGET_MS = 120_000;
// Отправку после этого не начинаем — запас до лимита функции.
const SEND_DEADLINE_MS = 270_000;
// Telegram режет частоту отправки в один чат — между сообщениями пауза.
const SEND_GAP_MS = 1200;

const pad = (n) => String(n).padStart(2, "0");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Время прихода в Ташкенте: «05.11.2026 14:32:05», как в остальных сообщениях. */
function tashkent(iso) {
  const d = new Date(new Date(iso).getTime() + 5 * 60 * 60 * 1000);
  return (
    `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
  );
}

/**
 * Разовая обработка старых приходов: прочитать реквизиты чека по фото накладной
 * и отправить их в канал бухгалтерии. Фото берутся из хранилища, а если их
 * там уже нет — из Telegram по расписке.
 *
 * Запрос: `?since=2026-10-25` (по Ташкенту, по умолчанию 25.10.2026).
 *   `dry=1`   — только прочитать и показать, в канал не слать и ничего не писать
 *   `retry=1` — перечитать и те приходы, где в прошлый раз реквизитов не нашли
 *   `resend=1` — отправить в канал ещё раз всё уже найденное (например, после
 *                смены формата сообщения). Реквизиты берутся из журнала, ничего
 *                не перечитывается. Старые сообщения в канале при этом остаются.
 *
 * Запускать можно сколько угодно раз: уже отправленное пропускается, прочитанное
 * без результата помечено и не перечитывается. Если не хватило времени, ответ
 * придёт с `done: false` — достаточно открыть ссылку ещё раз.
 *
 * Прочитанное по тексту (а не по QR) уходит в канал вместе с фото накладной:
 * нейросеть может ошибиться в цифре, и сверить надо глазами.
 */
export async function GET(request) {
  try {
    const userId = request.headers.get("x-user-id");
    const [baseRole] = (request.headers.get("x-user-role") || "").split(":");
    if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (baseRole !== "admin") {
      return Response.json({ error: "Доступ только для администратора" }, { status: 403 });
    }

    const params = new URL(request.url).searchParams;
    const since = /^\d{4}-\d{2}-\d{2}$/.test(params.get("since") || "") ? params.get("since") : "2026-10-25";
    const dry = params.get("dry") === "1";
    const retry = params.get("retry") === "1";
    const resend = params.get("resend") === "1";

    // Без канала «отправлено» насчиталось бы по нулям на каждый приход
    if (!dry && !receiptChannelConfigured()) {
      return Response.json(
        { error: "Не задан TG_RECEIPT_CHAT_ID (или токен бота) — отправлять некуда. Для пробы без отправки добавьте &dry=1" },
        { status: 503 }
      );
    }

    const sinceIso = new Date(`${since}T00:00:00+05:00`).toISOString();
    const url =
      `${SUPABASE_URL}/rest/v1/bot_actions?action_type=eq.invoice` +
      `&created_at=gte.${encodeURIComponent(sinceIso)}` +
      `&select=id,created_at,details&order=created_at.asc&limit=1000`;
    // no-store: обычный fetch Next кеширует между запросами и выкатами —
    // повторный запуск видел бы журнал, каким он был при самом первом
    const res = await fetch(url, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      cache: "no-store",
    });
    if (!res.ok) {
      return Response.json({ error: `Не удалось прочитать журнал (${res.status})` }, { status: 502 });
    }
    const rows = await res.json();

    const started = Date.now();
    const stat = {
      since,
      dry,
      resend,
      total: rows.length,
      failedInvoices: 0,
      alreadySent: 0,
      skippedNoReceipt: 0,
      foundQr: 0,
      foundText: 0,
      sent: 0,
      sendFailed: 0,
      notFound: 0,
      left: 0,
    };

    // 1. Что вообще надо обработать
    const todo = [];
    for (const row of rows) {
      const d = row.details && typeof row.details === "object" ? row.details : {};
      if (d.status === "failed") { stat.failedInvoices++; continue; }
      // Повторная отправка: нужны только приходы с уже прочитанными реквизитами
      if (resend) {
        if (!d.receipt) { stat.skippedNoReceipt++; continue; }
        todo.push({ row, d, receipt: d.receipt, read: true });
        continue;
      }
      if (d.receipt_sent) { stat.alreadySent++; continue; }
      if (!d.receipt && d.receipt_checked_at && !retry) { stat.skippedNoReceipt++; continue; }
      todo.push({ row, d, receipt: d.receipt || null, read: Boolean(d.receipt) });
    }

    // 2. Чтение в несколько потоков. Не успели по времени — остальное в `left`.
    let next = 0;
    async function worker() {
      while (true) {
        const i = next++;
        if (i >= todo.length) return;
        if (Date.now() - started > READ_BUDGET_MS) return;
        const item = todo[i];
        if (!item.read) {
          item.receipt = await readReceiptFromPhotos(item.d.photos);
          item.read = true;
        }
      }
    }
    await Promise.all(Array.from({ length: READ_CONCURRENCY }, worker));

    // 3. Дальше по порядку — чтобы сообщения в канале шли по хронологии
    const found = [];
    for (const item of todo) {
      if (!item.read) { stat.left++; continue; }

      const { row, d, receipt } = item;
      if (!receipt) {
        stat.notFound++;
        if (!dry) await updateActionDetails(row.id, { ...d, receipt_checked_at: new Date().toISOString() });
        continue;
      }

      // Из уже сохранённых реквизитов источник не считаем «новым» нахождением
      if (!d.receipt) {
        if (receipt.source === "qr") stat.foundQr++;
        else stat.foundText++;
      }

      const when = tashkent(row.created_at);
      found.push({ at: when, source: receipt.source, fm: receipt.fm, sign: receipt.sign });
      if (dry) continue;

      if (Date.now() - started > SEND_DEADLINE_MS) { stat.left++; continue; }

      // Сначала сохраняем прочитанное — если отправка оборвётся, следующий
      // запуск возьмёт реквизиты из журнала и не станет читать заново.
      if (!d.receipt) {
        await updateActionDetails(row.id, {
          ...d,
          receipt,
          receipt_checked_at: new Date().toISOString(),
        });
      }

      const sent = await sendReceiptNote({
        receipt,
        dateTime: when,
        photos: invoicePhotosOf(d.photos),
      });
      if (sent) {
        stat.sent++;
        await updateActionDetails(row.id, {
          ...d,
          receipt,
          receipt_checked_at: new Date().toISOString(),
          receipt_sent: true,
          ...(resend ? { receipt_resent_at: new Date().toISOString() } : {}),
        });
      } else {
        stat.sendFailed++;
      }

      await sleep(SEND_GAP_MS);
    }

    return Response.json({
      success: true,
      done: stat.left === 0,
      ...stat,
      tookSec: Math.round((Date.now() - started) / 1000),
      found,
    });
  } catch (e) {
    console.error("[/api/iiko/receipts/backfill]", e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
