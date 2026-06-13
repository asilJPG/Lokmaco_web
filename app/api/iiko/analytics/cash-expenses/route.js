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
    if (baseRole !== "admin") {
      return Response.json({ error: "Доступ разрешен только для администраторов" }, { status: 403 });
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

        const reportExpenses = details.expenses || [];
        const encFromExp = reportExpenses.reduce((sum, item) => {
          const name = (item.name || "").toLowerCase();
          if (name.includes("инкасс")) {
            return sum + (parseFloat(item.amount) || 0);
          }
          return sum;
        }, 0);

        const cashierExpenses = (parseFloat(details.total_expenses) || 0) - encFromExp;
        const netCash = cashVal - cashierExpenses;

        allTimeNetCash += netCash;

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

        allTimeAdminExpenses += amount;

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

    return Response.json({
      success: true,
      data: {
        allTimeBalance,
        periodNetCashTotal,
        periodAdminExpensesTotal,
        cashReports: periodCashReports,
        adminExpenses: periodAdminExpenses,
      },
    });
  } catch (e) {
    console.error("[/api/iiko/analytics/cash-expenses GET]", e.message);
    return Response.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const requesterRole = request.headers.get("x-user-role") || "";
    const requesterName = decodeURIComponent(request.headers.get("x-user-name") || "Администратор");
    const requesterTgId = request.headers.get("x-user-tg-id") || "admin";
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
