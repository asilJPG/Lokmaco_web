import { requireSession } from '@/lib/auth-session';
import { getCurrentFilialIds } from '@/lib/current-filial';
import { resolveIikoCreds } from '@/lib/filial-iiko';
import { withIikoSession, iikoGetText } from '@/lib/iiko';
import { canAccess } from '@/lib/access';

export const dynamic = 'force-dynamic';

type Product = { id: string; name: string; num?: string; code?: string; type?: string; deleted?: boolean };

/**
 * Номенклатура типа SERVICE — то, что можно поставить строкой в акт приёма
 * услуг (Такси, Стоянка, Зарплата сотрудникам…). В акте выбирается и услуга,
 * и счёт затрат: раньше услуга была прибита к «Транспорт расходы».
 */
export async function GET() {
  const session = await requireSession();
  if (!canAccess(session.role, 'services')) {
    return Response.json({ error: 'Доступ запрещен для вашей роли' }, { status: 403 });
  }

  const ids = await getCurrentFilialIds();
  if (ids.length === 0) return Response.json({ data: [] });
  const { xml: creds } = await resolveIikoCreds(ids[0]);

  try {
    const raw = await withIikoSession(
      (t) => iikoGetText('v2/entities/products/list?includeDeleted=false', t, creds),
      creds
    );
    if (!raw) return Response.json({ data: [] });

    const list = JSON.parse(raw) as Product[];
    const data = list
      .filter((p) => p.type === 'SERVICE' && !p.deleted)
      // «Округление в пользу гостя» — служебные позиции iiko, в акте им не место.
      .filter((p) => !/округление/i.test(p.name || ''))
      .map((p) => ({ id: p.id, name: p.name, code: p.num || p.code || '' }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));

    return Response.json({ data });
  } catch (e) {
    return Response.json({ data: [], error: e instanceof Error ? e.message : 'iiko failed' });
  }
}
