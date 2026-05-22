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

const IIKO_SERVER = (process.env.IIKO_SERVER || "").replace(/\/+$/, "");
const IIKO_LOGIN = process.env.IIKO_LOGIN || "";
const IIKO_PASSWORD = process.env.IIKO_PASSWORD || "";

// ─── SHA1 hash (same as bot.py sha1_hash) ───
export function sha1(text) {
  return crypto.createHash("sha1").update(text, "utf8").digest("hex");
}

// ─── Get auth token ───
// GET /resto/api/auth?login=...&pass=SHA1(password)
export async function iikoAuth() {
  try {
    const url = `${IIKO_SERVER}/resto/api/auth?login=${encodeURIComponent(IIKO_LOGIN)}&pass=${sha1(IIKO_PASSWORD)}`;
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "text/plain" },
      // @ts-ignore — Node 18+ supports this
      ...(IIKO_SERVER.startsWith("https") ? { rejectUnauthorized: false } : {}),
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

// ─── Logout ───
export async function iikoLogout(token) {
  try {
    await fetch(`${IIKO_SERVER}/resto/api/logout?key=${token}`);
  } catch {}
}

// ─── Fetch JSON endpoint ───
export async function iikoGetJson(endpoint, token) {
  const res = await fetch(`${IIKO_SERVER}/resto/api/${endpoint}`, {
    headers: { Cookie: `key=${token}` },
  });
  if (res.ok) return await res.json();
  return null;
}

// ─── Fetch raw (XML/text) endpoint ───
export async function iikoGetRaw(endpoint, token) {
  const res = await fetch(`${IIKO_SERVER}/resto/api/${endpoint}`, {
    headers: { Cookie: `key=${token}` },
  });
  if (res.ok) return await res.text();
  return null;
}

// ─── Post XML ───
export async function iikoPostXml(endpoint, xmlBody, token) {
  const res = await fetch(`${IIKO_SERVER}/resto/api/${endpoint}`, {
    method: "POST",
    headers: {
      Cookie: `key=${token}`,
      "Content-Type": "application/xml",
    },
    body: xmlBody,
  });
  return res.ok;
}

// ─── Convenience: auth → action → logout ───
export async function withIikoSession(fn) {
  const token = await iikoAuth();
  if (!token) throw new Error("iiko auth failed");
  try {
    return await fn(token);
  } finally {
    await iikoLogout(token);
  }
}
