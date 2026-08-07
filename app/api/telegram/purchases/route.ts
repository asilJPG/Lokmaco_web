import { db, schema } from '@/db/client';
import { getSession } from '@/lib/auth-session';
import { getCurrentFilialIds } from '@/lib/current-filial';
import { canAccess } from '@/lib/access';
import { sendPurchasesDigest } from '@/lib/purchases-digest';
import { todayTashkent } from '@/lib/period';

export const dynamic = 'force-dynamic';
// Скачать фото из хранилища и залить их в Телеграм — минуты не хватит только
// при очень большом дне, но запас нужен.
export const maxDuration = 60;

/**
 * Сводка закупа в Telegram.
 *
 * Два входа в одну и ту же работу:
 *  - планировщик Vercel в конце смены (заголовок `Authorization: Bearer <CRON_SECRET>`);
 *  - кнопка у админа, если надо отправить прямо сейчас.
 * Повторный запуск безопасен: уже отправленные приходы помечены и пропускаются.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization') || '';
  const fromCron = !!secret && auth === `Bearer ${secret}`;

  const url = new URL(req.url);
  const day = url.searchParams.get('day') || todayTashkent();

  if (fromCron) {
    // У планировщика нет сессии и «текущего филиала» — рассылаем по всем.
    const filials = await db.select({ id: schema.filials.id }).from(schema.filials);
    const result = await sendPurchasesDigest(filials.map((f) => f.id), day);
    return Response.json({ ok: true, day, ...result });
  }

  // Ручка вне middleware (см. PUBLIC_API), поэтому сессию проверяем сами:
  // без этого анонимный запрос упал бы 500 вместо честного 401.
  const session = await getSession();
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canAccess(session.role, 'reconciliation')) {
    return Response.json({ error: 'Доступ только для администратора' }, { status: 403 });
  }
  const filialIds = await getCurrentFilialIds();
  const result = await sendPurchasesDigest(filialIds, day);
  return Response.json({ ok: true, day, ...result });
}

/** Планировщик Vercel ходит GET-ом. */
export async function GET(req: Request) {
  return POST(req);
}
