import { requireSession } from '@/lib/auth-session';
import { createUser, deleteUser, updateUser } from '@/lib/admin-users';

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
  if (!b.name || !b.role) return Response.json({ error: 'name, role required' }, { status: 400 });
  const filialIds: number[] = Array.isArray(b.filialIds) ? b.filialIds.map(Number).filter(Boolean) : [];
  const u = await createUser({
    name: String(b.name),
    role: String(b.role),
    accessCode: b.accessCode ? String(b.accessCode) : null,
    tgId: b.tgId ? Number(b.tgId) : null,
    filialIds,
  });
  return Response.json({ success: true, id: u.id });
}

export async function PATCH(req: Request) {
  const s = await requireSession();
  const denied = requireAdmin(s.role);
  if (denied) return denied;
  const b = await req.json();
  const id = Number(b.id);
  if (!id) return Response.json({ error: 'id required' }, { status: 400 });
  await updateUser(id, {
    name: b.name !== undefined ? String(b.name) : undefined,
    role: b.role !== undefined ? String(b.role) : undefined,
    accessCode: b.accessCode !== undefined ? (b.accessCode ? String(b.accessCode) : null) : undefined,
    tgId: b.tgId !== undefined ? (b.tgId ? Number(b.tgId) : null) : undefined,
    filialIds: Array.isArray(b.filialIds) ? b.filialIds.map(Number).filter(Boolean) : undefined,
  });
  return Response.json({ success: true });
}

export async function DELETE(req: Request) {
  const s = await requireSession();
  const denied = requireAdmin(s.role);
  if (denied) return denied;
  const id = Number(new URL(req.url).searchParams.get('id'));
  if (!id) return Response.json({ error: 'id required' }, { status: 400 });
  if (id === s.id) return Response.json({ error: 'Нельзя удалить себя' }, { status: 400 });
  await deleteUser(id);
  return Response.json({ success: true });
}
