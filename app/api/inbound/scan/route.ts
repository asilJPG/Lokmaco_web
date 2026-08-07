import { db, schema } from '@/db/client';
import { buildPhotoPath, uploadPhoto, ALLOWED_PHOTO_TYPES, MAX_PHOTO_BYTES } from '@/lib/storage';
import { tashkentDate } from '@/lib/tashkent';

export const dynamic = 'force-dynamic';
// Скачать вложение, положить в хранилище и распознать — минуты хватает с запасом.
export const maxDuration = 60;

type Attachment = { filename: string; contentType: string; bytes: Uint8Array };

function b64(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s.replace(/^data:[^;]+;base64,/, ''), 'base64'));
}

function looksLikeImage(type: string, filename: string): boolean {
  if (ALLOWED_PHOTO_TYPES.includes(type)) return true;
  return /\.(jpe?g|png|webp)$/i.test(filename);
}

/**
 * Достаём вложения, не привязываясь к конкретному почтовому провайдеру.
 *
 * Формат входящего письма у всех свой: Cloudflare шлёт JSON, Mailgun и
 * Postmark — по-разному устроенный multipart и JSON с base64. Провайдера ещё
 * не выбрали, поэтому разбираем все распространённые формы: так его можно
 * будет сменить, не трогая эту ручку.
 */
async function extract(req: Request): Promise<{ attachments: Attachment[]; from: string; subject: string }> {
  const ct = req.headers.get('content-type') || '';
  const attachments: Attachment[] = [];
  let from = '';
  let subject = '';

  if (ct.includes('multipart/form-data')) {
    const form = await req.formData();
    from = String(form.get('from') || form.get('sender') || form.get('From') || '');
    subject = String(form.get('subject') || form.get('Subject') || '');
    for (const [, value] of form.entries()) {
      if (value instanceof File && looksLikeImage(value.type, value.name)) {
        attachments.push({
          filename: value.name || 'scan.jpg',
          contentType: value.type || 'image/jpeg',
          bytes: new Uint8Array(await value.arrayBuffer()),
        });
      }
    }
    return { attachments, from, subject };
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, any>;
  from = String(body.from || body.From || body.sender || body.envelope?.from || '');
  subject = String(body.subject || body.Subject || '');

  const raw = body.attachments || body.Attachments || [];
  for (const a of Array.isArray(raw) ? raw : []) {
    const filename = String(a.filename || a.Name || a.name || 'scan.jpg');
    const contentType = String(a.contentType || a.ContentType || a.type || 'image/jpeg');
    const content = a.content || a.Content || a.data || a.base64;
    if (!content || !looksLikeImage(contentType, filename)) continue;
    attachments.push({ filename, contentType: contentType.split(';')[0], bytes: b64(String(content)) });
  }
  return { attachments, from, subject };
}

/**
 * Приём сканов накладных с почты.
 *
 * МФУ отправляет скан на выделенный адрес, почтовый провайдер дёргает эту
 * ручку, вложение ложится в хранилище и встаёт в очередь «сканы ждут
 * оформления». Распознавание идёт отдельно, при открытии — чтобы письмо не
 * висело в ожидании ответа модели и провайдер не считал доставку неудачной.
 *
 * ⚠️ Ручка живёт вне сессии: сюда стучится почтовый сервис, а не человек.
 * Поэтому секрет обязателен, иначе прислать «скан» сможет кто угодно.
 */
export async function POST(req: Request) {
  const secret = process.env.INBOUND_SCAN_SECRET;
  if (!secret) {
    console.error('[inbound/scan] INBOUND_SCAN_SECRET не задан — приём выключен');
    return Response.json({ error: 'not configured' }, { status: 503 });
  }
  const url = new URL(req.url);
  const given = url.searchParams.get('secret') || (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (given !== secret) return Response.json({ error: 'forbidden' }, { status: 403 });

  // Филиал письмо не несёт: у принтера нет понятия «филиал». Берём из адреса
  // ручки (`?filial=2`), по умолчанию первый.
  const filialId = Number(url.searchParams.get('filial') || 0) || (
    (await db.select({ id: schema.filials.id }).from(schema.filials).limit(1))[0]?.id ?? 1
  );

  let payload: Awaited<ReturnType<typeof extract>>;
  try {
    payload = await extract(req);
  } catch (e) {
    console.error('[inbound/scan] не разобрали письмо', e);
    return Response.json({ error: 'bad payload' }, { status: 400 });
  }

  if (payload.attachments.length === 0) {
    // Отвечаем 200: письмо доставлено корректно, просто в нём нечего брать.
    // 4xx заставил бы провайдера повторять доставку по кругу.
    return Response.json({ ok: true, saved: 0, note: 'во вложениях нет изображений' });
  }

  const saved: number[] = [];
  for (const a of payload.attachments) {
    if (a.bytes.byteLength > MAX_PHOTO_BYTES * 4) {
      console.warn('[inbound/scan] вложение слишком большое, пропущено', a.filename, a.bytes.byteLength);
      continue;
    }
    const path = buildPhotoPath(filialId, 'invoice', a.contentType, tashkentDate());
    try {
      await uploadPhoto(path, a.bytes, a.contentType);
    } catch (e) {
      console.error('[inbound/scan] не сохранили вложение', e);
      continue;
    }
    const [row] = await db.insert(schema.scanInbox).values({
      filialId,
      fromEmail: payload.from.slice(0, 300),
      subject: payload.subject.slice(0, 300),
      photoPath: path,
    }).returning({ id: schema.scanInbox.id });
    saved.push(row.id);
  }

  return Response.json({ ok: true, saved: saved.length, ids: saved });
}
