import { eq } from 'drizzle-orm';
import { db, schema } from '@/db/client';

export async function getUserByAccessCode(code: string) {
  const rows = await db.select().from(schema.users).where(eq(schema.users.accessCode, code)).limit(1);
  return rows[0] ?? null;
}

export async function getUserById(id: number) {
  const rows = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getUserFilials(userId: number): Promise<number[]> {
  const rows = await db.select({ id: schema.userFilials.filialId })
    .from(schema.userFilials)
    .where(eq(schema.userFilials.userId, userId));
  return rows.map(r => r.id);
}

export async function updateLastLogin(userId: number, method: string) {
  await db.update(schema.users)
    .set({ lastLoginAt: new Date(), lastLoginMethod: method })
    .where(eq(schema.users.id, userId));
}

export async function getPasskeyByCredentialId(credId: string) {
  const rows = await db.select().from(schema.userPasskeys)
    .where(eq(schema.userPasskeys.credentialId, credId)).limit(1);
  return rows[0] ?? null;
}

export async function bumpPasskeyCounter(credId: string, newCounter: number) {
  await db.update(schema.userPasskeys)
    .set({ counter: newCounter })
    .where(eq(schema.userPasskeys.credentialId, credId));
}

export async function getUserPasskeys(userId: number) {
  return db.select().from(schema.userPasskeys).where(eq(schema.userPasskeys.userId, userId));
}

export async function savePasskey(userId: number, credentialId: string, publicKey: string, counter: number, rpId?: string) {
  await db.insert(schema.userPasskeys).values({ userId, credentialId, publicKey, counter, rpId });
}

/**
 * Ключи, которыми пользователь реально может войти на этом домене.
 * Ключ, заведённый на старом сайте, физически не сработает на новом, поэтому
 * блокировать из-за него вход по коду нельзя — иначе аккаунт запирается.
 */
export async function getUsablePasskeys(userId: number, rpId: string) {
  const all = await getUserPasskeys(userId);
  return all.filter((p) => p.rpId === rpId);
}

export async function deletePasskey(userId: number, id: string) {
  const { eq, and } = await import('drizzle-orm');
  await db.delete(schema.userPasskeys)
    .where(and(eq(schema.userPasskeys.id, id), eq(schema.userPasskeys.userId, userId)));
}
