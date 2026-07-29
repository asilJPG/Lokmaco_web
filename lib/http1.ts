import http from 'node:http';
import https from 'node:https';

/**
 * Minimal fetch-alike built on node:https.
 *
 * iikoWeb answers 500 to every request issued through the global fetch
 * (undici) but responds normally to the same request over node:https — the
 * difference is the transport, not the headers or the body (content-length,
 * accept-encoding, connection and body-encoding variants were all tried and
 * all still failed). The legacy site used this same approach, which is why it
 * kept working. iiko's XML API is fine with global fetch; only iikoWeb needs
 * this.
 */

export type Http1Response = {
  status: number;
  ok: boolean;
  text: () => Promise<string>;
  json: <T = unknown>() => Promise<T>;
  getSetCookie: () => string[];
  headers: Record<string, string | string[] | undefined>;
};

export type Http1Init = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  /** Defaults to the IIKO_REJECT_UNAUTHORIZED env flag, like the XML client. */
  rejectUnauthorized?: boolean;
};

export function http1Fetch(urlStr: string, init: Http1Init = {}): Promise<Http1Response> {
  return new Promise((resolve, reject) => {
    let parsed: URL;
    try {
      parsed = new URL(urlStr);
    } catch {
      reject(new Error(`Invalid URL: ${urlStr}`));
      return;
    }

    const headers: Record<string, string> = { ...(init.headers || {}) };
    if (init.body != null && headers['Content-Length'] == null && headers['content-length'] == null) {
      headers['Content-Length'] = String(Buffer.byteLength(init.body));
    }

    const isHttps = parsed.protocol === 'https:';
    const client = isHttps ? https : http;

    const req = client.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: init.method || 'GET',
        headers,
        rejectUnauthorized: init.rejectUnauthorized ?? process.env.IIKO_REJECT_UNAUTHORIZED !== 'false',
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          const status = res.statusCode || 0;
          resolve({
            status,
            ok: status >= 200 && status < 300,
            text: async () => body,
            json: async <T>() => JSON.parse(body) as T,
            getSetCookie: () => res.headers['set-cookie'] || [],
            headers: res.headers,
          });
        });
      }
    );

    req.on('error', reject);
    if (init.body != null) req.write(init.body);
    req.end();
  });
}
