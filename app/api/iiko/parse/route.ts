import { requireSession } from '@/lib/auth-session';
import { getCurrentFilialIds } from '@/lib/current-filial';
import { resolveIikoCreds } from '@/lib/filial-iiko';
import { applyPacks, extractItems, loadGoods, matchItems, packsHint, type Good, type ParsedItem } from '@/lib/invoice-match';

export const dynamic = 'force-dynamic';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'google/gemma-4-27b-it:free';

export async function POST(req: Request) {
  await requireSession();
  const filialIds = await getCurrentFilialIds();
  if (filialIds.length === 0) return Response.json({ error: 'no filial' }, { status: 400 });
  const filialId = filialIds[0];

  let text = '';
  try {
    const body = await req.json();
    text = typeof body?.text === 'string' ? body.text : '';
  } catch {
    return Response.json({ error: 'Bad request' }, { status: 400 });
  }
  if (!text.trim()) return Response.json({ error: 'No text' }, { status: 400 });

  if (!OPENROUTER_API_KEY) {
    return Response.json({ error: 'OPENROUTER_API_KEY не задан' }, { status: 500 });
  }

  const { xml: creds } = await resolveIikoCreds(filialId);

  // 1. Список товаров из iiko
  let products: Good[] = [];
  try {
    products = await loadGoods(creds);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'iiko failed' }, { status: 502 });
  }

  if (!products.length) {
    return Response.json({ error: 'Нет товаров из iiko' }, { status: 500 });
  }

  // 2. Запрос в OpenRouter — тот же промпт, что в легаси bot.py
  const namesStr = products.map((p) => p.name).join(', ');
  const prompt = `Ты парсер накладных. Распарси текст, сматчи с товарами из списка. Нет цены — 0. Нет единицы — угадай.
ВАЖНО: если пользователь указал число после количества — это ОБЩАЯ СУММА за весь товар, НЕ цена за единицу. Раздели сумму на количество чтобы получить price.
Пример: "помидоры 50кг 600000" → quantity=50, price=12000 (600000/50)
Пример: "молоко 10л 450000" → quantity=10, price=45000 (450000/10)
Количество и цену НЕ пересчитывай из упаковок в штуки — это сделаем сами. Но если названа упаковка
(коробка, мешок, пачка) и такой товар есть в списке ФАСОВКА — добавь поле "pack" с названием фасовки оттуда.

ФАСОВКА: ${packsHint(products)}
ТЕКСТ: ${text}
ТОВАРЫ: ${namesStr}
ОТВЕТ JSON массив без markdown: [{"product_name":"точное название из списка","quantity":50,"unit":"кг","price":12000}]`;

  let aiRes: Response;
  try {
    aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 4000,
      }),
    });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'OpenRouter fetch failed' }, { status: 502 });
  }

  if (!aiRes.ok) {
    return Response.json({ error: 'OpenRouter API error' }, { status: 502 });
  }

  const aiData = await aiRes.json();
  let content: string = aiData?.choices?.[0]?.message?.content?.trim() || '';
  if (content.startsWith('```')) content = content.split('\n').slice(1).join('\n');
  if (content.endsWith('```')) content = content.slice(0, -3);

  const parsed = extractItems(content);
  if (!parsed) {
    return Response.json({ error: 'AI вернул невалидный JSON', raw: content.slice(0, 500) }, { status: 422 });
  }

  // 3. Матчинг общий с разбором фото: одна и та же накладная не должна попадать
  //    в разные позиции iiko в зависимости от того, надиктовали её или сняли.
  const items = applyPacks(
    matchItems(parsed.items as ParsedItem[], products),
    new Map(products.map((p) => [p.id, p]))
  );

  return Response.json({ items });
}
