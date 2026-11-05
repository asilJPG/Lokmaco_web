import { normalizeReceipt } from "@/lib/fiscal-receipt.js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Фото чека тяжелее — это уже не чек, а что-то не то.
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
// Читают фото те же, кто оформляет приход.
const ROLES = ["admin", "supplier"];

const MODELS = ["google/gemini-2.5-flash", "openai/gpt-4o-mini"];

const SYSTEM_PROMPT = `Ты читаешь фискальный чек онлайн-кассы Узбекистана (налоговая — Soliq).
Найди на фото два реквизита:
1. Номер фискального модуля — подписан «ФМ», «FM», «Фискальный модуль» или «ФМ рақами». Формат: две латинские буквы (обычно UZ) и 12 цифр, например UZ170703100597. Иногда буквы не напечатаны — тогда верни только цифры.
2. Фискальный признак — подписан «Фискальный признак», «Фискал белги», «ФП» или «FP». Это число из 10–16 цифр.
Дополнительно, если видны: номер чека («Чек №», «Чек рақами») и дата-время чека.

Правила:
- Верни ТОЛЬКО то, что действительно напечатано. Если реквизит не виден или цифры нечитаемы — оставь поле пустым. Угадывать и достраивать цифры нельзя: неверный номер хуже пустого.
- Не путай ИНН, номер кассы, номер терминала и номер чека с номером ФМ и фискальным признаком.
- Верни валидный JSON без markdown:
{"fm": "", "sign": "", "receipt_no": "", "datetime": "ГГГГММДДччммсс или пустая строка"}`;

export async function POST(req) {
  try {
    const userId = req.headers.get("x-user-id");
    const [baseRole] = (req.headers.get("x-user-role") || "").split(":");
    if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!ROLES.includes(baseRole)) {
      return Response.json({ error: "Доступ запрещен для вашей роли" }, { status: 403 });
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!file || typeof file.arrayBuffer !== "function") {
      return Response.json({ error: "Изображение не предоставлено" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return Response.json({ error: "Файл больше 8 МБ" }, { status: 400 });
    }
    const type = file.type || "image/jpeg";
    if (!ALLOWED_TYPES.includes(type)) {
      return Response.json({ error: "Поддерживаются только изображения" }, { status: 400 });
    }

    const key = process.env.OPENROUTER_API_KEY;
    if (!key) {
      // Не ошибка: распознавание — удобство, приход оформляется и без него.
      return Response.json({ success: true, receipt: null, reason: "ключ распознавания не задан" });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const image = `data:${type};base64,${buffer.toString("base64")}`;

    let lastError = "";
    for (const model of MODELS) {
      try {
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
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
          lastError = `${model}: ${res.status}`;
          console.error(`[ai-recognize-receipt] ${model}:`, res.status, await res.text());
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

        // Модель ничего не нашла — это ответ, а не сбой: вторая модель
        // по той же картинке вряд ли увидит больше, но стоит попробовать.
        const receipt = normalizeReceipt({
          fm: parsed?.fm,
          sign: parsed?.sign,
          receipt_no: parsed?.receipt_no,
          datetime: parsed?.datetime,
          source: "ocr",
          // Распознанное по тексту всегда ждёт проверки глазами
          confirmed: false,
        });
        if (receipt) return Response.json({ success: true, receipt, model });
      } catch (e) {
        lastError = e.message;
        console.error(`[ai-recognize-receipt] ${model}:`, e.message);
      }
    }

    return Response.json({ success: true, receipt: null, reason: lastError || "реквизиты не найдены" });
  } catch (e) {
    console.error("[/api/iiko/ai-recognize-receipt]", e.message);
    return Response.json({ error: "Не удалось прочитать чек" }, { status: 500 });
  }
}
