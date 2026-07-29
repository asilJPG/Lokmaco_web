import crypto from 'node:crypto';

function getKey(): Buffer {
  const k = process.env.IIKO_CRED_KEY;
  if (!k) throw new Error('IIKO_CRED_KEY env var is not set');
  const key = Buffer.from(k, 'base64');
  if (key.length !== 32) throw new Error('IIKO_CRED_KEY must be 32 bytes (base64-encoded)');
  return key;
}

export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decrypt(token: string | null | undefined): string | null {
  if (!token) return null;
  try {
    const buf = Buffer.from(token, 'base64');
    if (buf.length < 12 + 16 + 1) return null;
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
