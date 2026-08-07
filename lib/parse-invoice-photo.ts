import { resolveIikoCreds } from './filial-iiko';
import { downloadPhoto } from './storage';
import { loadGoods, matchItems, stripFences, type ParsedItem } from './invoice-match';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const VISION_MODEL = process.env.OPENROUTER_VISION_MODEL || 'google/gemini-2.5-flash';

/** Модель обязана так ответить, если на снимке не накладная или ничего не разобрать. */
const NOTHING = 'НЕТ_НАКЛАДНОЙ';

const PROMPT = (names: string) => `Ты читаешь ФОТОГРАФИЮ бумажной накладной из ресторана в Узбекистане и превращаешь её в позиции прихода.

ГЛАВНОЕ ПРАВИЛО: выписывай только те позиции, которые РЕАЛЬНО ВИДНЫ на снимке.
Никогда не додумывай товары, количества и цены. Не бери их из списка номенклатуры «по смыслу».
Если на фото не накладная, или текст не читается — ответь ровно ${NOTHING} и ничего больше.
Если строка видна, но цифра не читается — поставь 0, не угадывай.

Для каждой строки верни ДВА названия:
  "as_written" — как написано в самой накладной, дословно;
  "product_name" — точное название из списка номенклатуры, если нашёл подходящее; иначе повтори as_written.
Это обязательно: по ним видно, где ты угадывал. В накладной «морковь», а в номенклатуре «Морковь желтый» и «Морковь красная» — выбери одно, но as_written оставь «морковь».

Цена (price) — за ЕДИНИЦУ. Если в накладной указана сумма за строку, раздели её на количество.

НОМЕНКЛАТУРА: ${names}

Ответ — JSON без markdown:
{"items":[{"as_written":"морковь","product_name":"Морковь желтый","quantity":50,"unit":"кг","price":12000}],"supplier":"поставщик если виден","doc_number":"номер если виден"}`;


export type PhotoParseResult = {
  items: (ParsedItem & { needs_review?: boolean })[];
  supplier: string;
  doc_number: string;
};

/**
 * Распознавание накладной по картинке из хранилища.
 *
 * Вынесено из роута, потому что зовётся из двух мест: при приёме скана с почты
 * (чтобы приход приезжал уже разобранным) и по кнопке на странице прихода.
 * Разбор обязан быть один и тот же — иначе одна и та же накладная давала бы
 * разный результат в зависимости от того, как попала в систему.
 */
export async function parseInvoicePhoto(filialId: number, path: string): Promise<PhotoParseResult> {
  if (!OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY не задан');

  const file = await downloadPhoto(path);
  if (!file?.body) throw new Error('Фото не читается из хранилища');
  const bytes = Buffer.from(await new Response(file.body).arrayBuffer());
  const dataUrl = `data:${file.contentType};base64,${bytes.toString('base64')}`;

  const { xml: creds } = await resolveIikoCreds(filialId);
  const products = await loadGoods(creds);
  if (products.length === 0) throw new Error('Номенклатура из iiko не получена');

  const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: VISION_MODEL,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: PROMPT(products.map((p) => p.name).join(', ')) },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      }],
      temperature: 0,
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(55_000),
  });

  if (!aiRes.ok) {
    console.error('[parseInvoicePhoto] OpenRouter', aiRes.status, (await aiRes.text()).slice(0, 300));
    throw new Error('Сервис распознавания недоступен');
  }

  const aiData = await aiRes.json();
  const content = stripFences(aiData?.choices?.[0]?.message?.content || '');

  if (!content || content.toUpperCase().includes(NOTHING)) {
    throw new Error('На фото не видно накладной — переснимите ровнее и при хорошем свете');
  }

  let parsed: { items?: ParsedItem[]; supplier?: string; doc_number?: string };
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('Не удалось разобрать ответ модели');
  }

  const items = Array.isArray(parsed.items) ? parsed.items : [];
  if (items.length === 0) throw new Error('В накладной не распознано ни одной позиции');

  return {
    items: matchItems(items, products).map((it) => {
      // Если в накладной написано не то же самое, что выбрано в номенклатуре,
      // строку надо перепроверить: «морковь» превращается в «Морковь желтый»
      // или «Морковь красная» с вероятностью 50/50, а это разный товар.
      const written = String(it.as_written || '').trim().toLowerCase();
      const chosen = String(it.product_name || '').trim().toLowerCase();
      return { ...it, needs_review: !!written && !!chosen && written !== chosen };
    }),
    supplier: parsed.supplier || '',
    doc_number: parsed.doc_number || '',
  };
}
