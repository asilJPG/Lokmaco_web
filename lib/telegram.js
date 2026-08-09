import { downloadInvoiceFile } from "./storage.js";

const TG_TOKEN = process.env.TG_BOT_TOKEN || "";
const TG_CHAT_ID = process.env.TG_CHAT_ID || "";

const api = (method) => `https://api.telegram.org/bot${TG_TOKEN}/${method}`;

function fmtNum(n) {
  return new Intl.NumberFormat("ru-RU").format(Math.round(Number(n) || 0));
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Подпись к фотоотчёту. У Telegram лимит 1024 символа на caption. */
function buildCaption({ documentNumber, supplierName, storeName, userName, items, details }) {
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
  if (!res.ok) console.error("[telegram] sendMessage:", res.status, await res.text());
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
    if (!TG_TOKEN || !TG_CHAT_ID) return false;

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

    const files = [];
    for (const p of ordered.slice(0, 10)) {
      const file = await downloadInvoiceFile(p.path);
      if (!file) continue;
      const buf = Buffer.from(await new Response(file.body).arrayBuffer());
      files.push({ buf, contentType: file.contentType });
    }

    if (files.length === 0) return await sendText(caption);

    // Одна картинка — обычный sendPhoto, альбом из одного элемента Telegram не любит
    if (files.length === 1) {
      const fd = new FormData();
      fd.append("chat_id", TG_CHAT_ID);
      fd.append("caption", caption);
      fd.append("parse_mode", "HTML");
      fd.append("photo", new Blob([files[0].buf], { type: files[0].contentType }), "invoice.jpg");
      const res = await fetch(api("sendPhoto"), { method: "POST", body: fd });
      if (!res.ok) console.error("[telegram] sendPhoto:", res.status, await res.text());
      return res.ok;
    }

    const fd = new FormData();
    fd.append("chat_id", TG_CHAT_ID);
    const media = files.map((f, i) => ({
      type: "photo",
      media: `attach://file${i}`,
      ...(i === 0 ? { caption, parse_mode: "HTML" } : {}),
    }));
    fd.append("media", JSON.stringify(media));
    files.forEach((f, i) => {
      fd.append(`file${i}`, new Blob([f.buf], { type: f.contentType }), `photo${i}.jpg`);
    });

    const res = await fetch(api("sendMediaGroup"), { method: "POST", body: fd });
    if (!res.ok) console.error("[telegram] sendMediaGroup:", res.status, await res.text());
    return res.ok;
  } catch (e) {
    console.error("[telegram] sendInvoiceReport:", e.message);
    return false;
  }
}
