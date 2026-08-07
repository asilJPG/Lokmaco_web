import { requireSession } from '@/lib/auth-session';
import { getCurrentFilialIds } from '@/lib/current-filial';
import { resolveIikoCreds } from '@/lib/filial-iiko';
import { canAccess } from '@/lib/access';
import { downloadPhoto, isPathAllowed } from '@/lib/storage';
import { loadGoods, matchItems, stripFences, type ParsedItem } from '@/lib/invoice-match';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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

/**
 * Приход с фотографии накладной.
 *
 * Снимок и так делается ради факта (см. фото в приходе) — здесь тот же файл
 * читается моделью. Результат НИКОГДА не проводится сам: позиции попадают в
 * ту же форму, что и набранные руками, и человек их проверяет. На фото
 * ошибиться легче, чем в тексте: мятая накладная под углом читается плохо, а
 * модель при этом отвечает уверенно.
 */
export async function POST(req: Request) {
  const session = await requireSession();
  if (!canAccess(session.role, 'invoice')) {
    return Response.json({ error: 'Доступ запрещен для вашей роли' }, { status: 403 });
  }
  if (!OPENROUTER_API_KEY) {
    return Response.json({ error: 'OPENROUTER_API_KEY не задан' }, { status: 500 });
  }

  const filialIds = await getCurrentFilialIds();
  if (filialIds.length === 0) return Response.json({ error: 'Филиал не выбран' }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const path = String(body?.path || '');
  if (!path) return Response.json({ error: 'Сначала приложи фото накладной' }, { status: 400 });
  if (!isPathAllowed(path, session.filialIds)) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  const file = await downloadPhoto(path);
  if (!file?.body) return Response.json({ error: 'Фото не читается из хранилища' }, { status: 404 });
  const bytes = Buffer.from(await new Response(file.body).arrayBuffer());
  const dataUrl = `data:${file.contentType};base64,${bytes.toString('base64')}`;

  const { xml: creds } = await resolveIikoCreds(filialIds[0]);
  const products = await loadGoods(creds);
  if (products.length === 0) return Response.json({ error: 'Номенклатура из iiko не получена' }, { status: 502 });

  let aiRes: Response;
  try {
    aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
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
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'Сервис распознавания недоступен' }, { status: 502 });
  }

  if (!aiRes.ok) {
    console.error('[parse-photo] OpenRouter', aiRes.status, (await aiRes.text()).slice(0, 300));
    return Response.json({ error: 'Сервис распознавания недоступен' }, { status: 502 });
  }

  const aiData = await aiRes.json();
  const content = stripFences(aiData?.choices?.[0]?.message?.content || '');

  if (!content || content.toUpperCase().includes(NOTHING)) {
    return Response.json(
      { error: 'На фото не видно накладной — переснимите ровнее и при хорошем свете' },
      { status: 422 }
    );
  }

  let parsed: { items?: ParsedItem[]; supplier?: string; doc_number?: string };
  try {
    parsed = JSON.parse(content);
  } catch {
    return Response.json({ error: 'Не удалось разобрать ответ модели', raw: content.slice(0, 300) }, { status: 422 });
  }

  const items = Array.isArray(parsed.items) ? parsed.items : [];
  if (items.length === 0) {
    return Response.json({ error: 'В накладной не распознано ни одной позиции' }, { status: 422 });
  }

  const matched = matchItems(items, products).map((it) => {
    // Если в накладной написано не то же самое, что выбрано в номенклатуре,
    // строку надо перепроверить: «морковь» превращается в «Морковь желтый»
    // или «Морковь красная» с вероятностью 50/50, а это разный товар на складе.
    const written = String(it.as_written || '').trim().toLowerCase();
    const chosen = String(it.product_name || '').trim().toLowerCase();
    return { ...it, needs_review: !!written && !!chosen && written !== chosen };
  });

  return Response.json({
    items: matched,
    supplier: parsed.supplier || '',
    doc_number: parsed.doc_number || '',
  });
}
