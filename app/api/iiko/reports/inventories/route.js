import { withIikoSession, http1Fetch } from "@/lib/iiko";

export const dynamic = "force-dynamic";

const IIKO_SERVER = (process.env.IIKO_SERVER || "").replace(/\/+$/, "");

async function olap(token, body) {
  const res = await http1Fetch(`${IIKO_SERVER}/resto/api/v2/reports/olap`, {
    method: "POST",
    headers: { Cookie: `key=${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`OLAP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json())?.data || [];
}

const dateFilter = (from, to) => ({
  filterType: "DateRange",
  periodType: "CUSTOM",
  from,
  to,
  includeLow: "true",
  includeHigh: "false",
});

/**
 * История инвентаризаций с расхождениями.
 *
 * Проводки инвентаризации идут двойной записью, поэтому суммировать документ
 * целиком бессмысленно — дебет гасит кредит и выходит ноль. Реальные величины
 * лежат на счетах «Излишки инвентаризации» и «Недостача инвентаризации».
 */
export async function GET(request) {
  try {
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role") || "";
    if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const [baseRole] = userRole.split(":");
    if (baseRole !== "admin") {
      return Response.json({ error: "Доступ только для администратора" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from") || "2026-01-01";
    const to = searchParams.get("to") || new Date(Date.now() + 5 * 3600 * 1000).toISOString().split("T")[0];

    const data = await withIikoSession(async (token) => {
      const [invRows, cogsRows] = await Promise.all([
        olap(token, {
          reportType: "TRANSACTIONS",
          buildSummary: "false",
          groupByRowFields: ["DateTime.Typed", "Document", "Store", "Account.Name"],
          aggregateFields: ["Sum.ResignedSum"],
          filters: {
            "DateTime.Typed": dateFilter(from, to),
            TransactionType: { filterType: "IncludeValues", values: ["INVENTORY_CORRECTION"] },
            "Account.Name": {
              filterType: "IncludeValues",
              values: ["Излишки инвентаризации", "Недостача инвентаризации"],
            },
          },
        }),
        olap(token, {
          reportType: "TRANSACTIONS",
          buildSummary: "false",
          groupByRowFields: ["DateTime.Typed", "Account.Type"],
          aggregateFields: ["Sum.ResignedSum"],
          filters: {
            "DateTime.Typed": dateFilter(from, to),
            "Account.Type": { filterType: "IncludeValues", values: ["COST_OF_GOODS_SOLD"] },
          },
        }),
      ]);

      const cogsByMonth = {};
      for (const r of cogsRows) {
        const m = String(r["DateTime.Typed"] || "").slice(0, 7);
        if (m) cogsByMonth[m] = (cogsByMonth[m] || 0) + (parseFloat(r["Sum.ResignedSum"]) || 0);
      }

      const docs = {};
      for (const r of invRows) {
        const date = String(r["DateTime.Typed"] || "").slice(0, 10);
        const doc = r.Document || "—";
        const store = r.Store || "—";
        const key = `${date}|${doc}|${store}`;
        if (!docs[key]) docs[key] = { date, document: doc, store, surplus: 0, shortage: 0 };
        const v = Math.abs(parseFloat(r["Sum.ResignedSum"]) || 0);
        if (r["Account.Name"] === "Излишки инвентаризации") docs[key].surplus += v;
        else docs[key].shortage += v;
      }

      const items = Object.values(docs)
        .map((d) => {
          const net = d.shortage - d.surplus;
          const cogs = cogsByMonth[d.date.slice(0, 7)] || 0;
          const turnover = d.surplus + d.shortage;
          return {
            ...d,
            net, // >0 — недостача, <0 — излишек
            net_pct_of_cogs: cogs ? (net / cogs) * 100 : null,
            shortage_pct_of_cogs: cogs ? (d.shortage / cogs) * 100 : null,
            // доля недостачи среди всех расхождений — насколько «однобокий» пересчёт
            shortage_share_pct: turnover ? (d.shortage / turnover) * 100 : null,
            month_cogs: cogs,
          };
        })
        .sort((a, b) => b.date.localeCompare(a.date) || a.store.localeCompare(b.store));

      const totalSurplus = items.reduce((s, i) => s + i.surplus, 0);
      const totalShortage = items.reduce((s, i) => s + i.shortage, 0);
      const totalCogs = Object.values(cogsByMonth).reduce((s, v) => s + v, 0);
      const net = totalShortage - totalSurplus;

      return {
        period: { from, to },
        items,
        totals: {
          count: items.length,
          surplus: totalSurplus,
          shortage: totalShortage,
          net,
          cogs: totalCogs,
          net_pct_of_cogs: totalCogs ? (net / totalCogs) * 100 : null,
        },
        cogs_by_month: cogsByMonth,
      };
    });

    return Response.json(
      { success: true, ...data },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    console.error("[/api/iiko/reports/inventories]", e.message);
    return Response.json({ success: false, error: String(e.message || e) }, { status: 500 });
  }
}
