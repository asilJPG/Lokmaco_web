import { eq } from 'drizzle-orm';
import { requireSession } from '@/lib/auth-session';
import { db, schema } from '@/db/client';
import { encrypt } from '@/lib/crypto';
import { invalidateFilialCreds } from '@/lib/filial-iiko';

export const dynamic = 'force-dynamic';

// Возвращаем ответ, а не бросаем: Next 14 не перехватывает throw new Response
// (это паттерн Remix), и наружу вместо 403 уходил бы 500.
function requireAdmin(role: string): Response | null {
  return role.split(':')[0] === 'admin' ? null : Response.json({ error: 'Admin only' }, { status: 403 });
}

export async function POST(req: Request) {
  const s = await requireSession();
  const denied = requireAdmin(s.role);
  if (denied) return denied;
  const b = await req.json();
  if (!b.name) return Response.json({ error: 'name required' }, { status: 400 });
  const [row] = await db.insert(schema.filials).values({
    name: String(b.name),
    iikoServer: b.iikoServer || null,
    iikoOrgId: b.iikoOrgId || null,
    iikoLogin: b.iikoLogin || null,
    iikoPasswordEnc: b.iikoPassword ? encrypt(String(b.iikoPassword)) : null,
    iikoWebUrl: b.iikoWebUrl || null,
    iikoWebLogin: b.iikoWebLogin || null,
    iikoWebPasswordEnc: b.iikoWebPassword ? encrypt(String(b.iikoWebPassword)) : null,
    timezone: b.timezone || 'Asia/Tashkent',
  }).returning({ id: schema.filials.id });
  return Response.json({ success: true, id: row.id });
}

export async function PATCH(req: Request) {
  const s = await requireSession();
  const denied = requireAdmin(s.role);
  if (denied) return denied;
  const b = await req.json();
  const id = Number(b.id);
  if (!id) return Response.json({ error: 'id required' }, { status: 400 });
  const update: Record<string, unknown> = {};
  if (b.name !== undefined) update.name = String(b.name);
  if (b.iikoServer !== undefined) update.iikoServer = b.iikoServer || null;
  if (b.iikoOrgId !== undefined) update.iikoOrgId = b.iikoOrgId || null;
  if (b.iikoLogin !== undefined) update.iikoLogin = b.iikoLogin || null;
  if (b.iikoPassword) update.iikoPasswordEnc = encrypt(String(b.iikoPassword));
  if (b.iikoWebUrl !== undefined) update.iikoWebUrl = b.iikoWebUrl || null;
  if (b.iikoWebLogin !== undefined) update.iikoWebLogin = b.iikoWebLogin || null;
  if (b.iikoWebPassword) update.iikoWebPasswordEnc = encrypt(String(b.iikoWebPassword));
  if (b.timezone !== undefined) update.timezone = b.timezone;
  if (Object.keys(update).length > 0) {
    await db.update(schema.filials).set(update).where(eq(schema.filials.id, id));
    invalidateFilialCreds(id);
  }
  return Response.json({ success: true });
}

export async function DELETE(req: Request) {
  const s = await requireSession();
  const denied = requireAdmin(s.role);
  if (denied) return denied;
  const id = Number(new URL(req.url).searchParams.get('id'));
  if (!id) return Response.json({ error: 'id required' }, { status: 400 });
  await db.delete(schema.filials).where(eq(schema.filials.id, id));
  invalidateFilialCreds(id);
  return Response.json({ success: true });
}
