import { withIikoSession, iikoGet, type IikoCreds } from './iiko';

/**
 * Справочник номенклатуры id → название.
 *
 * Документы iikoWeb отдают в строках только UUID товара, поэтому без этой
 * карты в интерфейсе видны голые идентификаторы. Справочник большой (~1200
 * позиций) и почти неизменный, так что держим его в памяти на 10 минут —
 * иначе каждое раскрытие документа тянуло бы всю номенклатуру заново.
 */
export const UNIT_MAP: Record<string, string> = {
  '7ba81c3a-8de5-8f9d-fb9f-e39efcbc57cc': 'кг',
  '69859c74-db72-b006-cba5-326cf6f4fc6e': 'л',
  'cd19b5ea-1b32-a6e5-1df7-5d2784a0549a': 'шт',
  '109fb602-70ad-473d-ba1f-f037b6e72887': 'шт',
};

export type NomenclatureEntry = { name: string; code: string; unit: string };

type IikoProduct = { id: string; name: string; type?: string; num?: string; code?: string; mainUnit?: string };

const cache = new Map<string, { map: Map<string, NomenclatureEntry>; at: number }>();
const TTL = 10 * 60_000;

export function invalidateNomenclature(): void {
  cache.clear();
}

export async function getNomenclature(creds: IikoCreds): Promise<Map<string, NomenclatureEntry>> {
  const key = `${creds.server}|${creds.login}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.map;

  const list = await withIikoSession(
    (token) => iikoGet<IikoProduct[]>('v2/entities/products/list', token, creds),
    creds
  );

  const map = new Map<string, NomenclatureEntry>();
  for (const p of list || []) {
    if (!p?.id) continue;
    map.set(p.id, {
      name: p.name || '',
      code: p.num || p.code || '',
      unit: UNIT_MAP[p.mainUnit || ''] || '',
    });
  }
  cache.set(key, { map, at: Date.now() });
  return map;
}
