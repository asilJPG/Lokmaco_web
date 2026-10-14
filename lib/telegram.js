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

// В супергруппе с темами сообщение без этого поля падает в «General», а не в
// нужный раздел. Для канала и обычной группы поле не нужно — оставляем пустым.
const TG_THREAD_ID = String(process.env.TG_INVOICE_THREAD_ID || "").trim();

// Канал-архив: туда уходят оригиналы снимков позиций, которые в рабочей
// группе не нужны, но без которых нельзя чистить хранилище.
const TG_ARCHIVE_CHAT_ID = String(process.env.TG_ARCHIVE_CHAT_ID || "")
  .trim()
  .replace(/^["']|["']$/g, "");
const TG_ARCHIVE_THREAD_ID = String(process.env.TG_ARCHIVE_THREAD_ID || "").trim();

/** Поле темы добавляем только когда оно задано: лишнее поле Telegram отвергает. */
function threadField(threadId) {
  const id = String(threadId ?? TG_THREAD_ID).trim();
  return id ? { message_thread_id: Number(id) } : {};
}

const api = (method) => `https://api.telegram.org/bot${TG_TOKEN}/${method}`;

// Часть токена до двоеточия — это публичный id бота, не секрет. В логе он
// нужен, чтобы отличить «бот не в чате» от «чата нет»: Telegram на оба
// случая отвечает одинаковым «chat not found».
const BOT_ID = String(TG_TOKEN).split(":")[0] || "?";

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Подпись к фотоотчёту: номер документа, дата и список позиций без цен. */
function buildCaption({ documentNumber, items }) {
  const lines = [
    `📦 <b>Приход № ${escapeHtml(documentNumber)}</b>`,
    "",
  ];

  for (const it of items || []) {
    const qty = `${it.quantity} ${it.unit || "шт"}`;
    lines.push(`• ${escapeHtml(it.product_name || "Товар")} — ${qty}`);
  }

  let text = lines.join("\n");
  if (text.length > 1000) text = text.slice(0, 997) + "...";
  return text;
}

/**
 * Отправка произвольного текста в заданный чат, при необходимости — под другим
 * ботом. Ночной отчёт исторически ходит от своего бота и в свой чат: у сайта
 * и у бота отчётов разные учётки, и добавлять их друг к другу незачем.
 */
export async function sendTelegramText(chatId, text, botToken, threadId) {
  const chat = String(chatId || "").trim().replace(/^["']|["']$/g, "");
  const token = String(botToken || TG_TOKEN || "").trim();
  const botId = token.split(":")[0] || "?";

  if (!token || !chat) {
    console.error("[telegram] текст не отправлен: нет токена или чата");
    return false;
  }
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chat,
      ...(threadId ? { message_thread_id: Number(threadId) } : {}),
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  if (!res.ok) {
    console.error(`[telegram] sendMessage: бот ${botId} → чат ${chat}:`, res.status, await res.text());
  }
  return res.ok;
}

async function sendText(text) {
  let res = await fetch(api("sendMessage"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: TG_CHAT_ID,
      ...threadField(),
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error(`[telegram] sendMessage: бот ${BOT_ID} → чат ${TG_CHAT_ID}:`, res.status, errText);
    // Если супергруппа отвергла threadId, пробуем отправить без темы
    if (TG_THREAD_ID && (res.status === 400 || /thread/i.test(errText))) {
      res = await fetch(api("sendMessage"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TG_CHAT_ID,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      });
      if (!res.ok) {
        console.error(`[telegram] sendMessage (no thread): бот ${BOT_ID} → чат ${TG_CHAT_ID}:`, res.status, await res.text());
      }
    }
  }
  return res.ok;
}

/**
 * `file_id` самой крупной версии снимка. Это и есть расписка Telegram в том,
 * что файл у него лежит: по нему картинку можно забрать обратно, когда из
 * нашего хранилища она уже удалена.
 */
function fileIdOf(message) {
  const sizes = message?.photo || [];
  if (sizes.length > 0) return sizes[sizes.length - 1].file_id || "";
  return message?.document?.file_id || "";
}

/**
 * Отправляет пачку снимков в указанный чат и возвращает расписки на каждый.
 *
 * Telegram скачивает картинки сам по временной ссылке — так надёжнее, чем
 * гнать байты через наш сервер: раньше любая осечка выгрузки молча превращала
 * фотоотчёт в текстовое сообщение.
 *
 * Альбом — не больше 10 снимков, поэтому длинные приходы уходят несколькими.
 */
async function deliverPhotos({ chatId, threadId, photos, caption }) {
  const delivered = [];
  // Снимок берём из хранилища, а если он оттуда уже вычищен — отправляем
  // повторно по расписке: Telegram принимает собственный file_id как медиа.
  const withPath = photos.filter((p) => p.path || p.tg_file_id);
  const usable = withPath.filter((p) => p.content_type !== "application/pdf");
  const pdfs = withPath.filter((p) => p.content_type === "application/pdf");
  if (usable.length === 0 && pdfs.length === 0) return { ok: true, delivered };

  const thread = threadId ? { message_thread_id: Number(threadId) } : {};
  const botId = String(TG_TOKEN).split(":")[0] || "?";
  let ok = true;
  let captionUsed = false;

  for (let i = 0; i < usable.length; i += 10) {
    const chunk = usable.slice(i, i + 10);

    const prepared = [];
    for (const p of chunk) {
      const url = p.path ? await createSignedUrl(p.path, 3600) : p.tg_file_id;
      if (url) prepared.push({ photo: p, url });
    }
    if (prepared.length === 0) {
      console.error(`[telegram] фотографии недоступны (${chunk.length} шт.) — пачка пропущена`);
      ok = false;
      continue;
    }

    // Подпись несёт только первый альбом: дублировать её под каждым незачем.
    const head = !captionUsed && caption ? { caption, parse_mode: "HTML" } : {};

    let res;
    if (prepared.length === 1) {
      res = await fetch(api("sendPhoto"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, ...thread, photo: prepared[0].url, ...head }),
      });
    } else {
      const media = prepared.map((p, idx) => ({
        type: "photo",
        media: p.url,
        ...(idx === 0 ? head : {}),
      }));
      res = await fetch(api("sendMediaGroup"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, ...thread, media }),
      });
    }

    if (!res.ok) {
      console.error(`[telegram] отправка фото: бот ${botId} → чат ${chatId}:`, res.status, await res.text());
      ok = false;
      continue;
    }
    captionUsed = captionUsed || Boolean(caption);

    const body = await res.json().catch(() => null);
    const messages = Array.isArray(body?.result) ? body.result : [body?.result].filter(Boolean);

    // Telegram возвращает сообщения в том же порядке, в каком был альбом.
    prepared.forEach((p, idx) => {
      const msg = messages[idx];
      const fileId = fileIdOf(msg);
      if (!fileId) {
        ok = false;
        return;
      }
      delivered.push({
        path: p.photo.path || "",
        chat_id: String(chatId),
        message_id: msg?.message_id || 0,
        file_id: fileId,
      });
    });
  }

  // Накладная сканом в PDF в альбом не кладётся — уходит документом, иначе
  // её нечем было бы подтвердить и пришлось бы вечно держать в хранилище.
  for (const p of pdfs) {
    const url = p.path ? await createSignedUrl(p.path, 3600) : p.tg_file_id;
    if (!url) {
      ok = false;
      continue;
    }
    const res = await fetch(api("sendDocument"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        ...thread,
        document: url,
        ...(!captionUsed && caption ? { caption, parse_mode: "HTML" } : {}),
      }),
    });
    if (!res.ok) {
      console.error(`[telegram] sendDocument: бот ${botId} → чат ${chatId}:`, res.status, await res.text());
      ok = false;
      continue;
    }
    captionUsed = captionUsed || Boolean(caption);

    const body = await res.json().catch(() => null);
    const fileId = body?.result?.document?.file_id || "";
    if (!fileId) {
      ok = false;
      continue;
    }
    delivered.push({
      path: p.path || "",
      chat_id: String(chatId),
      message_id: body?.result?.message_id || 0,
      file_id: fileId,
    });
  }

  return { ok, delivered };
}

