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

export async function logAction(tgId, userName, actionType, docNumber, details) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return false;
  try {
    const url = `${SUPABASE_URL}/rest/v1/bot_actions`;
    const res = await http1Fetch(url, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        tg_id: tgId,
        user_name: userName,
        action_type: actionType,
        document_number: docNumber,
        details: details,
      }),
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
    // Get last 100 actions, newest first
    const url = `${SUPABASE_URL}/rest/v1/bot_actions?select=*&order=created_at.desc&limit=100`;
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

export async function createCashReport(tgId, userName, reportedCash, iikoCash, difference) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return false;
  try {
    const url = `${SUPABASE_URL}/rest/v1/cash_reports`;
    const res = await http1Fetch(url, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        cashier_tg_id: tgId,
        cashier_name: userName,
        reported_cash: parseFloat(reportedCash) || 0,
        iiko_cash: parseFloat(iikoCash) || 0,
        difference: parseFloat(difference) || 0,
      }),
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
