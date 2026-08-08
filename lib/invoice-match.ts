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
 * Насколько похоже должно быть название, чтобы считать его тем же товаром.
 *
 * ⚠️ Раньше порога не было вовсе: побеждало любое совпадение больше нуля.
 * На чеке из магазина «SPRITE PET 1L» превращался в «Чашу из нерж. стали 1л»
 * — единственное общее слово «1l» давало счёт выше нуля и выигрывало. Человек
 * видел в приходе товар, которого в накладной нет. Лучше оставить строку
 * несопоставленной (её видно и выбирают руками), чем подставить чужой товар.
 */
const MIN_SCORE = 0.4;

/** Слова без собственного смысла: фасовка и единицы. По ним матчить нельзя. */
const NOISE = /^(\d+([.,]\d+)?)?(г|гр|кг|мг|л|мл|шт|уп|пач|бут|kg|g|gr|ml|l|pc|pcs|pet)?$/;

function normalize(s: string): string {
  return s.toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function meaningfulWords(s: string): string[] {
  return s.split(/\s+/).filter((w) => w && !NOISE.test(w));
}

/** 0…1: насколько два названия похожи. 1 — это то же самое. */
function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;

  // Вхождение целиком: «соль» внутри «соль морская». Чем ближе длины, тем
  // увереннее совпадение — отношение длин и есть счёт, оно всегда ≤ 1.
  if (a.includes(b) || b.includes(a)) {
    return Math.min(a.length, b.length) / Math.max(a.length, b.length);
  }

  const aw = new Set(meaningfulWords(a));
  const bw = new Set(meaningfulWords(b));
  if (aw.size === 0 || bw.size === 0) return 0;
  const common = [...aw].filter((w) => bw.has(w)).length;
  if (common === 0) return 0;
  const union = new Set([...aw, ...bw]).size;
  return common / union;
}

/**
 * Сопоставление распознанного названия с номенклатурой.
 *
 * Общая для голоса и фото: один и тот же товар обязан попадать в одну позицию
 * iiko независимо от того, как накладная попала в систему. Поэтому текстовый
 * разбор (`/api/iiko/parse`) зовёт эту же функцию, а не свою копию.
 *
 * Ничего не нашлось — `product_id` пустой, а в названии остаётся то, что
 * прочитали в накладной: человек выберет товар сам.
 */
export function matchItems<T extends ParsedItem>(items: T[], products: Good[]): T[] {
  for (const item of items) {
    const raw = item.product_name || item.as_written || '';
    item.raw_name = raw;
    const aiName = normalize(raw);
    let bestMatch: Good | null = null;
    let bestScore = 0;

    for (const p of products) {
      const score = similarity(aiName, normalize(p.name));
      if (score > bestScore) { bestScore = score; bestMatch = p; }
      if (bestScore === 1) break;
    }

    if (bestMatch && bestScore >= MIN_SCORE) {
      item.product_id = bestMatch.id;
      item.product_name = bestMatch.name;
    } else {
      item.product_id = '';
      item.product_name = raw;
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

/**
 * Достаём позиции из ответа модели, как бы она его ни завернула.
 *
 * Просили объект `{"items":[…]}`, а приходит то голый массив, то массив в
 * ```-блоке, то с болтовнёй вокруг. Строгий `JSON.parse` на всём тексте на
 * этом падал, и живой скан уезжал в «Не удалось разобрать ответ модели».
 */
export function extractItems(content: string): { items: ParsedItem[]; supplier: string; doc_number: string } | null {
  const c = stripFences(content);
  const candidates = [c];
  const obj = c.match(/\{[\s\S]*\}/);
  const arr = c.match(/\[[\s\S]*\]/);
  if (obj) candidates.push(obj[0]);
  if (arr) candidates.push(arr[0]);

  for (const candidate of candidates) {
    let data: unknown;
    try { data = JSON.parse(candidate); } catch { continue; }
    if (Array.isArray(data)) return { items: data as ParsedItem[], supplier: '', doc_number: '' };
    if (data && typeof data === 'object') {
      const o = data as { items?: unknown; supplier?: unknown; doc_number?: unknown };
      if (Array.isArray(o.items)) {
        return {
          items: o.items as ParsedItem[],
          supplier: typeof o.supplier === 'string' ? o.supplier : '',
          doc_number: typeof o.doc_number === 'string' ? o.doc_number : '',
        };
      }
    }
  }
  return null;
}
