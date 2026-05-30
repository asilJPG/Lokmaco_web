import { withIikoSession, http1Fetch } from "@/lib/iiko";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
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
      const topBody = {
        reportType: "SALES",
        buildSummary: "true",
        groupByRowFields: ["DishCategory", "DishName"],
        groupByColFields: [],
        aggregateFields: ["DishAmountInt", "DishDiscountSumInt"],
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

      const topRes = await http1Fetch(`${IIKO_SERVER}/resto/api/v2/reports/olap`, {
        method: "POST",
        headers: {
          Cookie: `key=${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(topBody),
      });

      const categoriesMap = {};

      if (topRes.ok) {
        const topData = await topRes.json();
        if (topData && topData.data) {
          for (const row of topData.data) {
            const category = row["DishCategory"] || "Без категории";
            const amount = parseFloat(row["DishAmountInt"] || 0);
            const revenue = parseFloat(row["DishDiscountSumInt"] || 0);

            if (amount > 0) {
              if (!categoriesMap[category]) {
                categoriesMap[category] = [];
              }
              categoriesMap[category].push({
                name: row["DishName"] || "—",
                amount,
                revenue,
              });
            }
          }
        }
      }

      // Format and sort categories
      const categoriesList = [];

      for (const [catName, dishes] of Object.entries(categoriesMap)) {
        // Sort dishes by revenue descending
        dishes.sort((a, b) => b.revenue - a.revenue);

        const totalRevenue = dishes.reduce((acc, curr) => acc + curr.revenue, 0);
        const totalAmount = dishes.reduce((acc, curr) => acc + curr.amount, 0);

        categoriesList.push({
          name: catName,
          totalRevenue,
          totalAmount,
          topDishes: dishes.slice(0, 3), // Top 3
        });
      }

      // Sort categories by total revenue descending
      categoriesList.sort((a, b) => b.totalRevenue - a.totalRevenue);

      return categoriesList;
    });

    return Response.json({ success: true, data });
  } catch (e) {
    console.error("[/api/iiko/analytics/top-sales] error:", e.message);
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
}
