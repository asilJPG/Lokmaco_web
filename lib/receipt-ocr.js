import { normalizeReceipt } from "./fiscal-receipt.js";
import { downloadInvoiceFile } from "./storage.js";

/**
 * Чтение номера ФМ и фискального признака с фото чека — запасной путь, когда
 * QR на снимке не нашёлся. Работает только на сервере и только по уже
 * загруженному фото: ни кнопок, ни подсказок у снабженца для этого нет.
 */

const MODELS = ["google/gemini-2.5-flash", "openai/gpt-4o-mini"];

// Фото чека тяжелее — это уже не чек, а что-то не то.
const MAX_BYTES = 8 * 1024 * 1024;
// Приход не должен ждать нейросеть дольше этого: он уже проведён в iiko.
const TIMEOUT_MS = 25_000;

const SYSTEM_PROMPT = `Ты читаешь фискальный чек онлайн-кассы Узбекистана (налоговая — Soliq).
Найди на фото два реквизита:
1. Номер фискального модуля — подписан «ФМ», «FM», «Фискальный модуль» или «ФМ рақами». Формат: две латинские буквы (обычно UZ) и 12 цифр, например UZ170703100597. Иногда буквы не напечатаны — тогда верни только цифры.
2. Фискальный признак — подписан «Фискальный признак», «Фискал белги», «ФП» или «FP». Это число из 10–16 цифр.
Дополнительно, если видны: номер чека («Чек №», «Чек рақами») и дата-время чека.

Правила:
- Верни ТОЛЬКО то, что действительно напечатано. Если реквизит не виден или цифры нечитаемы — оставь поле пустым. Угадывать и достраивать цифры нельзя: неверный номер хуже пустого.
- Не путай ИНН, номер кассы, номер терминала и номер чека с номером ФМ и фискальным признаком.
- Если на фото вообще нет фискального чека (например, только бумажная накладная) — верни пустые поля.
- Верни валидный JSON без markdown:
{"fm": "", "sign": "", "receipt_no": "", "datetime": "ГГГГММДДччммсс или пустая строка"}`;

/** Читает реквизиты с одной картинки. Возвращает нормализованный объект или null. */
export async function readReceiptFromImage(buffer, contentType = "image/jpeg") {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key || !buffer?.length || buffer.length > MAX_BYTES) return null;
  if (!/^image\/(jpeg|png|webp)$/.test(contentType)) return null;

  const image = `data:${contentType};base64,${buffer.toString("base64")}`;

  for (const model of MODELS) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://lokmaco.uz",
          "X-Title": "Lokmaco Receipt Reader",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: [
                { type: "text", text: "Прочитай номер ФМ и фискальный признак на этом чеке:" },
                { type: "image_url", image_url: { url: image } },
              ],
            },
          ],
          temperature: 0,
          max_tokens: 200,
        }),
      });

      if (!res.ok) {
        console.error(`[receipt-ocr] ${model}:`, res.status, await res.text());
        continue;
      }

      const data = await res.json();
      let content = data.choices?.[0]?.message?.content || "{}";
      content = content.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/\s*```$/, "").trim();

      let parsed = null;
      try {
        parsed = JSON.parse(content);
      } catch {
        const m = content.match(/\{[\s\S]*\}/);
        if (m) parsed = JSON.parse(m[0]);
      }

      // Распознанное по тексту всегда ждёт проверки глазами
      const receipt = normalizeReceipt({
        fm: parsed?.fm,
        sign: parsed?.sign,
        receipt_no: parsed?.receipt_no,
        datetime: parsed?.datetime,
        source: "ocr",
        confirmed: false,
      });
      if (receipt) return receipt;
    } catch (e) {
      console.error(`[receipt-ocr] ${model}:`, e.message);
    }
  }
  return null;
}

/**
 * Берёт фото накладной из хранилища и читает с него реквизиты. Вызывать нужно
 * ДО удаления файлов из бакета — после отправки в Telegram их там уже нет.
 */
export async function readReceiptFromStoredPhotos(photos) {
  const candidates = (photos || [])
    .filter((p) => p?.kind === "invoice" && p.path && /^image\//.test(p.content_type || ""))
    .slice(0, 2);

  for (const p of candidates) {
    try {
      const file = await downloadInvoiceFile(p.path);
      if (!file) continue;
      const buffer = Buffer.from(await new Response(file.body).arrayBuffer());
      const receipt = await readReceiptFromImage(buffer, p.content_type);
      if (receipt) return receipt;
    } catch (e) {
      console.error("[receipt-ocr] фото из хранилища:", e.message);
    }
  }
  return null;
}
