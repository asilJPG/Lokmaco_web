import { withIikoSession, http1Fetch } from "@/lib/iiko";

export const dynamic = "force-dynamic";

const IIKO_SERVER = (process.env.IIKO_SERVER || "").replace(/\/+$/, "");
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_KEY || "";

const RU_WEEKDAY = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];

function pad(n) { return String(n).padStart(2, "0"); }
function isoDay(y, m, d) { return `${y}-${pad(m)}-${pad(d)}`; }

function daysInMonth(year, month /* 1-12 */) {
  return new Date(year, month, 0).getDate();
}

export async function GET(request) {
  try {
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role") || "";
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const [baseRole] = userRole.split(":");
    if (baseRole !== "admin") {
      return Response.json({ error: "Доступ только для администратора" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get("month"); // "YYYY-MM"
    if (!monthParam || !/^\d{4}-\d{2}$/.test(monthParam)) {
      return Response.json({ error: "Missing or invalid month parameter (YYYY-MM)" }, { status: 400 });
    }

    const [yStr, mStr] = monthParam.split("-");
    const year = parseInt(yStr, 10);
    const month = parseInt(mStr, 10);
    const lastDay = daysInMonth(year, month);
    const dateFrom = isoDay(year, month, 1);
    const dateTo = isoDay(year, month, lastDay);

    // For OLAP filter: iiko wants includeHigh + exclusive next-day boundary
    const dateToNext = (() => {
      const d = new Date(`${dateTo}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 1);
      return d.toISOString().split("T")[0];
    })();

    const [iikoByDay, cashByDay] = await Promise.all([
      withIikoSession(async (token) => {
        const body = {
          reportType: "SALES",
          buildSummary: "false",
          groupByRowFields: ["OpenDate.Typed"],
          groupByColFields: [],
          aggregateFields: ["DishDiscountSumInt"],
          filters: {
            "OpenDate.Typed": {
              filterType: "DateRange",
              periodType: "CUSTOM",
              from: dateFrom,
              to: dateToNext,
              includeLow: "true",
              includeHigh: "false",
            },
            DeletedWithWriteoff: {
              filterType: "ExcludeValues",
              values: ["DELETED_WITHOUT_WRITEOFF"],
            },
          },
        };

        const res = await http1Fetch(`${IIKO_SERVER}/resto/api/v2/reports/olap`, {
          method: "POST",
          headers: {
            Cookie: `key=${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        const map = {};
        if (res.ok) {
          const json = await res.json();
          const rows = json?.data || [];
          for (const row of rows) {
            const raw = row["OpenDate.Typed"] || "";
            const day = String(raw).slice(0, 10); // "YYYY-MM-DD" or trimmed timestamp
            if (!day) continue;
            const amt = Math.abs(parseFloat(row["DishDiscountSumInt"] || 0));
            map[day] = (map[day] || 0) + amt;
          }
        }
        return map;
      }),
      (async () => {
        const map = {};
        if (!SUPABASE_URL || !SUPABASE_KEY) return map;
        try {
          const url = `${SUPABASE_URL}/rest/v1/bot_actions?action_type=eq.cash&order=created_at.desc&limit=3000`;
          const res = await http1Fetch(url, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
            },
          });
          if (!res.ok) return map;
          const rows = await res.json();
          for (const rec of rows) {
            const details = rec.details || {};
            const dateKey = details.selected_date || (rec.created_at ? rec.created_at.split("T")[0] : "");
            if (!dateKey || dateKey < dateFrom || dateKey > dateTo) continue;
            const p = details.payments || {};
            const cashFiscal = parseFloat(p.cash) || 0;
            const encashment = parseFloat(p.encashment) || 0;
            // «Наличные -» (гросс) = фискал + инкассация. Так у бухгалтера:
            // Наличные- = 13 685 330, Наличные фискал = 9 936 330, разница
            // 3 749 000 = payments.encashment.
            const cashGrossPerReport = cashFiscal + encashment;
            const humo = parseFloat(p.humo) || 0;
            const uzcard = parseFloat(p.uzcard) || 0;
            const rahmat = parseFloat(p.rahmat) || 0;
            const uzum = parseFloat(p.uzum) || 0;
            const yandex = parseFloat(p.yandex) || 0;
            const online = parseFloat(p.online) || 0;

            const entry = map[dateKey] || {
              cashGross: 0,
              cashFiscal: 0,
              humo: 0,
              uzcard: 0,
              rahmat: 0,
              uzum: 0,
              yandex: 0,
              online: 0,
              cashiers: new Set(),
            };
            entry.cashGross += cashGrossPerReport;
            entry.cashFiscal += cashFiscal;
            entry.humo += humo;
            entry.uzcard += uzcard;
            entry.rahmat += rahmat;
            entry.uzum += uzum;
            entry.yandex += yandex;
            entry.online += online;
            const cName = details.cashier_name || rec.user_name || "";
            if (cName) entry.cashiers.add(cName);
            map[dateKey] = entry;
          }
        } catch (e) {
          console.error("[monthly-cash] supabase error:", e.message);
        }
        return map;
      })(),
    ]);

    const days = [];
    for (let d = 1; d <= lastDay; d++) {
      const date = isoDay(year, month, d);
      const weekday = RU_WEEKDAY[new Date(`${date}T00:00:00Z`).getUTCDay()];
      const cash = cashByDay[date];
      const iikoRevenue = iikoByDay[date] || 0;

      const cashFiscal = cash?.cashFiscal || 0;
      const cashGross = cash?.cashGross || 0; // «Наличные -» = payments.encashment
      const humo = cash?.humo || 0;
      const uzcard = cash?.uzcard || 0;
      const rahmat = cash?.rahmat || 0;
      const uzum = cash?.uzum || 0;
      const yandex = cash?.yandex || 0;
      const online = cash?.online || 0;

      const hasCash = !!cash;
      const total = hasCash ? (cashGross + humo + uzcard + rahmat + uzum + yandex + online) : 0;
      const diff = hasCash ? (total - iikoRevenue) : 0;

      days.push({
        date,
        weekday,
        cashGross,
        cashFiscal,
        humo,
        uzcard,
        rahmat,
        uzum,
        yandex,
        total,
        iikoRevenue,
        diff,
        hasCash,
        cashiers: cash ? Array.from(cash.cashiers) : [],
      });
    }

    // Column totals
    const totals = days.reduce((acc, d) => {
      acc.cashGross += d.cashGross;
      acc.cashFiscal += d.cashFiscal;
      acc.humo += d.humo;
      acc.uzcard += d.uzcard;
      acc.rahmat += d.rahmat;
      acc.uzum += d.uzum;
      acc.yandex += d.yandex;
      acc.total += d.total;
      acc.iikoRevenue += d.iikoRevenue;
      acc.diff += d.diff;
      return acc;
    }, { cashGross: 0, cashFiscal: 0, humo: 0, uzcard: 0, rahmat: 0, uzum: 0, yandex: 0, total: 0, iikoRevenue: 0, diff: 0 });

    return Response.json(
      { success: true, month: monthParam, days, totals },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
        },
      }
    );
  } catch (e) {
    console.error("[/api/iiko/reports/monthly-cash] error:", e.message);
    return Response.json({ success: false, error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
