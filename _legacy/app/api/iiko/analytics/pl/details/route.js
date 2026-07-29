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
    const category = searchParams.get("category");
    const dateFrom = searchParams.get("from");
    const dateTo = searchParams.get("to");

    if (!category || !dateFrom || !dateTo) {
      return Response.json({ error: "Missing category, from or to date parameters" }, { status: 400 });
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
      const transBody = {
        reportType: "TRANSACTIONS",
        buildSummary: "true",
        groupByRowFields: ["Account.Name", "Account.Type", "DateTime.Typed", "Document", "Comment", "Counteragent.Name", "Contr-Product.Name"],
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
          "Account.Name": {
            filterType: "IncludeValues",
            values: [category],
          }
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

      if (!transRes.ok) {
        console.error("OLAP details query failed:", transRes.status, await transRes.text());
        return [];
      }

      const resData = await transRes.json();
      const rawRows = resData.data || [];

      const groups = {};
      for (const row of rawRows) {
        const val = parseFloat(row["Sum.ResignedSum"] || 0);
        if (val <= 0) continue;

        const docNum = row["Document"] || "";
        const catName = row["Account.Name"] || "";

        // Exclude salary transactions that do not have a document number (clock-in hourly entries)
        if (catName === "Зарплата" && !docNum) {
          continue;
        }

        const dateRaw = row["DateTime.Typed"] || "";
        const date = dateRaw.split("T")[0] || "";
        const key = docNum ? `${date}_${docNum}` : `${date}_nodoc_${catName}`;

        if (!groups[key]) {
          groups[key] = {
            date,
            document: docNum || "—",
            totalAmount: 0,
            items: new Set(),
          };
        }

        const grp = groups[key];
        grp.totalAmount += val;

        let itemDesc = "";
        if (catName === "Зарплата") {
          if (row["Contr-Product.Name"]) {
            itemDesc = row["Contr-Product.Name"];
            if (row["Counteragent.Name"]) {
              itemDesc += ` (${row["Counteragent.Name"]})`;
            }
          } else {
            itemDesc = row["Counteragent.Name"] || row["Comment"] || "";
          }
        } else {
          itemDesc = row["Contr-Product.Name"] || row["Comment"] || row["Counteragent.Name"] || "";
        }

        if (itemDesc) {
          grp.items.add(itemDesc);
        }
      }

      const resultList = Object.values(groups).map((grp) => {
        const itemsArr = Array.from(grp.items).filter(Boolean);
        let description = "—";
        if (itemsArr.length > 0) {
          const top3 = itemsArr.slice(0, 3);
          description = top3.join(", ");
          if (itemsArr.length > 3) {
            description += ` + еще ${itemsArr.length - 3}`;
          }
        }
        return {
          date: grp.date,
          document: grp.document,
          description,
          amount: grp.totalAmount,
        };
      });

      resultList.sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        return b.amount - a.amount;
      });

      return resultList;
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
    console.error("[/api/iiko/analytics/pl/details] error:", e.message);
    return Response.json({ success: false, error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
