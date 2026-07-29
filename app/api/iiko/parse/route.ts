import { withIikoSession, iikoGet } from '@/lib/iiko';
import { requireSession } from '@/lib/auth-session';
import { getCurrentFilialIds } from '@/lib/current-filial';
import { resolveIikoCreds } from '@/lib/filial-iiko';

export const dynamic = 'force-dynamic';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'google/gemma-4-27b-it:free';

type IikoProduct = { id: string; name: string; type?: string; mainUnit?: string };
type ProductLite = { id: string; name: string };

type AiItem = {
  product_name?: string;
  quantity?: number;
  unit?: string;
  price?: number;
  product_id?: string;
};

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
  let products: ProductLite[] = [];
  try {
    products = await withIikoSession(async (token) => {
      const data = (await iikoGet<IikoProduct[]>('v2/entities/products/list', token, creds)) || [];
      return data.filter((p) => p.type === 'GOODS').map((p) => ({ id: p.id, name: p.name }));
    }, creds);
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

  let items: AiItem[];
  try {
    items = JSON.parse(content.trim());
  } catch {
    return Response.json({ error: 'AI вернул невалидный JSON', raw: content }, { status: 422 });
  }

  // 3. Локальный матчинг — точная копия логики легаси (exact → partial → word overlap)
  for (const item of items) {
    const aiName = (item.product_name || '').toLowerCase().trim();
    let bestMatch: ProductLite | null = null;
    let bestScore = 0;

    for (const p of products) {
      const pName = p.name.toLowerCase().trim();

      if (aiName === pName) {
        bestMatch = p;
        break;
      }

      let score = 0;
      if (aiName.includes(pName) || pName.includes(aiName)) {
        score = aiName.length / Math.max(pName.length, 1);
      } else {
        const aiWords = new Set(aiName.split(/\s+/));
        const pWords = new Set(pName.split(/\s+/));
        const common = [...aiWords].filter((w) => pWords.has(w));
        if (common.length > 0) {
          const union = new Set([...aiWords, ...pWords]);
          score = common.length / Math.max(union.size, 1);
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = p;
      }
    }

    if (bestMatch) {
      item.product_id = bestMatch.id;
      item.product_name = bestMatch.name;
    } else {
      item.product_id = '';
    }
  }

  return Response.json({ items });
}
