/**
 * Отправка в Telegram.
 *
 * Токен один, а групп может быть несколько: закуп уходит в свою группу, чтобы
 * не тонуть среди прочих уведомлений. `TG_PURCHASES_CHAT_ID` — она; если не
 * задана, падаем на общий `TG_CHAT_ID`.
 */
const API = 'https://api.telegram.org';

function token(): string {
  const t = process.env.TG_BOT_TOKEN || '';
  if (!t) throw new Error('TG_BOT_TOKEN не задан');
  return t;
}

export function purchasesChatId(): string {
  return process.env.TG_PURCHASES_CHAT_ID || process.env.TG_CHAT_ID || '';
}

/** Телеграм режет подпись альбома на 1024 символах — режем сами и осмысленно. */
export const MAX_CAPTION = 1024;

export function clampCaption(text: string): string {
  if (text.length <= MAX_CAPTION) return text;
  return text.slice(0, MAX_CAPTION - 1) + '…';
}

export async function sendMessage(chatId: string, text: string): Promise<boolean> {
  const res = await fetch(`${API}/bot${token()}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) console.error('[telegram] sendMessage', res.status, (await res.text()).slice(0, 300));
  return res.ok;
}

export type OutgoingPhoto = { bytes: Uint8Array; contentType: string; filename: string };

/**
 * Альбом. Подпись Телеграм показывает только у ПЕРВОГО фото — остальные идут
 * без неё, поэтому весь текст собираем в одну подпись, а не по фото.
 * Больше 10 вложений в один альбом Телеграм не принимает.
 */
export async function sendPhotoAlbum(chatId: string, photos: OutgoingPhoto[], caption: string): Promise<boolean> {
  if (photos.length === 0) return false;
  const batch = photos.slice(0, 10);

  const form = new FormData();
  form.append('chat_id', chatId);
  form.append('media', JSON.stringify(batch.map((p, i) => ({
    type: 'photo',
    media: `attach://file${i}`,
    ...(i === 0 ? { caption: clampCaption(caption), parse_mode: 'HTML' } : {}),
  }))));
  batch.forEach((p, i) => {
    form.append(`file${i}`, new Blob([p.bytes as unknown as BlobPart], { type: p.contentType }), p.filename);
  });

  const res = await fetch(`${API}/bot${token()}/sendMediaGroup`, {
    method: 'POST',
    body: form,
    cache: 'no-store',
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) console.error('[telegram] sendMediaGroup', res.status, (await res.text()).slice(0, 300));
  return res.ok;
}

/** В подписи HTML — экранируем то, что вписал человек. */
export function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
