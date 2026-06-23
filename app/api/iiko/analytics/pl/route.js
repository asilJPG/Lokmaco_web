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

    const data = await withIikoSession(async (token) => {
      // 1. Fetch SALES OLAP report (Revenue)
      const salesBody = {
        reportType: "SALES",
        buildSummary: "true",
        groupByRowFields: [],
        groupByColFields: [],
        aggregateFields: ["DishDiscountSumInt"],
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

      const salesRes = await http1Fetch(`${IIKO_SERVER}/resto/api/v2/reports/olap`, {
        method: "POST",
        headers: {
          Cookie: `key=${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(salesBody),
      });

      let revenue = 0.0;
      let cogs = 0.0;

      if (salesRes.ok) {
        const salesData = await salesRes.json();
        if (salesData && salesData.data) {
          for (const row of salesData.data) {
            revenue += parseFloat(row["DishDiscountSumInt"] || 0);
          }
        }
      }

      // 2. Fetch TRANSACTIONS OLAP report (Operating Expenses)
      const transBody = {
        reportType: "TRANSACTIONS",
        buildSummary: "true",
        groupByRowFields: ["Account.Name", "Account.Type", "Document"],
        groupByColFields: [],
        aggregateFields: ["Sum.ResignedSum"],
        filters: {
          "DateTime.DateTyped": {
            filterType: "DateRange",
            periodType: "CUSTOM",
            from: dateFrom,
            to: dateToNext,
            includeLow: "true",
            includeHigh: includeHigh,
          },
        },
      };

      const transRes = await http1Fetch(`${IIKO_SERVER}/resto/api/v2/reports/olap`, {
        method: "POST",
        headers: {
          Cookie: `key=${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(transBody),
      });

      let expensesSum = 0.0;
      const expensesMap = {};

      if (transRes.ok) {
        const transData = await transRes.json();
        if (transData && transData.data) {
          for (const row of transData.data) {
            const actType = row["Account.Type"] || "";
            const val = parseFloat(row["Sum.ResignedSum"] || 0);
            if (actType === "COST_OF_GOODS_SOLD") {
              cogs += val;
            } else if (actType === "EXPENSES" || actType === "OTHER_EXPENSES") {
              if (val > 0) {
                const name = row["Account.Name"] || "Прочие расходы";
                const doc = row["Document"] || "";

                // Exclude salary transactions that do not have a document number (clock-in hourly entries)
                if (name === "Зарплата" && !doc) {
                  continue;
                }

                expensesSum += val;
                if (!expensesMap[name]) {
                  expensesMap[name] = 0.0;
                }
                expensesMap[name] += val;
              }
            }
          }
        }
      }

      const expensesDetail = Object.entries(expensesMap).map(([name, amount]) => ({
        name,
        amount,
      }));

      // Sort expenses by amount descending
      expensesDetail.sort((a, b) => b.amount - a.amount);

      const netProfit = revenue - cogs - expensesSum;
      const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0.0;

      return {
        revenue,
        cogs,
        expensesSum,
        netProfit,
        margin,
        expensesDetail,
      };
    });

    return Response.json(
      { success: true, data },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
        },
      }
    );
  } catch (e) {
    console.error("[/api/iiko/analytics/pl] error:", e.message);
    return Response.json({ success: false, error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
