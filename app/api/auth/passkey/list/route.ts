import { requireSession } from '@/lib/auth-session';
import { getUserPasskeys } from '@/lib/users';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await requireSession();
  const keys = await getUserPasskeys(session.id);
  return Response.json({
    passkeys: keys.map((k) => ({ id: k.id, createdAt: k.createdAt })),
  });
}
