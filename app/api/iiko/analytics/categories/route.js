import { withIikoSession, http1Fetch } from "@/lib/iiko.js";

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

    const categoriesData = await withIikoSession(async (token) => {
      const olapBody = {
        reportType: "SALES",
        buildSummary: "true",
        groupByRowFields: ["DishGroup.TopParent", "DishGroup"],
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

      const res = await http1Fetch(`${IIKO_SERVER}/resto/api/v2/reports/olap`, {
        method: "POST",
        headers: {
          Cookie: `key=${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(olapBody),
      });

      if (!res.ok) {
        throw new Error(`OLAP query failed: ${await res.text()}`);
      }

      const raw = await res.json();
      return raw.data || [];
    });

    return Response.json({ success: true, categories: categoriesData });
  } catch (e) {
    console.error("[/api/iiko/analytics/categories] error:", e.message);
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
}