/**
 * Фотоотчёт о приходе в рабочую группу: первым идёт снимок накладной,
 * следом коллаж позиций. Коллаж клеит браузер при отправке — на сервере
 * нет ни sharp, ни canvas, тянуть нативный модуль ради этого не стали.
 *
 * Возвращает `{ ok, delivered }`: расписки Telegram нужны, чтобы после
 * отправки удалить файлы из хранилища и всё равно показывать их на сайте.
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
      return { ok: false, delivered: [] };
    }

    const photos = payload.details?.photos || [];
    const caption = buildCaption(payload);

    // Порядок фиксированный: накладная сверху, коллаж(и) снизу
    const ordered = [
      ...photos.filter((p) => p.kind === "invoice"),
      ...photos.filter((p) => p.kind === "collage"),
    ];

    if (ordered.length === 0) {
      return { ok: await sendText(caption), delivered: [] };
    }

    const { ok, delivered } = await deliverPhotos({
      chatId: TG_CHAT_ID,
      threadId: TG_THREAD_ID,
      photos: ordered,
      caption,
    });

    // Совсем ничего не ушло — пусть хотя бы текст дойдёт до группы.
    if (delivered.length === 0) {
      return { ok: await sendText(caption), delivered: [] };
    }
    return { ok, delivered };
  } catch (e) {
    console.error("[telegram] sendInvoiceReport:", e.message);
    return { ok: false, delivered: [] };
  }
}

/**
 * Оригиналы снимков позиций — в отдельный канал-архив.
 *
 * В рабочую группу они не идут: там нужен коллаж, а не десяток отдельных
 * картинок на каждый приход. Но удалять оригиналы из хранилища можно только
 * после того, как Telegram их принял, — этот канал и есть их архив.
 *
 * Без `TG_ARCHIVE_CHAT_ID` отправки нет, и оригиналы останутся в бакете:
 * удалять то, чего нигде больше нет, нельзя.
 */
