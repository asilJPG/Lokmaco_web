import { withIikoSession, http1Fetch } from "@/lib/iiko";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const requesterRole = request.headers.get("x-user-role") || "";
    const [baseRole] = requesterRole.split(":");
    if (!["admin", "director"].includes(baseRole)) {
      return Response.json({ error: "Доступ запрещен для вашей роли" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get("from");
    const dateTo = searchParams.get("to");

    if (!dateFrom || !dateTo) {
      return Response.json({ error: "Missing from or to date parameters" }, { status: 400 });
    }

    let dateToNext = dateTo;
    let includeHigh = "true";
    try {
      const d = new Date(dateTo);
      d.setDate(d.getDate() + 1);
      dateToNext = d.toISOString().split("T")[0];
      includeHigh = "false";
    } catch (e) {
      console.warn("Failed to parse dateTo, using original:", e);
    }

    const IIKO_SERVER = (process.env.IIKO_SERVER || "").replace(/\/+$/, "");

    const SUPABASE_URL = process.env.SUPABASE_URL || "";
    const SUPABASE_KEY = process.env.SUPABASE_KEY || "";

    const [iikoData, cashierReports] = await Promise.all([
      withIikoSession(async (token) => {
        // 1. Fetch overall summary sales
        const summaryBody = {
          reportType: "SALES",
          buildSummary: "true",
          groupByRowFields: [],
          groupByColFields: [],
          aggregateFields: ["DishDiscountSumInt", "OrderNum", "UniqOrderId.OrdersCount", "GuestNum"],
          filters: {
            "OpenDate.Typed": {
              filterType: "DateRange",
              periodType: "CUSTOM",
              from: dateFrom,
              to: dateToNext,
              includeLow: "true",
              includeHigh: includeHigh,
            },
            DeletedWithWriteoff: {
              filterType: "ExcludeValues",
              values: ["DELETED_WITHOUT_WRITEOFF"],
            },
          },
        };

        const summaryRes = await http1Fetch(`${IIKO_SERVER}/resto/api/v2/reports/olap`, {
          method: "POST",
          headers: {
            Cookie: `key=${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(summaryBody),
        });

        let revenue = 0.0;
        let orderCount = 0;
        let guestCount = 0;

        if (summaryRes.ok) {
          const summaryData = await summaryRes.json();
          if (summaryData && summaryData.data) {
            for (const row of summaryData.data) {
              revenue += parseFloat(row["DishDiscountSumInt"] || 0);
              orderCount += parseInt(row["UniqOrderId.OrdersCount"] || row["OrderNum"] || 0, 10);
              guestCount += parseInt(row["GuestNum"] || 0, 10);
            }
          }
        }

        // 2. Fetch sales by payment type
        const payBody = {
          reportType: "SALES",
          buildSummary: "true",
          groupByRowFields: ["PayTypes"],
          groupByColFields: [],
          aggregateFields: ["DishDiscountSumInt", "OrderNum", "UniqOrderId.OrdersCount"],
          filters: {
            "OpenDate.Typed": {
              filterType: "DateRange",
              periodType: "CUSTOM",
              from: dateFrom,
              to: dateToNext,
              includeLow: "true",
              includeHigh: includeHigh,
            },
            DeletedWithWriteoff: {
              filterType: "ExcludeValues",
              values: ["DELETED_WITHOUT_WRITEOFF"],
            },
          },
        };

        const payRes = await http1Fetch(`${IIKO_SERVER}/resto/api/v2/reports/olap`, {
          method: "POST",
          headers: {
            Cookie: `key=${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payBody),
        });

        const paymentsSplit = [];

        if (payRes.ok) {
          const payData = await payRes.json();
          if (payData && payData.data) {
            for (const row of payData.data) {
              const amount = Math.abs(parseFloat(row["DishDiscountSumInt"] || 0));
              if (amount > 0) {
                const name = row["PayTypes"] || "Неизвестный тип оплаты";
                const percent = revenue > 0 ? (amount / revenue) * 100 : 0;
                paymentsSplit.push({
                  name,
                  amount,
                  percent,
                });
              }
            }
          }
        }

        // Sort payments by amount descending
        paymentsSplit.sort((a, b) => b.amount - a.amount);

        const avgCheck = orderCount > 0 ? revenue / orderCount : 0.0;

        return {
          revenue,
          orderCount,
          guestCount,
          avgCheck,
          paymentsSplit,
        };
      }),
      (async () => {
        if (!SUPABASE_URL || !SUPABASE_KEY) return [];
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
          if (res.ok) {
            const allCash = await res.json();
            return allCash.filter((report) => {
              const reportDate =
                report.details?.selected_date ||
                (report.created_at ? report.created_at.split("T")[0] : "");
              return reportDate >= dateFrom && reportDate <= dateTo;
            });
          }
        } catch (e) {
          console.error("Failed to fetch cashier reports:", e.message);
        }
        return [];
      })(),
    ]);

    const data = {
      ...iikoData,
      cashierReports: cashierReports || [],
    };

    return Response.json({ success: true, data });
  } catch (e) {
    console.error("[/api/iiko/analytics/cash] error:", e.message);
    return Response.json({ success: false, error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

