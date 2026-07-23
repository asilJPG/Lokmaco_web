/**
 * iiko Server API auth helpers
 * Mirrors bot.py: iiko_auth(), iiko_logout(), fetch_iiko_list(), fetch_iiko_raw()
 *
 * ENV vars (same as bot):
 *   IIKO_SERVER      — e.g. https://your-server:port
 *   IIKO_LOGIN       — API user login
 *   IIKO_PASSWORD    — API user password (plain, hashed with SHA1)
 *   IIKO_WEB_URL     — e.g. https://the-lokmako.iikoweb.ru
 *   IIKO_WEB_LOGIN   — iikoWeb login
 *   IIKO_WEB_PASSWORD— iikoWeb password
 *   OPENROUTER_API_KEY
 *   OPENROUTER_MODEL — default google/gemma-4-27b-it:free
 */

import crypto from "crypto";
import http from "http";
import https from "https";
import { URL } from "url";

const IIKO_SERVER = (process.env.IIKO_SERVER || "").replace(/\/+$/, "");
const IIKO_LOGIN = process.env.IIKO_LOGIN || "";
const IIKO_PASSWORD = process.env.IIKO_PASSWORD || "";

export async function http1Fetch(urlStr, options = {}) {
  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = new URL(urlStr);
      const method = options.method || "GET";
      const headers = options.headers || {};

      if (!headers["User-Agent"] && !headers["user-agent"]) {
        headers["User-Agent"] = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
      }

      const reqOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === "https:" ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: method,
        headers: headers,
        rejectUnauthorized: process.env.IIKO_REJECT_UNAUTHORIZED !== "false",
      };

      const client = parsedUrl.protocol === "https:" ? https : http;

      const req = client.request(reqOptions, (res) => {
        res.setEncoding("utf8");
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          resolve({
            status: res.statusCode,
            ok: res.statusCode >= 200 && res.statusCode < 300,
            headers: {
              getSetCookie() {
                const setCookie = res.headers["set-cookie"];
                if (!setCookie) return [];
                return Array.isArray(setCookie) ? setCookie : [setCookie];
              },
              get(name) {
                return res.headers[name.toLowerCase()] || "";
              }
            },
            text: async () => data,
            json: async () => JSON.parse(data),
          });
        });
      });

      req.on("error", (err) => {
        reject(err);
      });

      if (options.body) {
        req.write(options.body);
      }
      req.end();
    } catch (e) {
      reject(e);
    }
  });
}

export function sha1(text) {
  return crypto.createHash("sha1").update(text, "utf8").digest("hex");
}

export async function iikoAuth() {
  try {
    const url = `${IIKO_SERVER}/resto/api/auth?login=${encodeURIComponent(IIKO_LOGIN)}&pass=${sha1(IIKO_PASSWORD)}`;
    const res = await http1Fetch(url, {
      method: "GET",
      headers: { Accept: "text/plain" },
    });
    if (res.ok) {
      const token = (await res.text()).trim();
      return token;
    }
  } catch (e) {
    console.error("[iiko] auth error:", e.message);
  }
  return null;
}

export async function iikoLogout(token) {
  try {
    await http1Fetch(`${IIKO_SERVER}/resto/api/logout?key=${token}`);
  } catch {}
}

export async function iikoGetJson(endpoint, token) {
  const res = await http1Fetch(`${IIKO_SERVER}/resto/api/${endpoint}`, {
    headers: { Cookie: `key=${token}` },
  });
  if (res.ok) return await res.json();
  return null;
}

export async function iikoGetRaw(endpoint, token) {
  const res = await http1Fetch(`${IIKO_SERVER}/resto/api/${endpoint}`, {
    headers: { Cookie: `key=${token}` },
  });
  if (res.ok) return await res.text();
  return null;
}

export async function iikoPostXml(endpoint, xmlBody, token) {
  const res = await http1Fetch(`${IIKO_SERVER}/resto/api/${endpoint}`, {
    method: "POST",
    headers: {
      Cookie: `key=${token}`,
      "Content-Type": "application/xml",
    },
    body: xmlBody,
  });
  return res.ok;
}

export async function withIikoSession(fn) {
  const token = await iikoAuth();
  if (!token) throw new Error("iiko auth failed");
  try {
    return await fn(token);
  } finally {
    await iikoLogout(token);
  }
}

export async function createWriteoff(storeId, items, comment = "", accountId = "6f983109-eb1f-4517-917b-9912d5eeda16") {
  return await withIikoSession(async (token) => {
    const now = new Date();
    const tashkent = new Date(now.getTime() + 5 * 60 * 60 * 1000);
    const pad = (n) => String(n).padStart(2, "0");
    const dateIncomingStr = `${tashkent.getUTCFullYear()}-${pad(tashkent.getUTCMonth() + 1)}-${pad(tashkent.getUTCDate())}T${pad(tashkent.getUTCHours())}:${pad(tashkent.getUTCMinutes())}:${pad(tashkent.getUTCSeconds())}`;

    const body = {
      dateIncoming: dateIncomingStr,
      status: "PROCESSED",
      storeId: storeId,
      accountId: accountId || "6f983109-eb1f-4517-917b-9912d5eeda16", // Пищевые потери и списания
      items: items.map((it) => ({
        productId: it.product_id,
        amount: parseFloat(it.quantity) || 0,
      })),
      comment: comment || "Списание через мобильное приложение",
    };

    const res = await http1Fetch(`${IIKO_SERVER}/resto/api/v2/documents/writeoff`, {
      method: "POST",
      headers: {
        Cookie: `key=${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.result === "SUCCESS") {
        return { success: true, documentNumber: data.response?.documentNumber };
      } else {
        const errors = (data?.errors || []).join(", ") || "Ошибка Iiko API";
        return { success: false, error: errors };
      }
    } else {
      const text = await res.text();
      return { success: false, error: `Iiko API returned status ${res.status}: ${text}` };
    }
  });
}

export async function getAccounts() {
  return await withIikoSession(async (token) => {
    const res = await http1Fetch(`${IIKO_SERVER}/resto/api/v2/entities/list?rootType=Account`, {
      method: "GET",
      headers: {
        Cookie: `key=${token}`,
        "Content-Type": "application/json",
      },
    });

    if (res.ok) {
      const list = await res.json();
      // Filter out deleted accounts
      const activeAccounts = (list || [])
        .filter((acc) => !acc.deleted)
        .map((acc) => ({
          id: acc.id,
          name: acc.name,
          code: acc.code || "",
          type: acc.type,
        }));
      // Sort alphabetically by name
      activeAccounts.sort((a, b) => a.name.localeCompare(b.name, "ru"));
      return { success: true, data: activeAccounts };
    } else {
      const text = await res.text();
      return { success: false, error: `Iiko API returned status ${res.status}: ${text}` };
    }
  });
}

