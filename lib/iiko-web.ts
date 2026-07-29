export type IikoWebCreds = {
  url: string;
  login: string;
  password: string;
};

export function getDefaultWebCreds(): IikoWebCreds {
  return {
    url: (process.env.IIKO_WEB_URL || '').replace(/\/+$/, ''),
    login: process.env.IIKO_WEB_LOGIN || '',
    password: process.env.IIKO_WEB_PASSWORD || '',
  };
}

const cache = new Map<string, { cookies: string; at: number }>();
const TTL = 10 * 60_000;

const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function login(creds: IikoWebCreds): Promise<string> {
  if (!creds.url || !creds.login || !creds.password) {
    throw new Error('iikoWeb credentials not set');
  }
  const urls = [`${creds.url}/api/auth/login`, `${creds.url}/api/auth`];
  for (const url of urls) {
    const res = await fetch(url, {
      method: 'POST',
      redirect: 'manual',
      headers: { 'Content-Type': 'application/json', 'User-Agent': BROWSER_UA, Accept: 'application/json' },
      body: JSON.stringify({ login: creds.login, password: creds.password }),
    });
    const body = await res.text();
    const setCookies = res.headers.getSetCookie?.() || [];
    if (res.status === 200 && setCookies.length > 0 && /authorized|token|OK|"error":false/.test(body)) {
      return setCookies.map((c) => c.split(';')[0]).join('; ');
    }
  }
  throw new Error('iikoWeb auth failed');
}

export const IIKO_WEB_HEADERS = { 'User-Agent': BROWSER_UA, Accept: 'application/json' };

export async function withIikoWebSession<T>(fn: (cookies: string, url: string) => Promise<T>, creds: IikoWebCreds = getDefaultWebCreds()): Promise<T> {
  const cacheKey = `${creds.url}|${creds.login}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < TTL) {
    try { return await fn(cached.cookies, creds.url); } catch { cache.delete(cacheKey); }
  }
  const cookies = await login(creds);
  cache.set(cacheKey, { cookies, at: Date.now() });
  return fn(cookies, creds.url);
}
