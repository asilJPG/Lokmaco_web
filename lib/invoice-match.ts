import { withIikoSession, iikoGet, type IikoCreds } from './iiko';

/** Фасовка из карточки iiko: «коробка = 24 шт». */
export type Container = { name: string; count: number };
export type Good = { id: string; name: string; mainUnit?: string; unit?: string; containers?: Container[] };

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
  /** Название фасовки из накладной, если строка в упаковках («коробка», «мешок»). */
  pack?: string;
  /** Что именно пересчитали — человеку в подсказку: «5 коробка × 24 = 120 шт». */
  pack_note?: string;
};

type RawProduct = {
  id: string;
  name: string;
  type?: string;
  mainUnit?: string;
  deleted?: boolean;
  containers?: { name?: string; count?: number; deleted?: boolean }[];
};

/**
 * Товары, которые можно поставить в приход. Услуги и блюда сюда не годятся.
 *
 * Тянем заодно фасовки и название основной единицы: приход в iiko считается в
 * основной единице, а в накладной товар почти всегда в упаковках — без этих
 * двух полей пересчитать «5 коробок» в «120 шт» неоткуда.
 */
export async function loadGoods(creds: IikoCreds): Promise<Good[]> {
  const [data, units] = await Promise.all([
    withIikoSession((token) => iikoGet<RawProduct[]>('v2/entities/products/list?includeDeleted=true', token, creds), creds),
    withIikoSession(
      (token) => iikoGet<{ id: string; name: string }[]>('v2/entities/list?rootType=MeasureUnit', token, creds), creds
    ).catch(() => [] as { id: string; name: string }[]),
  ]);

  const unitName = new Map((units || []).map((u) => [u.id, u.name]));

  return (data || [])
    .filter((p) => p.type === 'GOODS' && !p.deleted)
    .map((p) => ({
      id: p.id,
      name: p.name,
      mainUnit: p.mainUnit,
      unit: p.mainUnit ? unitName.get(p.mainUnit) : undefined,
      containers: (p.containers || [])
        .filter((c) => !c.deleted && Number(c.count) > 1 && c.name)
        .map((c) => ({ name: String(c.name), count: Number(c.count) })),
    }));
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

/**
 * Фасовки для промпта: «Орео печеньки: коробка = 24 шт».
 *
 * Таких товаров два-три десятка из девяти сотен, поэтому список идёт отдельно
 * и целиком — модели надо знать не только что товар есть, но и что закупают
 * его коробками, а считают штуками.
 */
export function packsHint(products: Good[]): string {
  const lines = products
    .filter((p) => (p.containers?.length || 0) > 0)
    .map((p) => `${p.name}: ${p.containers!.map((c) => `${c.name} = ${c.count} ${p.unit || ''}`.trim()).join('; ')}`);
  return lines.length > 0 ? lines.join('\n') : '(нет)';
}

/** Признак того, что строка накладной — упаковка: «228гр», «1.5 л», «400 gr». */
const PACKED = /\d+\s*(г|гр|грамм|кг|мл|мг|л|g|gr|kg|ml|lt|l)\b/i;

/**
 * Пересчёт упаковок в основную единицу iiko.
 *
 * В накладной пишут «Original Oreo Pecheniye 228gr — 5», а на складе орео
 * приходуют поштучно, и в коробке их 24: в приход должно уйти 120 шт по
 * 1157.92, а не 5 по 27790. Размер упаковки берём **из карточки iiko**
 * (`containers`), а не у модели — арифметику она путает, а число в карточке
 * заведено человеком.
 *
 * Что именно пересчитали, пишем в `pack_note` и помечаем строку на проверку:
 * пересчёт меняет и количество, и цену, и это должно быть видно.
 */
export function applyPacks<T extends ParsedItem>(items: T[], byId: Map<string, Good>): T[] {
  for (const item of items) {
    const good = item.product_id ? byId.get(item.product_id) : undefined;
    const containers = good?.containers || [];
    if (!good || containers.length === 0) continue;

    const asked = normalize(item.pack || '');
    let pack: Container | undefined;

    if (asked) {
      pack = containers.find((c) => normalize(c.name) === asked)
        || containers.find((c) => normalize(c.name).includes(asked) || asked.includes(normalize(c.name)))
        // Модель назвала упаковку, но не той фасовкой, что заведена в iiko.
        // Фасовка одна — сомнений, какую брать, нет.
        || (containers.length === 1 ? containers[0] : undefined);
    } else if (containers.length === 1 && PACKED.test(item.as_written || '')) {
      // Модель про упаковку не сказала, но в накладной товар с весом на пачке,
      // а на складе он поштучно — это она и есть.
      pack = containers[0];
    }

    if (!pack || pack.count <= 1) continue;

    const qty = Number(item.quantity) || 0;
    const price = Number(item.price) || 0;
    item.quantity = Math.round(qty * pack.count * 1000) / 1000;
    item.price = Math.round((price / pack.count) * 100) / 100;
    item.pack_note = `${qty} ${pack.name} × ${pack.count} = ${item.quantity} ${good.unit || ''}`.trim();
    if (good.unit) item.unit = good.unit;
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
