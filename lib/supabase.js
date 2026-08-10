import { http1Fetch } from "./iiko.js";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_KEY || "";

function getHeaders() {
  return {
    "Content-Type": "application/json",
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
  };
}

export async function getUserByCode(code) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  try {
    const url = `${SUPABASE_URL}/rest/v1/bot_users?select=*&access_code=eq.${encodeURIComponent(code)}`;
    const res = await http1Fetch(url, {
      method: "GET",
      headers: getHeaders(),
    });
    if (res.ok) {
      const users = await res.json();
      return users.length > 0 ? users[0] : null;
    }
  } catch (e) {
    console.error("[supabase] getUserByCode error:", e.message);
  }
  return null;
}

export async function logAction(tgId, userName, actionType, docNumber, details, createdAt = null) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return false;
  try {
    const url = `${SUPABASE_URL}/rest/v1/bot_actions`;
    const body = {
      tg_id: tgId,
      user_name: userName,
      action_type: actionType,
      document_number: docNumber,
      details: details,
    };
    if (createdAt) {
      body.created_at = createdAt;
    }
    const res = await http1Fetch(url, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch (e) {
    console.error("[supabase] logAction error:", e.message);
  }
  return false;
}

// ---------------------------------------------------------------------------
// Места размещения ОС и универсальные QR-наклейки
// ---------------------------------------------------------------------------

export async function getLocations() {
  try {
    const url = `${SUPABASE_URL}/rest/v1/asset_locations?select=*&order=sort_order.asc,name.asc`;
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    console.error("[supabase] getLocations:", e.message);
    return [];
  }
}

export async function createLocation(data) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/asset_locations`, {
      method: "POST",
      headers: { ...getHeaders(), Prefer: "return=representation" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const text = await res.text();
      // 23505 — уникальный индекс по нормализованному названию
      if (res.status === 409 || text.includes("23505")) return { error: "Такое место уже есть" };
      console.error("[supabase] createLocation:", res.status, text);
      return { error: "Не удалось создать место" };
    }
    const rows = await res.json();
    return { row: rows[0] };
  } catch (e) {
    console.error("[supabase] createLocation:", e.message);
    return { error: "Не удалось создать место" };
  }
}

export async function updateLocation(id, updates) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/asset_locations?id=eq.${id}`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    return res.ok;
  } catch (e) {
    console.error("[supabase] updateLocation:", e.message);
    return false;
  }
}

export async function deleteLocation(id) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/asset_locations?id=eq.${id}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    return res.ok;
  } catch (e) {
    console.error("[supabase] deleteLocation:", e.message);
    return false;
  }
}

/** Сколько карточек стоит в каждом месте — чтобы не удалить непустое. */
export async function countAssetsByLocation() {
  try {
    const url = `${SUPABASE_URL}/rest/v1/assets?select=location_id&location_id=not.is.null`;
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) return {};
    const rows = await res.json();
    const counts = {};
    rows.forEach((r) => (counts[r.location_id] = (counts[r.location_id] || 0) + 1));
    return counts;
  } catch (e) {
    console.error("[supabase] countAssetsByLocation:", e.message);
    return {};
  }
}

/** Наклейки вместе с привязанной карточкой и её местом. */
export async function getTags({ batch, onlyFree } = {}) {
  try {
    const params = [
      "select=*,asset:assets(id,inv_number,name,category,initial_cost,location_id,last_inventoried_at)",
      "order=code.asc",
    ];
    if (batch) params.push(`batch=eq.${encodeURIComponent(batch)}`);
    if (onlyFree) params.push("asset_id=is.null");
    const res = await fetch(`${SUPABASE_URL}/rest/v1/asset_tags?${params.join("&")}`, {
      headers: getHeaders(),
    });
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    console.error("[supabase] getTags:", e.message);
    return [];
  }
}

export async function getTagByCode(code) {
  try {
    const url =
      `${SUPABASE_URL}/rest/v1/asset_tags?code=eq.${encodeURIComponent(code)}` +
      `&select=*,asset:assets(*)&limit=1`;
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) return null;
    const rows = await res.json();
    return rows[0] || null;
  } catch (e) {
    console.error("[supabase] getTagByCode:", e.message);
    return null;
  }
}

