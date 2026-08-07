import { withIikoSession, iikoGet, type IikoCreds } from './iiko';

export type Good = { id: string; name: string; mainUnit?: string };
export type ParsedItem = {
  product_name?: string;
  product_id?: string;
  quantity?: number;
  unit?: string;
  price?: number;
  /** Как позиция написана в самой накладной — по ней видно, где модель угадывала. */
  as_written?: string;
  /** Что именно распознано в документе — показываем человеку, если товар не нашёлся. */
  raw_name?: string;
};

/** Товары, которые можно поставить в приход. Услуги и блюда сюда не годятся. */
export async function loadGoods(creds: IikoCreds): Promise<Good[]> {
  const data = await withIikoSession(
    (token) => iikoGet<{ id: string; name: string; type?: string; mainUnit?: string }[]>(
      'v2/entities/products/list?includeDeleted=true', token, creds
    ),
    creds
  );
  return (data || [])
    .filter((p) => p.type === 'GOODS')
    .map((p) => ({ id: p.id, name: p.name, mainUnit: p.mainUnit }));
}

/**
 * Сопоставление распознанного названия с номенклатурой.
 *
 * Логика перенесена из `app/api/iiko/parse/route.js` дословно — точное
 * совпадение, потом вхождение подстроки, потом пересечение слов. Менять её
 * здесь нельзя, не сверившись с текстовым парсером: оба должны матчить
 * одинаково, иначе один и тот же товар из голоса и с фото попадёт в разные
 * позиции iiko.
 */
export function matchItems<T extends ParsedItem>(items: T[], products: Good[]): T[] {
  for (const item of items) {
    const aiName = (item.product_name || '').toLowerCase().trim();
    item.raw_name = item.product_name || '';
    let bestMatch: Good | null = null;
    let bestScore = 0;

    for (const p of products) {
      const pName = p.name.toLowerCase().trim();

      if (aiName === pName) { bestMatch = p; bestScore = 1; break; }

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

      if (score > bestScore) { bestScore = score; bestMatch = p; }
    }

    if (bestMatch) {
      item.product_id = bestMatch.id;
      item.product_name = bestMatch.name;
    } else {
      item.product_id = '';
    }
  }
  return items;
}

/** Модель любит обернуть JSON в ```-блок, хотя её просили не оборачивать. */
export function stripFences(content: string): string {
  let c = content.trim();
  if (c.startsWith('```')) c = c.split('\n').slice(1).join('\n');
  if (c.endsWith('```')) c = c.slice(0, -3);
  return c.trim();
}
