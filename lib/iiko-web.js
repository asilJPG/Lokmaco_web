/**
 * iikoWeb API helpers for INTERNAL_TRANSFER documents
 * Mirrors bot.py: iiko_web_login(), import_transfer()
 *
 * Flow:
 *   1. POST /api/auth/login → get session cookie
 *   2. POST /api/documents/create → INTERNAL_TRANSFER DRAFT
 *   3. GET  /api/documents/get/{id} → load doc
 *   4. POST /api/documents/save/{id} → status PROCESSED with items
 */

import { http1Fetch } from "./iiko.js";

const IIKO_WEB_URL = (process.env.IIKO_WEB_URL || "https://the-lokmako.iikoweb.ru").replace(/\/+$/, "");
const IIKO_WEB_LOGIN = process.env.IIKO_WEB_LOGIN || "";
const IIKO_WEB_PASSWORD = process.env.IIKO_WEB_PASSWORD || "";

// Configuration IDs loaded from environment variables with fallbacks
const CONCEPTION_ID = process.env.IIKO_CONCEPTION_ID || "2609b25f-2180-bf98-5c1c-967664eea837";
const CONTAINER_ID = process.env.IIKO_CONTAINER_ID || "7ba81c3a-8de5-8f9d-fb9f-e39efcbc57cc";
const STORE_NUM = process.env.IIKO_STORE_NUM || "170243";
const KITCHEN_PREP_STORE = process.env.IIKO_KITCHEN_PREP_STORE || "2e9688bb-5130-4188-94a5-7a850e1d9f55";

async function loginToIikoWeb() {
  let cookies = "";
  const loginUrls = [
    `${IIKO_WEB_URL}/api/auth/login`,
    `${IIKO_WEB_URL}/api/auth`,
  ];

  let loggedIn = false;
  for (const url of loginUrls) {
    try {
      const headers = { "Content-Type": "application/json" };
      if (cookies) {
        headers["Cookie"] = cookies;
      }

      const res = await http1Fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ login: IIKO_WEB_LOGIN, password: IIKO_WEB_PASSWORD }),
        redirect: "manual",
      });
      const body = await res.text();

      const setCookies = res.headers.getSetCookie?.() || [];
      if (setCookies.length > 0) {
        cookies = setCookies.map((c) => c.split(";")[0]).join("; ");
      }

      if (res.status === 200 && (
        body.includes('"authorized":true') || 
        body.includes('"token"') || 
        body.includes('"OK"') || 
        body.includes('"error":false')
      )) {
        loggedIn = true;
        break;
      }
    } catch (e) {
      console.error("[iikoWeb] login attempt error:", e.message);
    }
  }

  if (!loggedIn) {
    throw new Error("iikoWeb auth failed");
  }
  return cookies;
}

/**
 * Create and process an internal transfer via iikoWeb
 * @param {string} storeFrom — UUID склада-источника
 * @param {string} storeTo   — UUID склада-назначения
 * @param {Array}  items     — [{product_id, quantity, ...}]
 * @param {string} comment
 * @returns {Promise<{success: boolean, documentNumber?: string, error?: string}>}
 */
