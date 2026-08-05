import { withIikoSession, iikoGetText } from '@/lib/iiko';
import { requireSession } from '@/lib/auth-session';
import { getCurrentFilialIds } from '@/lib/current-filial';
import { resolveIikoCreds } from '@/lib/filial-iiko';
import { cached, invalidateCached } from '@/lib/iiko-cache';

export const dynamic = 'force-dynamic';

function tag(xml: string, name: string): string {
  const m = xml.match(new RegExp(`<${name}>([^<]*)</${name}>`));
  return m ? m[1].trim() : '';
}

// Полчаса: список складов меняется раз в никогда, а каждый промах стоит полного
// круга «прочитать креды из БД → auth в iiko → запрос». Кэш общий (память + БД),
// потому что на Vercel инстансы постоянно холодные и Map в процессе почти всегда
// пустая — см. lib/iiko-cache.ts.
const TTL = 30 * 60_000;

export async function GET() {
  await requireSession();
  const ids = await getCurrentFilialIds();
  if (ids.length === 0) return Response.json({ stores: [] });
  const filialId = ids[0];

  try {
    const stores = await cached<{ id: string; name: string }[]>('stores', filialId, TTL, async () => {
      // Креды читаем только на промахе: попадание в кэш не должно стоить похода в БД.
      const { xml: creds } = await resolveIikoCreds(filialId);
      return withIikoSession(async (token) => {
        const xml = await iikoGetText('corporation/stores', token, creds);
        if (!xml) return [];
        const results: { id: string; name: string }[] = [];
        const regex = /<corporateItemDto>([\s\S]*?)<\/corporateItemDto>/g;
        let m: RegExpExecArray | null;
        while ((m = regex.exec(xml)) !== null) {
          const id = tag(m[1], 'id');
          const name = tag(m[1], 'name');
          const type = tag(m[1], 'type');
          if (id && name && type === 'STORE') results.push({ id, name });
        }
        return results;
      }, creds);
    });

    // Пустой ответ iiko (пустой XML, сорванный запрос) кэшировать нельзя: на 30
    // минут все склады бы пропали из интерфейса. Сбрасываем и отдаём как есть.
    if (stores.length === 0) await invalidateCached('stores', filialId);

    return Response.json({ stores });
  } catch (e) {
    return Response.json({ stores: [], error: e instanceof Error ? e.message : 'iiko failed' });
  }
}