export async function createTags(rows) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/asset_tags`, {
      method: "POST",
      headers: { ...getHeaders(), Prefer: "return=representation" },
      body: JSON.stringify(rows),
    });
    if (!res.ok) {
      console.error("[supabase] createTags:", res.status, await res.text());
      return { error: "Не удалось создать наклейки" };
    }
    return { rows: await res.json() };
  } catch (e) {
    console.error("[supabase] createTags:", e.message);
    return { error: "Не удалось создать наклейки" };
  }
}

export async function updateTag(code, updates) {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/asset_tags?code=eq.${encodeURIComponent(code)}`,
      { method: "PATCH", headers: getHeaders(), body: JSON.stringify(updates) }
    );
    if (!res.ok) {
      const text = await res.text();
      if (text.includes("asset_tags_asset_uniq")) {
        return { error: "На эту единицу уже наклеен другой QR" };
      }
      console.error("[supabase] updateTag:", res.status, text);
      return { error: "Не удалось сохранить наклейку" };
    }
    return { ok: true };
  } catch (e) {
    console.error("[supabase] updateTag:", e.message);
    return { error: "Не удалось сохранить наклейку" };
  }
}

/** Последний номер в серии — чтобы новая пачка продолжала нумерацию. */
export async function getLastTagCode(prefix) {
  try {
    const url =
      `${SUPABASE_URL}/rest/v1/asset_tags?code=like.${encodeURIComponent(prefix + "%")}` +
      `&select=code&order=code.desc&limit=1`;
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) return null;
    const rows = await res.json();
    return rows[0]?.code || null;
  } catch (e) {
    console.error("[supabase] getLastTagCode:", e.message);
    return null;
  }
}

/** Когда в последний раз выполнялось действие такого типа. null — никогда. */
export async function getLastActionAt(actionType) {
  try {
    const url = `${SUPABASE_URL}/rest/v1/bot_actions?action_type=eq.${encodeURIComponent(
      actionType
    )}&select=created_at&order=created_at.desc&limit=1`;
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) return null;
    const rows = await res.json();
    return rows?.[0]?.created_at || null;
  } catch (e) {
    console.error("[supabase] getLastActionAt:", e.message);
    return null;
  }
}

