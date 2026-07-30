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
  if (!res.ok) {
    noteAuthFailure(res.status, creds);
    return null;
  }
  return (await res.json()) as T;
}

export async function iikoGetText(endpoint: string, token: string, creds: IikoCreds = getDefaultCreds()): Promise<string | null> {
  const res = await rawFetch(`${creds.server}/resto/api/${endpoint}`, {
    headers: { Cookie: `key=${token}` },
  });
  if (!res.ok) {
    noteAuthFailure(res.status, creds);
    return null;
  }
  return res.text();
}

// Раньше каждый вызов делал auth + logout вокруг одного запроса: три обращения
// к серверу iiko вместо одного, ~60 мс лишних на круг, а вкладка аналитики
// дёргает три роута сразу. Держим один токен на филиал и переиспользуем его.
// TTL намеренно короче реального времени жизни сессии iiko, поэтому протухший
// токен в работу не попадает; logout для живого токена не зовём — он бы его и
// убил. Одновременных сессий при этом не больше, чем было: одна на филиал.
const TOKEN_TTL = 5 * 60_000;
const tokens = new Map<string, { token: string; at: number }>();
const inflight = new Map<string, Promise<string>>();

function credsKey(c: IikoCreds): string {
  return `${c.server}|${c.login}`;
}

export function invalidateIikoToken(creds: IikoCreds = getDefaultCreds()): void {
  tokens.delete(credsKey(creds));
}

async function getToken(creds: IikoCreds): Promise<string> {
  const key = credsKey(creds);
  const hit = tokens.get(key);
  if (hit && Date.now() - hit.at < TOKEN_TTL) return hit.token;

  // Параллельные запросы (три вкладки аналитики разом) не должны логиниться
  // каждый по разу — второй ждёт результат первого.
  const pending = inflight.get(key);
  if (pending) return pending;

  const p = (async () => {
    const token = await iikoAuth(creds);
    if (!token) throw new Error('iiko auth failed');
    tokens.set(key, { token, at: Date.now() });
    return token;
  })().finally(() => inflight.delete(key));

  inflight.set(key, p);
  return p;
}

export async function withIikoSession<T>(fn: (token: string) => Promise<T>, creds: IikoCreds = getDefaultCreds()): Promise<T> {
  // Повторять fn при ошибке нельзя: на создании документа это провело бы в
  // iiko второй такой же. Протухший токен лечится иначе — 401 сбрасывает кэш
  // (см. noteAuthFailure), и следующий запрос логинится заново.
  return fn(await getToken(creds));
}

/** Вызывать при 401/403 от iiko: следующий запрос возьмёт свежий токен. */
export function noteAuthFailure(status: number, creds: IikoCreds = getDefaultCreds()): void {
  if (status === 401 || status === 403) invalidateIikoToken(creds);
}

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Документы, которые iiko принимает только XML-ом (акт услуг идёт как incomingInvoice). */
export async function iikoPostXml(endpoint: string, xml: string, token: string, creds: IikoCreds = getDefaultCreds()): Promise<boolean> {
  const res = await rawFetch(`${creds.server}/resto/api/${endpoint}?key=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/xml' },
    body: xml,
  });
  if (!res.ok) return false;
  const text = await res.text();
  return !/<valid>false<\/valid>/i.test(text) && !/<errorMessage>/i.test(text);
}

export type IikoAccount = { id: string; name: string; code: string; type: string };

export async function getAccounts(creds: IikoCreds = getDefaultCreds()): Promise<IikoAccount[]> {
  return withIikoSession(async (token) => {
    const res = await rawFetch(`${creds.server}/resto/api/v2/entities/list?rootType=Account`, {
      headers: { Cookie: `key=${token}`, 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`iiko accounts: ${res.status}`);
    const list = (await res.json()) as { id: string; name: string; code?: string; type: string; deleted?: boolean }[];
    return (list || [])
      .filter((a) => !a.deleted)
      .map((a) => ({ id: a.id, name: a.name, code: a.code || '', type: a.type }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, creds);
}

/** Счёт «Пищевые потери и списания» — дефолт для всех списаний, как в легаси. */
export const WRITEOFF_ACCOUNT_ID = '6f983109-eb1f-4517-917b-9912d5eeda16';

export async function createWriteoff(
  storeId: string,
  items: { product_id: string; quantity: number }[],
  comment: string,
  accountId: string,
  creds: IikoCreds = getDefaultCreds()
): Promise<{ success: boolean; documentNumber?: string; error?: string }> {
  return withIikoSession(async (token) => {
    // iiko ждёт локальное ташкентское время без зоны.
    const t = new Date(Date.now() + 5 * 60 * 60 * 1000);
    const p = (n: number) => String(n).padStart(2, '0');
    const dateIncoming = `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}T${p(t.getUTCHours())}:${p(t.getUTCMinutes())}:${p(t.getUTCSeconds())}`;

    const res = await rawFetch(`${creds.server}/resto/api/v2/documents/writeoff`, {
      method: 'POST',
      headers: { Cookie: `key=${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dateIncoming,
        status: 'PROCESSED',
        storeId,
        accountId: accountId || WRITEOFF_ACCOUNT_ID,
        items: items.map((it) => ({ productId: it.product_id, amount: Number(it.quantity) || 0 })),
        comment,
      }),
    });

    if (!res.ok) {
      return { success: false, error: `iiko вернул ${res.status}: ${(await res.text()).slice(0, 300)}` };
    }
    const data = (await res.json()) as { result?: string; errors?: string[]; response?: { documentNumber?: string } };
    if (data?.result === 'SUCCESS') {
      return { success: true, documentNumber: data.response?.documentNumber };
    }
    return { success: false, error: (data?.errors || []).join(', ') || 'Ошибка iiko API' };
  }, creds);
}