export async function sendInvoiceArchive(payload) {
  try {
    if (!TG_TOKEN || !TG_ARCHIVE_CHAT_ID) {
      return { ok: false, delivered: [], configured: Boolean(TG_ARCHIVE_CHAT_ID) };
    }

    const items = (payload.details?.photos || []).filter((p) => p.kind === "item");
    if (items.length === 0) return { ok: true, delivered: [], configured: true };

    const names = items
      .map((p) => p.product_name)
      .filter(Boolean)
      .filter((n, i, all) => all.indexOf(n) === i);

    const caption =
      `🗄 <b>Приход № ${escapeHtml(payload.documentNumber || "—")}</b>\n` +
      `${escapeHtml(payload.dateTime || "")}\n` +
      (names.length ? `\n${escapeHtml(names.join(", ")).slice(0, 800)}` : "");

    const { ok, delivered } = await deliverPhotos({
      chatId: TG_ARCHIVE_CHAT_ID,
      threadId: TG_ARCHIVE_THREAD_ID,
      photos: items,
      caption,
    });
    return { ok, delivered, configured: true };
  } catch (e) {
    console.error("[telegram] sendInvoiceArchive:", e.message);
    return { ok: false, delivered: [], configured: true };
  }
}

/**
 * Забирает файл обратно из Telegram по расписке `file_id`.
 * Нужен, чтобы админ видел фотографии на сайте после того, как
 * оригиналы удалены из хранилища.
 */
export async function fetchTelegramFile(fileId) {
  if (!TG_TOKEN || !fileId) return null;
  try {
    const res = await fetch(api("getFile"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_id: fileId }),
    });
    if (!res.ok) {
      console.error("[telegram] getFile:", res.status, await res.text());
      return null;
    }
    const body = await res.json();
    const filePath = body?.result?.file_path;
    if (!filePath) return null;

    const fileRes = await fetch(`https://api.telegram.org/file/bot${TG_TOKEN}/${filePath}`);
    if (!fileRes.ok) {
      console.error("[telegram] скачивание файла:", fileRes.status);
      return null;
    }
    return {
      body: fileRes.body,
      contentType: fileRes.headers.get("content-type") || "image/jpeg",
      contentLength: fileRes.headers.get("content-length") || "",
    };
  } catch (e) {
    console.error("[telegram] fetchTelegramFile:", e.message);
    return null;
  }
}
