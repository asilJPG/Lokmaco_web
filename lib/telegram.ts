/**
 * Отправка в Telegram.
 *
 * Токен один, а групп может быть несколько: закуп уходит в свою группу, чтобы
 * не тонуть среди прочих уведомлений. `TG_INVOICE_CHAT_ID` — она (так же
 * называется в легаси, чтобы переменные не пришлось заводить заново); дальше
 * падаем на `TG_PURCHASES_CHAT_ID` и общий `TG_CHAT_ID`.
 */
const API = 'https://api.telegram.org';

function token(): string {
  const t = process.env.TG_BOT_TOKEN || '';
  if (!t) throw new Error('TG_BOT_TOKEN не задан');
  return t;
}

/**
 * ⚠️ Значение из панели окружения часто приезжает с кавычками или пробелами,
 * а Telegram отвечает на такое «chat not found» — читается как «бота нет в
 * чате», и причину ищут не там. Поймано на легаси, поэтому чистим.
 */
function cleanEnv(name: string): string {
  return String(process.env[name] || '').trim().replace(/^["']|["']$/g, '');
}

export function purchasesChatId(): string {
  return cleanEnv('TG_INVOICE_CHAT_ID') || cleanEnv('TG_PURCHASES_CHAT_ID') || cleanEnv('TG_CHAT_ID');
}

/**
 * Тема супергруппы.
 *
 * ⚠️ В супергруппе с темами сообщение без `message_thread_id` падает в
 * «General», а не в нужный раздел. Для канала и обычной группы поле не нужно —
 * и лишним его слать нельзя, Telegram такое отвергает.
 */
export function invoiceThreadId(): string {
  return cleanEnv('TG_INVOICE_THREAD_ID');
}

function threadField(): Record<string, number> {
  const id = invoiceThreadId();
  return id ? { message_thread_id: Number(id) } : {};
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
    body: JSON.stringify({ chat_id: chatId, ...threadField(), text, parse_mode: 'HTML', disable_web_page_preview: true }),
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) console.error('[telegram] sendMessage', res.status, (await res.text()).slice(0, 300));
  return res.ok;
}

export type OutgoingPhoto = { bytes: Uint8Array; contentType: string; filename: string };

/** Одиночный снимок с подписью. */
export async function sendPhoto(chatId: string, photo: OutgoingPhoto, caption: string): Promise<boolean> {
  const form = new FormData();
  form.append('chat_id', chatId);
  const thread = invoiceThreadId();
  if (thread) form.append('message_thread_id', thread);
  form.append('caption', clampCaption(caption));
  form.append('parse_mode', 'HTML');
  form.append('photo', new Blob([photo.bytes as unknown as BlobPart], { type: photo.contentType }), photo.filename);

  const res = await fetch(`${API}/bot${token()}/sendPhoto`, {
    method: 'POST',
    body: form,
    cache: 'no-store',
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) console.error('[telegram] sendPhoto', res.status, (await res.text()).slice(0, 300));
  return res.ok;
}

/**
 * Альбом. Подпись Телеграм показывает только у ПЕРВОГО фото — остальные идут
 * без неё, поэтому весь текст собираем в одну подпись, а не по фото.
 * Больше 10 вложений в один альбом Телеграм не принимает.
 */
export async function sendPhotoAlbum(chatId: string, photos: OutgoingPhoto[], caption: string): Promise<boolean> {
  if (photos.length === 0) return false;
  // ⚠️ Альбом из одного снимка Телеграм не принимает: sendMediaGroup требует
  // от 2 до 10 вложений. Приход с единственным фото накладной — самый частый
  // случай, поэтому одиночку отправляем обычным sendPhoto.
  if (photos.length === 1) return sendPhoto(chatId, photos[0], caption);
  const batch = photos.slice(0, 10);

  const form = new FormData();
  form.append('chat_id', chatId);
  const thread = invoiceThreadId();
  if (thread) form.append('message_thread_id', thread);
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