export async function getActionsList() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return [];
  try {
    const url = `${SUPABASE_URL}/rest/v1/bot_actions?select=*&order=created_at.desc&limit=3000`;
    const res = await http1Fetch(url, {
      method: "GET",
      headers: getHeaders(),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.error("[supabase] getActionsList error:", e.message);
  }
  return [];
}

export async function createCashReport(tgId, userName, reportedCash, iikoCash, difference, createdAt = null) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return false;
  try {
    const url = `${SUPABASE_URL}/rest/v1/cash_reports`;
    const body = {
      cashier_tg_id: tgId,
      cashier_name: userName,
      reported_cash: parseFloat(reportedCash) || 0,
      iiko_cash: parseFloat(iikoCash) || 0,
      difference: parseFloat(difference) || 0,
    };
    if (createdAt) {
      body.created_at = createdAt;
    }
    const res = await http1Fetch(url, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch (e) {
    console.error("[supabase] createCashReport error:", e.message);
  }
  return false;
}

export async function getCashReports() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return [];
  try {
    const url = `${SUPABASE_URL}/rest/v1/cash_reports?select=*&order=created_at.desc&limit=100`;
    const res = await http1Fetch(url, {
      method: "GET",
      headers: getHeaders(),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.error("[supabase] getCashReports error:", e.message);
  }
  return [];
}

export async function createPendingTransfer(transferData) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  try {
    const url = `${SUPABASE_URL}/rest/v1/pending_transfers`;
    const res = await http1Fetch(url, {
      method: "POST",
      headers: {
        ...getHeaders(),
        "Prefer": "return=representation"
      },
      body: JSON.stringify(transferData),
    });
    if (res.ok) {
      const data = await res.json();
      return data.length > 0 ? data[0] : null;
    } else {
      console.error("[supabase] createPendingTransfer status:", res.status, await res.text());
    }
  } catch (e) {
    console.error("[supabase] createPendingTransfer error:", e.message);
  }
  return null;
}

export async function getPendingTransfersList() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return [];
  try {
    const url = `${SUPABASE_URL}/rest/v1/pending_transfers?select=*&status=in.(pending_receiver,pending_creator,pending_sender)&order=created_at.desc`;
    const res = await http1Fetch(url, {
      method: "GET",
      headers: getHeaders(),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.error("[supabase] getPendingTransfersList error:", e.message);
  }
  return [];
}

export async function getPendingTransferById(id) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  try {
    const url = `${SUPABASE_URL}/rest/v1/pending_transfers?select=*&id=eq.${id}`;
    const res = await http1Fetch(url, {
      method: "GET",
      headers: getHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      return data.length > 0 ? data[0] : null;
    }
  } catch (e) {
    console.error("[supabase] getPendingTransferById error:", e.message);
  }
  return null;
}

export async function updatePendingTransfer(id, status, updates = {}) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return false;
  try {
    const url = `${SUPABASE_URL}/rest/v1/pending_transfers?id=eq.${id}`;
    const body = {
      status,
      ...updates,
      updated_at: new Date().toISOString()
    };
    const res = await http1Fetch(url, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify(body)
    });
    return res.ok;
  } catch (e) {
    console.error("[supabase] updatePendingTransfer error:", e.message);
  }
  return false;
}

export async function getUserPasskeys(userId) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return [];
  try {
    const url = `${SUPABASE_URL}/rest/v1/user_passkeys?select=*&user_id=eq.${userId}`;
    const res = await http1Fetch(url, {
      method: "GET",
      headers: getHeaders(),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.error("[supabase] getUserPasskeys error:", e.message);
  }
  return [];
}

export async function saveUserPasskey(userId, credentialId, publicKey, counter = 0) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return false;
  try {
    const url = `${SUPABASE_URL}/rest/v1/user_passkeys`;
    const body = {
      user_id: userId,
      credential_id: credentialId,
      public_key: publicKey,
      counter: counter,
    };
    const res = await http1Fetch(url, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch (e) {
    console.error("[supabase] saveUserPasskey error:", e.message);
  }
  return false;
}

export async function getPasskeyById(credentialId) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  try {
    const url = `${SUPABASE_URL}/rest/v1/user_passkeys?select=*&credential_id=eq.${encodeURIComponent(credentialId)}`;
    const res = await http1Fetch(url, {
      method: "GET",
      headers: getHeaders(),
    });
    if (res.ok) {
      const keys = await res.json();
      return keys.length > 0 ? keys[0] : null;
    }
  } catch (e) {
    console.error("[supabase] getPasskeyById error:", e.message);
  }
  return null;
}

export async function updatePasskeyCounter(credentialId, newCounter) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return false;
  try {
    const url = `${SUPABASE_URL}/rest/v1/user_passkeys?credential_id=eq.${encodeURIComponent(credentialId)}`;
    const body = {
      counter: newCounter,
    };
    const res = await http1Fetch(url, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch (e) {
    console.error("[supabase] updatePasskeyCounter error:", e.message);
  }
  return false;
}

export async function getUserById(userId) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  try {
    const url = `${SUPABASE_URL}/rest/v1/bot_users?select=*&id=eq.${userId}`;
    const res = await http1Fetch(url, {
      method: "GET",
      headers: getHeaders(),
    });
    if (res.ok) {
      const users = await res.json();
      return users.length > 0 ? users[0] : null;
    }
  } catch (e) {
    console.error("[supabase] getUserById error:", e.message);
  }
  return null;
}

export async function updateUserLastLogin(userId, method) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return false;
  try {
    const url = `${SUPABASE_URL}/rest/v1/bot_users?id=eq.${userId}`;
    const body = {
      last_login_at: new Date().toISOString(),
      last_login_method: method,
    };
    const res = await http1Fetch(url, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch (e) {
    console.error("[supabase] updateUserLastLogin error:", e.message);
  }
  return false;
}

// ----------------------------------------------------
// ASSET MANAGEMENT (Основные Средства)
// ----------------------------------------------------

export async function getAssetsList() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return [];
  try {
    const url = `${SUPABASE_URL}/rest/v1/assets?select=*&order=created_at.desc`;
    const res = await http1Fetch(url, {
      method: "GET",
      headers: getHeaders(),
    });
    if (res.ok) {
      return await res.json();
    } else {
      console.warn("[supabase] getAssetsList status:", res.status);
    }
  } catch (e) {
    console.error("[supabase] getAssetsList error:", e.message);
  }
  return [];
}

export async function createAsset(assetData) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  try {
    const url = `${SUPABASE_URL}/rest/v1/assets`;
    const res = await http1Fetch(url, {
      method: "POST",
      headers: {
        ...getHeaders(),
        Prefer: "return=representation"
      },
      body: JSON.stringify({
        ...assetData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.length > 0 ? data[0] : null;
    } else {
      console.error("[supabase] createAsset status:", res.status, await res.text());
    }
  } catch (e) {
    console.error("[supabase] createAsset error:", e.message);
  }
  return null;
}

export async function updateAsset(id, updates) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return false;
  try {
    const url = `${SUPABASE_URL}/rest/v1/assets?id=eq.${id}`;
    const body = {
      ...updates,
      updated_at: new Date().toISOString()
    };
    const res = await http1Fetch(url, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify(body)
    });
    return res.ok;
  } catch (e) {
    console.error("[supabase] updateAsset error:", e.message);
  }
  return false;
}

export async function deleteAsset(id) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return false;
  try {
    const url = `${SUPABASE_URL}/rest/v1/assets?id=eq.${id}`;
    const res = await http1Fetch(url, {
      method: "DELETE",
      headers: getHeaders()
    });
    return res.ok;
  } catch (e) {
    console.error("[supabase] deleteAsset error:", e.message);
  }
  return false;
}

export async function auditAsset(id) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return false;
  try {
    const url = `${SUPABASE_URL}/rest/v1/assets?id=eq.${id}`;
    const body = {
      last_inventoried_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const res = await http1Fetch(url, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify(body)
    });
    return res.ok;
  } catch (e) {
    console.error("[supabase] auditAsset error:", e.message);
  }
  return false;
}

