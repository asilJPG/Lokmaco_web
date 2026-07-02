import { http1Fetch } from "@/lib/iiko.js";

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
      return Response.json({ error: "Доступ запрещен" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get("from");
    const dateTo = searchParams.get("to");

    if (!dateFrom || !dateTo) {
      return Response.json({ error: "Укажите даты from и to" }, { status: 400 });
    }

    // Fetch cash reports from bot_actions
    const url = `${SUPABASE_URL}/rest/v1/bot_actions?action_type=eq.cash&order=created_at.desc&limit=1500`;
    const res = await http1Fetch(url, {
      method: "GET",
      headers: getHeaders(),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Supabase query failed: ${res.status} ${errText}`);
    }

    const records = await res.json();
    const dailyWages = {};

    for (const rec of records) {
      const createdAt = rec.created_at || "";
      const dateKey = rec.details?.selected_date || createdAt.split("T")[0] || "";

      if (dateKey >= dateFrom && dateKey <= dateTo) {
        const wages = rec.details?.employee_wages || [];
        if (wages.length > 0) {
          if (!dailyWages[dateKey]) {
            dailyWages[dateKey] = {
              date: dateKey,
              totalEmployees: 0,
              totalPaid: 0,
              employees: [],
            };
          }
          const day = dailyWages[dateKey];
          for (const w of wages) {
            day.employees.push({
              employeeId: w.employeeId,
              name: w.name || "Сотрудник",
              wage: parseFloat(w.wage) || 0,
            });
            day.totalPaid += parseFloat(w.wage) || 0;
          }
          day.totalEmployees = day.employees.length;
        }
      }
    }

    // Find the latest date overall that has wages recorded
    let latestWageDate = null;
    for (const rec of records) {
      const wages = rec.details?.employee_wages || [];
      if (wages.length > 0) {
        const createdAt = rec.created_at || "";
        const dateKey = rec.details?.selected_date || createdAt.split("T")[0] || "";
        latestWageDate = dateKey;
        break; // Since records are sorted descending by created_at, this is the latest overall
      }
    }

    // Convert to array and sort descending by date
    const resultList = Object.values(dailyWages);
    resultList.sort((a, b) => b.date.localeCompare(a.date));

    // Calculate totals for period
    const periodTotalPaid = resultList.reduce((sum, day) => sum + day.totalPaid, 0);
    const avgDailyPaid = resultList.length > 0 ? Math.round(periodTotalPaid / resultList.length) : 0;

    return Response.json(
      {
        success: true,
        data: {
          periodTotalPaid,
          avgDailyPaid,
          latestWageDate,
          days: resultList,
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
    console.error("[/api/iiko/analytics/wages GET]", e.message);
    return Response.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
