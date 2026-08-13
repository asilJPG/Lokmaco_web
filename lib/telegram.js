import { createSignedUrl } from "./storage.js";

const TG_TOKEN = process.env.TG_BOT_TOKEN || "";

// Только своя переменная: запасной TG_CHAT_ID — мёртвое наследство старого
// бота, оно указывает на чат, которого бот не видит. Падать на него значило
// молча терять отчёты с ошибкой «chat not found» в логах.
// Значение из панели окружения часто приезжает с кавычками или пробелами —
// Telegram на такое отвечает «chat not found», что читается как чужой чат.
const TG_CHAT_ID = String(process.env.TG_INVOICE_CHAT_ID || "")
  .trim()
  .replace(/^["']|["']$/g, "");

const api = (method) => `https://api.telegram.org/bot${TG_TOKEN}/${method}`;

// Часть токена до двоеточия — это публичный id бота, не секрет. В логе он
// нужен, чтобы отличить «бот не в чате» от «чата нет»: Telegram на оба
// случая отвечает одинаковым «chat not found».
const BOT_ID = String(TG_TOKEN).split(":")[0] || "?";

function fmtNum(n) {
  return new Intl.NumberFormat("ru-RU").format(Math.round(Number(n) || 0));
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Что писать под фотографиями.
 *
 * "short" — только «Приход» и дата со временем. Поставщик, склад, автор,
 * состав и суммы намеренно скрыты: сообщение уходит в общий канал, и эти
 * данные там пока показывать не нужно.
 * "full" — прежняя подробная подпись, код ниже сохранён целиком.
 *
 * Чтобы вернуть подробный вариант, поменяйте значение на "full".
 */
const CAPTION_MODE = "short";

function buildShortCaption({ dateTime }) {
  return ["📦 <b>Приход</b>", escapeHtml(dateTime || "")].filter(Boolean).join("\n");
}

/** Подпись к фотоотчёту. У Telegram лимит 1024 символа на caption. */
function buildFullCaption({ documentNumber, supplierName, storeName, userName, items, details }) {
  const total = (items || []).reduce(
    (s, it) => s + (Number(it.total) || Number(it.price) * Number(it.quantity) || 0),
    0
  );

  const lines = [
    `📦 <b>Приход № ${escapeHtml(documentNumber)}</b>`,
    `${escapeHtml(supplierName)} → ${escapeHtml(storeName)}`,
    `👤 ${escapeHtml(userName)}`,
    "",
  ];

  for (const it of items || []) {
    const qty = `${it.quantity} ${it.unit || "шт"}`;
    const sum = Number(it.total) || Number(it.price) * Number(it.quantity) || 0;
    lines.push(`• ${escapeHtml(it.product_name || "Товар")} — ${qty} = ${fmtNum(sum)}`);
  }

  lines.push("", `💰 <b>Итого: ${fmtNum(total)} сум</b>`);

  if (details?.comment) lines.push(`💬 ${escapeHtml(details.comment)}`);

  if (!details?.photos_complete) {
    const miss = [];
    if (!details?.has_invoice_photo) miss.push("нет фото накладной");
    if (details?.items_without_photo?.length) {
      miss.push(`без фото: ${details.items_without_photo.join(", ")}`);
    }
    if (miss.length) lines.push(`⚠️ ${escapeHtml(miss.join("; "))}`);
  }

  let text = lines.join("\n");
  if (text.length > 1000) text = text.slice(0, 997) + "...";
  return text;
}

function buildCaption(payload) {
  return CAPTION_MODE === "full" ? buildFullCaption(payload) : buildShortCaption(payload);
}

/**
 * Отправка произвольного текста в заданный чат. Нужна ночному отчёту, который
 * идёт в свой чат, отдельный от фотоотчётов о приходах.
 */
export async function sendTelegramText(chatId, text) {
  const chat = String(chatId || "").trim().replace(/^["']|["']$/g, "");
  if (!TG_TOKEN || !chat) {
    console.error("[telegram] текст не отправлен: нет токена или чата");
    return false;
  }
  const res = await fetch(api("sendMessage"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chat,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  if (!res.ok) {
    console.error(`[telegram] sendMessage: бот ${BOT_ID} → чат ${chat}:`, res.status, await res.text());
  }
  return res.ok;
}

async function sendText(text) {
  const res = await fetch(api("sendMessage"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: TG_CHAT_ID,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  if (!res.ok) console.error(`[telegram] sendMessage: бот ${BOT_ID} → чат ${TG_CHAT_ID}:`, res.status, await res.text());
  return res.ok;
}

/**
 * Фотоотчёт о приходе в рабочую группу: первым идёт снимок накладной,
 * следом коллаж позиций. Коллаж клеит браузер при отправке — на сервере
 * нет ни sharp, ни canvas, тянуть нативный модуль ради этого не стали.
 *
 * Ошибки отправки только логируем: приход к этому моменту уже проведён,
 * и ронять его из-за недоступного Telegram нельзя.
 */
export async function sendInvoiceReport(payload) {
  try {
    if (!TG_TOKEN || !TG_CHAT_ID) {
      console.error(
        "[telegram] фотоотчёт не отправлен: не задан",
        !TG_TOKEN ? "TG_BOT_TOKEN" : "TG_INVOICE_CHAT_ID"
      );
      return false;
    }

    const photos = payload.details?.photos || [];
    const caption = buildCaption(payload);

    // Порядок фиксированный: накладная сверху, коллаж(и) снизу
    const ordered = [
      ...photos.filter((p) => p.kind === "invoice"),
      ...photos.filter((p) => p.kind === "collage"),
    ].filter((p) => p.content_type !== "application/pdf");

    if (ordered.length === 0) {
      return await sendText(caption);
    }

    // Telegram скачивает картинки сам по временной ссылке — так надёжнее,
    // чем гнать байты через наш сервер: раньше любая осечка выгрузки молча
    // превращала фотоотчёт в текстовое сообщение.
    const urls = [];
    for (const p of ordered.slice(0, 10)) {
      const url = await createSignedUrl(p.path, 3600);
      if (url) urls.push(url);
    }

    if (urls.length === 0) {
      console.error(
        `[telegram] фотографии недоступны (${ordered.length} шт.) — уходит текст`
      );
      return await sendText(caption);
    }

    if (urls.length === 1) {
      const res = await fetch(api("sendPhoto"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TG_CHAT_ID,
          photo: urls[0],
          caption,
          parse_mode: "HTML",
        }),
      });
      if (!res.ok) {
        console.error(`[telegram] sendPhoto: бот ${BOT_ID} → чат ${TG_CHAT_ID}:`, res.status, await res.text());
      }
      return res.ok;
    }

    const media = urls.map((url, i) => ({
      type: "photo",
      media: url,
      ...(i === 0 ? { caption, parse_mode: "HTML" } : {}),
    }));

    const res = await fetch(api("sendMediaGroup"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TG_CHAT_ID, media }),
    });
    if (!res.ok) {
      console.error(`[telegram] sendMediaGroup: бот ${BOT_ID} → чат ${TG_CHAT_ID}:`, res.status, await res.text());
    }
    return res.ok;
  } catch (e) {
    console.error("[telegram] sendInvoiceReport:", e.message);
    return false;
  }
}