/** Кассовые смены за период (по details.selected_date), для админского редактора. */
export async function getCashShifts(dateFrom, dateTo) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return [];
  try {
    const url = `${SUPABASE_URL}/rest/v1/bot_actions?action_type=eq.cash&order=created_at.desc&limit=2000&select=*`;
    const res = await http1Fetch(url, { method: "GET", headers: getHeaders() });
    if (!res.ok) {
      console.warn("[supabase] getCashShifts status:", res.status);
      return [];
    }
    const rows = await res.json();
    return rows.filter((r) => {
      const day = r.details?.selected_date || (r.created_at || "").split("T")[0];
      if (!day) return false;
      if (dateFrom && day < dateFrom) return false;
      if (dateTo && day > dateTo) return false;
      return true;
    });
  } catch (e) {
    console.error("[supabase] getCashShifts error:", e.message);
    return [];
  }
}

export async function getCashShiftById(id) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  try {
    const url = `${SUPABASE_URL}/rest/v1/bot_actions?id=eq.${encodeURIComponent(id)}&action_type=eq.cash&select=*&limit=1`;
    const res = await http1Fetch(url, { method: "GET", headers: getHeaders() });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) && data.length ? data[0] : null;
  } catch (e) {
    console.error("[supabase] getCashShiftById error:", e.message);
    return null;
  }
}

/** Перезаписывает details смены целиком. Вызывающий обязан передать пересчитанный объект. */
export async function updateCashShiftDetails(id, details) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return false;
  try {
    const url = `${SUPABASE_URL}/rest/v1/bot_actions?id=eq.${encodeURIComponent(id)}&action_type=eq.cash`;
    const res = await http1Fetch(url, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify({ details }),
    });
    if (!res.ok) {
      console.error("[supabase] updateCashShiftDetails status:", res.status, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error("[supabase] updateCashShiftDetails error:", e.message);
  }
  return false;
}

export async function getAssetById(id) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  try {
    const url = `${SUPABASE_URL}/rest/v1/assets?id=eq.${encodeURIComponent(id)}&select=*&limit=1`;
    const res = await http1Fetch(url, {
      method: "GET",
      headers: getHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data) && data.length > 0 ? data[0] : null;
    }
    console.warn("[supabase] getAssetById status:", res.status);
  } catch (e) {
    console.error("[supabase] getAssetById error:", e.message);
  }
  return null;
}


