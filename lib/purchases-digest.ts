import { and, eq, inArray, sql } from 'drizzle-orm';
import { db, schema } from '@/db/client';
import { downloadPhoto, PHOTO_LABELS, type PhotoKind } from '@/lib/storage';
import { esc, purchasesChatId, sendMessage, sendPhotoAlbum, type OutgoingPhoto } from '@/lib/telegram';
import { fmtDate, todayTashkent } from '@/lib/period';

type Item = { product_name?: string; quantity?: number; price?: number; unit?: string };
type Details = {
  supplier_name?: string;
  store_name?: string;
  comment?: string;
  items?: Item[];
  photos?: { path: string; kind: PhotoKind }[];
  tg_sent_at?: string;
};

function money(n: number): string {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.round(n));
}

function sumOf(items: Item[]): number {
  return items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.price) || 0), 0);
}

function caption(row: { userName: string | null; documentNumber: string | null; details: Details }): string {
  const d = row.details;
  const items = Array.isArray(d.items) ? d.items : [];
  const lines = [
    `🚚 <b>Закуп</b> · ${esc(d.supplier_name || 'поставщик не указан')}`,
    `Склад: ${esc(d.store_name || '—')} · ${esc(row.userName || '—')}`,
    row.documentNumber ? `Документ ${esc(row.documentNumber)}` : '',
    '',
  ].filter(Boolean);

  for (const it of items) {
    const qty = Number(it.quantity) || 0;
    const price = Number(it.price) || 0;
    lines.push(`• ${esc(it.product_name || '—')} — ${money(qty)} ${esc(it.unit || '')} × ${money(price)} = <b>${money(qty * price)}</b>`);
  }

  lines.push('', `<b>Итого: ${money(sumOf(items))} сум</b>`);
  if (d.comment) lines.push(`💬 ${esc(d.comment)}`);
  return lines.join('\n');
}

/**
 * Сводка закупа за смену в Telegram.
 *
 * Каждый приход уходит отдельным альбомом со своей подписью: руководителю
 * важно видеть «что купили» вместе с фотографиями именно этого прихода, а не
 * общую кучу снимков без привязки.
 *
 * Приходы без фотографий не пропускаем, а перечисляем текстом в конце — то,
 * что закуп оформили без фото, само по себе повод обратить внимание.
 */
export async function sendPurchasesDigest(
  filialIds: number[],
  day: string = todayTashkent()
): Promise<{ sent: number; skipped: number; noPhoto: number; error?: string }> {
  const chatId = purchasesChatId();
  if (!chatId) return { sent: 0, skipped: 0, noPhoto: 0, error: 'TG_CHAT_ID не задан' };
  if (filialIds.length === 0) return { sent: 0, skipped: 0, noPhoto: 0 };

  const dayExpr = sql`coalesce(${schema.botActions.details}->>'selected_date', to_char(${schema.botActions.createdAt} at time zone 'Asia/Tashkent', 'YYYY-MM-DD'))`;

  const rows = await db
    .select({
      id: schema.botActions.id,
      userName: schema.botActions.userName,
      documentNumber: schema.botActions.documentNumber,
      details: schema.botActions.details,
    })
    .from(schema.botActions)
    .where(and(
      inArray(schema.botActions.filialId, filialIds),
      eq(schema.botActions.actionType, 'invoice'),
      sql`${dayExpr} = ${day}`
    ))
    .orderBy(schema.botActions.id);

  let sent = 0;
  let skipped = 0;
  const withoutPhoto: string[] = [];

  for (const row of rows) {
    const d = (row.details || {}) as Details;

    // Повторный запуск не должен слать то же ещё раз: отметку ставим в сам
    // документ. Планировщик может сработать дважды, и человек может нажать
    // «отправить» руками — в группе от этого дублей быть не должно.
    if (d.tg_sent_at) { skipped++; continue; }

    const photos = Array.isArray(d.photos) ? d.photos : [];
    if (photos.length === 0) {
      withoutPhoto.push(`• ${esc(d.supplier_name || '—')} — ${money(sumOf(d.items || []))} сум (${esc(row.userName || '—')})`);
      continue;
    }

    const files: OutgoingPhoto[] = [];
    for (const p of photos) {
      const file = await downloadPhoto(p.path);
      if (!file?.body) continue;
      const bytes = new Uint8Array(await new Response(file.body).arrayBuffer());
      files.push({
        bytes,
        contentType: file.contentType,
        filename: `${PHOTO_LABELS[p.kind] || 'photo'}.jpg`,
      });
    }
    if (files.length === 0) {
      withoutPhoto.push(`• ${esc(d.supplier_name || '—')} — фото не читаются из хранилища`);
      continue;
    }

    const ok = await sendPhotoAlbum(chatId, files, caption({ ...row, details: d }));
    if (!ok) continue;

    sent++;
    await db
      .update(schema.botActions)
      .set({ details: { ...d, tg_sent_at: new Date().toISOString() } })
      .where(eq(schema.botActions.id, row.id));
  }

  if (withoutPhoto.length > 0) {
    await sendMessage(
      chatId,
      [`⚠️ <b>Закуп без фотографий</b> за ${fmtDate(day)}:`, '', ...withoutPhoto, '', 'По таким приходам не проверить, что именно привезли.'].join('\n')
    );
  }

  return { sent, skipped, noPhoto: withoutPhoto.length };
}
