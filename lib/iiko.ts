import crypto from 'node:crypto';

export type IikoCreds = {
  server: string;
  login: string;
  password: string;
};

export function getDefaultCreds(): IikoCreds {
  return {
    server: (process.env.IIKO_SERVER || '').replace(/\/+$/, ''),
    login: process.env.IIKO_LOGIN || '',
    password: process.env.IIKO_PASSWORD || '',
  };
}

export function isCredsConfigured(c: IikoCreds): boolean {
  return Boolean(c.server && c.login && c.password);
}

function sha1(text: string): string {
  return crypto.createHash('sha1').update(text, 'utf8').digest('hex');
}

const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function rawFetch(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: {
      'User-Agent': BROWSER_UA,
      ...(init?.headers || {}),
    },
  });
}

export async function iikoAuth(creds: IikoCreds = getDefaultCreds()): Promise<string | null> {
  if (!creds.server || !creds.login || !creds.password) return null;
  const url = `${creds.server}/resto/api/auth?login=${encodeURIComponent(creds.login)}&pass=${sha1(creds.password)}`;
  const res = await rawFetch(url, { headers: { Accept: 'text/plain' } });
  if (!res.ok) return null;
  return (await res.text()).trim();
}

export async function iikoLogout(token: string, creds: IikoCreds = getDefaultCreds()): Promise<void> {
  await rawFetch(`${creds.server}/resto/api/logout?key=${token}`).catch(() => {});
}

export async function iikoGet<T = unknown>(endpoint: string, token: string, creds: IikoCreds = getDefaultCreds()): Promise<T | null> {
  const res = await rawFetch(`${creds.server}/resto/api/${endpoint}`, {
    headers: { Cookie: `key=${token}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

export async function iikoGetText(endpoint: string, token: string, creds: IikoCreds = getDefaultCreds()): Promise<string | null> {
  const res = await rawFetch(`${creds.server}/resto/api/${endpoint}`, {
    headers: { Cookie: `key=${token}` },
  });
  if (!res.ok) return null;
  return res.text();
}

export async function withIikoSession<T>(fn: (token: string) => Promise<T>, creds: IikoCreds = getDefaultCreds()): Promise<T> {
  const token = await iikoAuth(creds);
  if (!token) throw new Error('iiko auth failed');
  try {
    return await fn(token);
  } finally {
    await iikoLogout(token, creds);
  }
}