export async function createTransfer(storeFrom, storeTo, items, comment = "") {
  // We need cookie-based session, so we'll use a cookie jar approach
  const now = new Date();
  const tz = "+05:00"; // Asia/Tashkent
  const dateIncoming = formatDate(now) + "T" + formatTime(now) + tz;
  const dateIncomingMs = formatDate(now) + "T" + formatTime(now) + ".000" + tz;

  let cookies = "";
  try {
    cookies = await loginToIikoWeb();
  } catch (e) {
    return { success: false, error: e.message };
  }

  const headers = {
    "Content-Type": "application/json",
    Cookie: cookies,
  };

  try {
    const createBody = {
      type: "INTERNAL_TRANSFER",
      documentNumber: "",
      status: "DRAFT",
      comment,
      conception: CONCEPTION_ID,
      dateIncoming,
      storageFrom: storeFrom,
      storageTo: storeTo,
      store: STORE_NUM,
      editable: true,
      isAutomatic: false,
    };

    const createRes = await http1Fetch(`${IIKO_WEB_URL}/api/documents/create`, {
      method: "POST",
      headers,
      body: JSON.stringify(createBody),
    });
    const createData = await createRes.json();

    if (createRes.status !== 200 || createData.error) {
      return { success: false, error: createData.error || "Create failed" };
    }

    const docId = createData.data.id;
    const docNumber = createData.data.documentNumber;

    await http1Fetch(`${IIKO_WEB_URL}/api/documents/get/${docId}?type=INTERNAL_TRANSFER`, { headers });

    const saveItems = items.map((it) => ({
      product: it.product_id || "",
      amount: it.quantity || 0,
      count: it.quantity || 0,
      containerId: CONTAINER_ID,
      unitName: CONTAINER_ID,
      isDeleted: false,
    }));

    const saveBody = {
      type: "INTERNAL_TRANSFER",
      documentNumber: docNumber,
      status: "PROCESSED",
      comment,
      conception: CONCEPTION_ID,
      dateIncoming: dateIncomingMs,
      storageFrom: storeFrom,
      storageTo: storeTo,
      store: STORE_NUM,
      editable: true,
      isAutomatic: false,
      items: saveItems,
      validation: false,
    };

    const saveRes = await http1Fetch(`${IIKO_WEB_URL}/api/documents/save/${docId}`, {
      method: "POST",
      headers,
      body: JSON.stringify(saveBody),
    });
    const saveData = await saveRes.json();

    if (saveRes.status === 200 && !saveData.error) {

      return { success: true, documentNumber: docNumber };
    }

    return { success: false, error: saveData.error || "Save failed" };
  } catch (e) {
    console.error("[iikoWeb] transfer error:", e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Create and process an inventory document via iikoWeb
 * @param {string} storeId — UUID склада инвентаризации
 * @param {Array}  items   — [{product_id, quantity}]
 * @param {string} comment
 * @returns {Promise<{success: boolean, documentNumber?: string, error?: string}>}
 */
export async function createInventory(storeId, items, comment = "") {
  const now = new Date();
  const tz = "+05:00"; // Asia/Tashkent
  const dateIncoming = formatDate(now) + "T" + formatTime(now) + tz;
  const dateIncomingMs = formatDate(now) + "T" + formatTime(now) + ".000" + tz;

  let cookies = "";
  try {
    cookies = await loginToIikoWeb();
  } catch (e) {
    return { success: false, error: e.message };
  }

  const headers = {
    "Content-Type": "application/json",
    Cookie: cookies,
  };

  try {
    const createBody = {
      type: "INVENTORY",
      documentNumber: "",
      status: "DRAFT",
      comment,
      conception: CONCEPTION_ID,
      dateIncoming,
      storage: storeId,
      store: STORE_NUM,
      editable: true,
      isAutomatic: false,
    };

    const createRes = await http1Fetch(`${IIKO_WEB_URL}/api/documents/create`, {
      method: "POST",
      headers,
      body: JSON.stringify(createBody),
    });
    const createData = await createRes.json();

    if (createRes.status !== 200 || createData.error) {
      return { success: false, error: createData.error || "Create failed" };
    }

    const docId = createData.data.id;
    const docNumber = createData.data.documentNumber;

    await http1Fetch(`${IIKO_WEB_URL}/api/documents/get/${docId}?type=INVENTORY`, { headers });

    const saveItems = items.map((it) => ({
      product: it.product_id || it.product || "",
      amount: it.quantity || 0,
      count: it.quantity || 0,
      containerId: CONTAINER_ID,
      unitName: CONTAINER_ID,
      isDeleted: false,
    }));

    const saveBody = {
      type: "INVENTORY",
      documentNumber: docNumber,
      status: "PROCESSED",
      comment,
      conception: CONCEPTION_ID,
      dateIncoming: dateIncomingMs,
      storage: storeId,
      store: STORE_NUM,
      editable: true,
      isAutomatic: false,
      items: saveItems,
      validation: false,
    };

    const saveRes = await http1Fetch(`${IIKO_WEB_URL}/api/documents/save/${docId}`, {
      method: "POST",
      headers,
      body: JSON.stringify(saveBody),
    });
    const saveData = await saveRes.json();

    if (saveRes.status === 200 && !saveData.error) {

      return { success: true, documentNumber: docNumber };
    }

    return { success: false, error: saveData.error || "Save failed" };
  } catch (e) {
    console.error("[iikoWeb] inventory error:", e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Create and process a production document via iikoWeb
 * @param {Array}  items   — [{product_id, quantity, code, ...}]
 * @param {string} comment
 * @returns {Promise<{success: boolean, documentNumber?: string, error?: string}>}
 */
export async function createProduction(items, comment = "") {
  const now = new Date();
  const tz = "+05:00"; // Asia/Tashkent
  const dateIncoming = formatDate(now) + "T" + formatTime(now) + tz;
  const dateIncomingMs = formatDate(now) + "T" + formatTime(now) + ".000" + tz;

  let cookies = "";
  try {
    cookies = await loginToIikoWeb();
  } catch (e) {
    return { success: false, error: e.message };
  }

  const headers = {
    "Content-Type": "application/json",
    Cookie: cookies,
  };

  try {
    const createItems = items.map((it) => ({
      id: null,
      storage: null,
      actualAmount: 0,
      amount: it.quantity || 0,
      code: it.code || "",
      product: it.product_id || "",
    }));

    const createBody = {
      type: "PRODUCTION_DOCUMENT",
      documentNumber: "",
      status: "DRAFT",
      comment,
      conception: CONCEPTION_ID,
      dateIncoming,
      accountFrom: KITCHEN_PREP_STORE,
      accountTo: KITCHEN_PREP_STORE,
      store: STORE_NUM,
      editable: true,
      isAutomatic: false,
      items: createItems,
    };

    const createRes = await http1Fetch(`${IIKO_WEB_URL}/api/documents/create`, {
      method: "POST",
      headers,
      body: JSON.stringify(createBody),
    });
    const createData = await createRes.json();

    if (createRes.status !== 200 || createData.error) {
      return { success: false, error: createData.error || "Create failed" };
    }

    const docId = createData.data.id;
    const docNumber = createData.data.documentNumber;

    await http1Fetch(`${IIKO_WEB_URL}/api/documents/get/${docId}?type=PRODUCTION_DOCUMENT`, { headers });

    const saveItems = items.map((it) => ({
      product: it.product_id || "",
      amount: it.quantity || 0,
      count: it.quantity || 0,
      containerId: CONTAINER_ID,
      unitName: CONTAINER_ID,
      isDeleted: false,
    }));

    const saveBody = {
      type: "PRODUCTION_DOCUMENT",
      documentNumber: docNumber,
      status: "PROCESSED",
      comment,
      conception: CONCEPTION_ID,
      dateIncoming: dateIncomingMs,
      accountFrom: KITCHEN_PREP_STORE,
      accountTo: KITCHEN_PREP_STORE,
      store: STORE_NUM,
      editable: true,
      isAutomatic: false,
      items: saveItems,
      validation: false,
    };

    const saveRes = await http1Fetch(`${IIKO_WEB_URL}/api/documents/save/${docId}`, {
      method: "POST",
      headers,
      body: JSON.stringify(saveBody),
    });
    const saveData = await saveRes.json();

    if (saveRes.status === 200 && !saveData.error) {

      return { success: true, documentNumber: docNumber };
    }

    return { success: false, error: saveData.error || "Save failed" };
  } catch (e) {
    console.error("[iikoWeb] production error:", e.message);
    return { success: false, error: e.message };
  }
}

function formatDate(d) {
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}
function formatTime(d) {
  return pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
}
function pad(n) {
  return String(n).padStart(2, "0");
}

let cachedCookies = "";
let lastLoginTime = 0;
const SESSION_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Convenience helper: logs into iikoWeb, runs callback with session cookies, and returns the result.
 */
export async function withIikoWebSession(fn) {
  const nowTime = Date.now();
  if (cachedCookies && (nowTime - lastLoginTime < SESSION_CACHE_TTL)) {

    try {
      return await fn(cachedCookies);
    } catch (_e) {

      cachedCookies = ""; // Clear cache and fall through to fresh login
    }
  }

  let cookies = "";
  try {
    cookies = await loginToIikoWeb();
  } catch (e) {
    throw e;
  }

  cachedCookies = cookies;
  lastLoginTime = Date.now();

  return await fn(cookies);
}

/**
 * Fetch all store balances from iikoWeb
 * @returns {Promise<any>}
 */
export async function getStoreBalances() {
  return await withIikoWebSession(async (cookies) => {
    const headers = { Cookie: cookies, Accept: "application/json" };
    const res = await http1Fetch(`${IIKO_WEB_URL}/api/lite-stock/store-balance?limit=10000&offset=0`, { headers });
    if (!res.ok) throw new Error(`Stock API failed: ${res.status}`);
    return await res.json();
  });
}
