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
