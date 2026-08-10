export const TAG_PREFIX = 'LKM-';

/**
 * Код наклейки может приехать как есть (`LKM-0007`) или ссылкой из QR
 * (`https://сайт/tag/LKM-0007`) — камера телефона отдаёт именно ссылку,
 * а сканер внутри приложения читает тот же самый QR.
 */
export function normalizeTagCode(raw: string | null | undefined): string | null {
  const s = String(raw || '').trim();
  const fromUrl = s.match(/\/tag\/([A-Za-z0-9_-]+)/);
  const code = (fromUrl ? fromUrl[1] : s).toUpperCase();
  return /^[A-Z0-9_-]{3,32}$/.test(code) ? code : null;
}

/** Похоже ли прочитанное на код наклейки, а не на старый QR с описанием. */
export function looksLikeTag(raw: string | null | undefined): boolean {
  const code = normalizeTagCode(raw);
  return Boolean(code && code.startsWith(TAG_PREFIX));
}
