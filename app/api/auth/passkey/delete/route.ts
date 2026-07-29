import { requireSession } from '@/lib/auth-session';
import { deletePasskey } from '@/lib/users';

export const dynamic = 'force-dynamic';

export async function DELETE(req: Request) {
  const session = await requireSession();
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return Response.json({ error: 'id required' }, { status: 400 });
  await deletePasskey(session.id, id);
  return Response.json({ success: true });
}
