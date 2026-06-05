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

export async function getActionsList() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return [];
  try {
    const url = `${SUPABASE_URL}/rest/v1/bot_actions?select=*&order=created_at.desc&limit=500`;
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


