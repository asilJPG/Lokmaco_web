const encoder = new TextEncoder();

function getSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET is not set');
  return s;
}

function base64urlEncode(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64urlDecodeToString(b64u: string): string {
  let b64 = b64u.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(arr);
}

async function hmacSign(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return base64urlEncode(sig);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacVerify(message: string, signature: string): Promise<boolean> {
  return timingSafeEqual(await hmacSign(message), signature);
}

export type SessionPayload = {
  id: number;
  tgId: number | null;
  name: string;
  role: string;
  filialIds: number[];
  exp?: number;
};

const DEFAULT_TTL_SECONDS = 7 * 24 * 3600;

export async function signSession(payload: Omit<SessionPayload, 'exp'>, ttlSeconds = DEFAULT_TTL_SECONDS): Promise<string> {
  const data = JSON.stringify({ ...payload, exp: Date.now() + ttlSeconds * 1000 });
  const payloadB64 = base64urlEncode(encoder.encode(data));
  const sig = await hmacSign(payloadB64);
  return `${payloadB64}.${sig}`;
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  try {
    if (!(await hmacVerify(payloadB64, sig))) return null;
    const data = JSON.parse(base64urlDecodeToString(payloadB64)) as SessionPayload;
    if (data.exp && data.exp < Date.now()) return null;
    if (!Array.isArray(data.filialIds)) data.filialIds = [];
    return data;
  } catch {
    return null;
  }
}
