import { and, desc, eq, inArray } from 'drizzle-orm';
import { db, schema } from '@/db/client';
import { requireSession } from '@/lib/auth-session';
import { getCurrentFilialIds } from '@/lib/current-filial';
import { canAccess } from '@/lib/access';
import { photoUrl } from '@/lib/storage';

export const dynamic = 'force-dynamic';

/** Сканы, ждущие оформления. */
export async function GET() {
  const session = await requireSession();
  if (!canAccess(session.role, 'invoice')) {
    return Response.json({ error: 'Доступ запрещен для вашей роли' }, { status: 403 });
  }
  const filialIds = await getCurrentFilialIds();
  if (filialIds.length === 0) return Response.json({ scans: [] });

  const rows = await db
    .select()
    .from(schema.scanInbox)
    .where(and(inArray(schema.scanInbox.filialId, filialIds), eq(schema.scanInbox.status, 'new')))
    .orderBy(desc(schema.scanInbox.createdAt))
    .limit(20);

  return Response.json({
    scans: rows.map((r) => ({
      id: r.id,
      path: r.photoPath,
      url: photoUrl(r.photoPath),
      from: r.fromEmail,
      subject: r.subject,
      createdAt: r.createdAt,
      parsed: r.parsed,
      parseError: r.parseError,
    })),
  });
}

/** Отметить скан обработанным или отклонить. */
export async function PATCH(req: Request) {
  const session = await requireSession();
  if (!canAccess(session.role, 'invoice')) {
    return Response.json({ error: 'Доступ запрещен для вашей роли' }, { status: 403 });
  }
  const filialIds = await getCurrentFilialIds();
  const b = await req.json().catch(() => ({}));
  const id = Number(b?.id || 0);
  const status = b?.status === 'used' ? 'used' : 'dismissed';
  if (!id) return Response.json({ error: 'id required' }, { status: 400 });

  await db
    .update(schema.scanInbox)
    .set({ status, handledAt: new Date(), handledBy: session.name })
    .where(and(eq(schema.scanInbox.id, id), inArray(schema.scanInbox.filialId, filialIds)));

  return Response.json({ ok: true });
}
