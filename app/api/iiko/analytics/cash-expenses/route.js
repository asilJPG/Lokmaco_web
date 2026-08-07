import { http1Fetch } from "@/lib/iiko";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_KEY || "";

function getHeaders() {
  return {
    "Content-Type": "application/json",
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
  };
}

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const requesterRole = request.headers.get("x-user-role") || "";
    const [baseRole] = requesterRole.split(":");
    if (baseRole !== "admin" && baseRole !== "director") {
      return Response.json({ error: "Доступ разрешен только для администраторов и руководителей" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get("from");
    const dateTo = searchParams.get("to");

    if (!dateFrom || !dateTo) {
      return Response.json({ error: "Missing from or to parameters" }, { status: 400 });
    }

    // Fetch all cash reports and admin expenses to compute the running balance
    // PostgREST: action_type=in.(cash,admin_expense)&order=created_at.desc&limit=2000
    const url = `${SUPABASE_URL}/rest/v1/bot_actions?action_type=in.(cash,admin_expense)&order=created_at.desc&limit=2000`;
    const res = await http1Fetch(url, {
      method: "GET",
      headers: getHeaders(),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Supabase query failed: ${res.status} ${errText}`);
    }

    const records = await res.json();

    let allTimeNetCash = 0;
    let allTimeAdminExpenses = 0;

    const cashReportsMap = {};
    const periodAdminExpenses = [];

    // Parse all records to compute all-time balance and filter for the selected period
    for (const rec of records) {
      const createdAt = rec.created_at || "";
      const dateKey = rec.details?.selected_date || createdAt.split("T")[0] || "";

      if (rec.action_type === "cash") {
        const details = rec.details || {};
        const cashVal = parseFloat(details.payments?.cash) || 0;
        const cashierExpenses = parseFloat(details.total_expenses) || 0;
        const netCash = cashVal;

        if (dateKey <= dateTo) {
          allTimeNetCash += netCash;
        }

        // Check if falls within selected period
        if (dateKey >= dateFrom && dateKey <= dateTo) {
          if (!cashReportsMap[dateKey]) {
            cashReportsMap[dateKey] = {
              id: dateKey,
              date: dateKey,
              cashierName: details.cashier_name || rec.user_name || "Кассир",
              grossCash: 0,
              cashierExpenses: 0,
              netCash: 0,
              comments: [],
            };
          }
          const item = cashReportsMap[dateKey];
          item.grossCash += cashVal;
          item.cashierExpenses += cashierExpenses;
          item.netCash += netCash;
          if (details.comment) {
            item.comments.push(details.comment);
          }
          const cName = details.cashier_name || rec.user_name || "Кассир";
          if (item.cashierName !== cName && !item.cashierName.includes(cName)) {
            item.cashierName = `${item.cashierName}, ${cName}`;
          }
        }
      } else if (rec.action_type === "admin_expense") {
        const details = rec.details || {};
        const amount = parseFloat(details.amount) || 0;

        if (dateKey <= dateTo) {
          allTimeAdminExpenses += amount;
        }

        // Check if falls within selected period
        if (dateKey >= dateFrom && dateKey <= dateTo) {
          periodAdminExpenses.push({
            id: rec.id,
            date: dateKey,
            name: details.name || "Расход",
            amount: amount,
            userName: rec.user_name || "Администратор",
          });
        }
      }
    }

    const periodCashReports = Object.values(cashReportsMap).map(item => ({
      id: item.id,
      date: item.date,
      cashierName: item.cashierName,
      grossCash: item.grossCash,
      cashierExpenses: item.cashierExpenses,
      netCash: item.netCash,
      comment: item.comments.join("; "),
    }));

    const allTimeBalance = allTimeNetCash - allTimeAdminExpenses;
    
    // Sort lists descending by date
    periodCashReports.sort((a, b) => b.date.localeCompare(a.date));
    periodAdminExpenses.sort((a, b) => b.date.localeCompare(a.date));

    // Calculate totals for the selected period
    const periodNetCashTotal = periodCashReports.reduce((sum, r) => sum + r.netCash, 0);
    const periodAdminExpensesTotal = periodAdminExpenses.reduce((sum, e) => sum + e.amount, 0);

    return Response.json(
      {
        success: true,
        data: {
          allTimeBalance,
          periodNetCashTotal,
          periodAdminExpensesTotal,
          cashReports: periodCashReports,
          adminExpenses: periodAdminExpenses,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
        },
      }
    );
  } catch (e) {
    console.error("[/api/iiko/analytics/cash-expenses GET]", e.message);
    return Response.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

/**
 * bot_actions.tg_id — bigint. Заголовок может прийти пустым (middleware пишет
 * String(user.tg_id || ""), а у админа с tg_id = 0 это даёт ""), поэтому строку
 * сюда подставлять нельзя: Postgres ответит 400 22P02.
 */
function parseTgId(raw) {
  const n = Number(raw);
  return raw !== null && raw !== "" && Number.isFinite(n) ? n : 0;
}

export async function POST(request) {
  try {
    const requesterRole = request.headers.get("x-user-role") || "";
    const requesterName = decodeURIComponent(request.headers.get("x-user-name") || "Администратор");
    const requesterTgId = parseTgId(request.headers.get("x-user-tg-id"));
    const [baseRole] = requesterRole.split(":");
    
    if (baseRole !== "admin") {
      return Response.json({ error: "Доступ разрешен только для администраторов" }, { status: 403 });
    }

    const { name, amount, date } = await request.json();

    if (!name || !amount || !date) {
      return Response.json({ error: "Укажите название, сумму и дату" }, { status: 400 });
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return Response.json({ error: "Сумма должна быть числом больше 0" }, { status: 400 });
    }

    const body = {
      tg_id: requesterTgId,
      user_name: requesterName,
      action_type: "admin_expense",
      document_number: "EXPENSE",
      details: {
        name: name.trim(),
        amount: amountNum,
        selected_date: date,
      },
      created_at: `${date}T12:00:00+05:00`,
    };

    const url = `${SUPABASE_URL}/rest/v1/bot_actions`;
    const res = await http1Fetch(url, {
      method: "POST",
      headers: {
        ...getHeaders(),
        Prefer: "return=representation",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to insert admin expense: ${res.status} ${errText}`);
    }

    const data = await res.json();
    return Response.json({ success: true, expense: data[0] });
  } catch (e) {
    console.error("[/api/iiko/analytics/cash-expenses POST]", e.message);
    return Response.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

/** Правка уже внесённого расхода из сейфа. Любой админ, с записью в аудит. */
export async function PATCH(request) {
  try {
    const requesterRole = request.headers.get("x-user-role") || "";
    const requesterName = decodeURIComponent(request.headers.get("x-user-name") || "Администратор");
    const [baseRole] = requesterRole.split(":");

    if (baseRole !== "admin") {
      return Response.json({ error: "Доступ разрешен только для администраторов" }, { status: 403 });
    }

    const { id, name, amount, date } = await request.json();
    if (!id) {
      return Response.json({ error: "Не указан id расхода" }, { status: 400 });
    }

    const findUrl = `${SUPABASE_URL}/rest/v1/bot_actions?id=eq.${id}&action_type=eq.admin_expense&select=*`;
    const findRes = await http1Fetch(findUrl, { method: "GET", headers: getHeaders() });
    if (!findRes.ok) throw new Error(`Lookup failed: ${findRes.status}`);
    const found = await findRes.json();
    if (!Array.isArray(found) || found.length === 0) {
      return Response.json({ error: "Расход не найден" }, { status: 404 });
    }

    const prev = found[0].details || {};
    const nextName = name !== undefined ? String(name).trim() : prev.name;
    const nextDate = date || prev.selected_date;
    let nextAmount = prev.amount;
    if (amount !== undefined) {
      const n = parseFloat(amount);
      if (isNaN(n) || n <= 0) {
        return Response.json({ error: "Сумма должна быть числом больше 0" }, { status: 400 });
      }
      nextAmount = n;
    }
    if (!nextName) {
      return Response.json({ error: "Название не может быть пустым" }, { status: 400 });
    }

    const changes = {};
    if (prev.name !== nextName) changes.name = { from: prev.name, to: nextName };
    if (Number(prev.amount) !== Number(nextAmount)) {
      changes.amount = { from: Number(prev.amount) || 0, to: nextAmount };
    }
    if (prev.selected_date !== nextDate) {
      changes.selected_date = { from: prev.selected_date, to: nextDate };
    }
    if (Object.keys(changes).length === 0) {
      return Response.json({ success: true, unchanged: true, message: "Изменений нет" });
    }

    const details = {
      ...prev,
      name: nextName,
      amount: nextAmount,
      selected_date: nextDate,
      edit_history: [
        ...(Array.isArray(prev.edit_history) ? prev.edit_history : []),
        { edited_at: new Date().toISOString(), edited_by: requesterName, changes },
      ],
    };

    const patchUrl = `${SUPABASE_URL}/rest/v1/bot_actions?id=eq.${id}&action_type=eq.admin_expense`;
    const res = await http1Fetch(patchUrl, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify({ details, created_at: `${nextDate}T12:00:00+05:00` }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to update admin expense: ${res.status} ${errText}`);
    }

    return Response.json({ success: true, details, changed: Object.keys(changes).length });
  } catch (e) {
    console.error("[/api/iiko/analytics/cash-expenses PATCH]", e.message);
    return Response.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const requesterRole = request.headers.get("x-user-role") || "";
    const [baseRole] = requesterRole.split(":");
    
    if (baseRole !== "admin") {
      return Response.json({ error: "Доступ разрешен только для администраторов" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return Response.json({ error: "Missing id parameter" }, { status: 400 });
    }

    const url = `${SUPABASE_URL}/rest/v1/bot_actions?id=eq.${id}&action_type=eq.admin_expense`;
    const res = await http1Fetch(url, {
      method: "DELETE",
      headers: getHeaders(),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to delete admin expense: ${res.status} ${errText}`);
    }

    return Response.json({ success: true });
  } catch (e) {
    console.error("[/api/iiko/analytics/cash-expenses DELETE]", e.message);
    return Response.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
