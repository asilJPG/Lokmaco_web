import { requireSession } from '@/lib/auth-session';
import { getCurrentFilialIds } from '@/lib/current-filial';
import { canAccess } from '@/lib/access';
import { isPathAllowed } from '@/lib/storage';
import { parseInvoicePhoto } from '@/lib/parse-invoice-photo';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Распознать накладную по фото вручную.
 *
 * Основной путь другой: скан с почты разбирается сразу при приёме и приезжает
 * уже готовым. Эта ручка нужна для фото, снятого прямо в форме, и как запасной
 * вариант, если разбор при приёме не удался.
 */
export async function POST(req: Request) {
  const session = await requireSession();
  if (!canAccess(session.role, 'invoice')) {
    return Response.json({ error: 'Доступ запрещен для вашей роли' }, { status: 403 });
  }

  const filialIds = await getCurrentFilialIds();
  if (filialIds.length === 0) return Response.json({ error: 'Филиал не выбран' }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const path = String(body?.path || '');
  if (!path) return Response.json({ error: 'Сначала приложи фото накладной' }, { status: 400 });
  if (!isPathAllowed(path, session.filialIds)) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    return Response.json(await parseInvoicePhoto(filialIds[0], path));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'Не удалось распознать' }, { status: 422 });
  }
}
