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
 * Какие места приготовления кормит каждый склад — база для процента.
 * Склады, которых здесь нет (Основной склад, Заготовочный цех, Посуда, Зал,
 * Хоз товары), обслуживают заведение целиком, поэтому считаются от всей выручки.
 */
const STORE_TO_PLACES = {
  "Кухня главная": ["1.1 Кухня", "1.3 Мороженое", "1.4 Фрук", "1.6 Кухня + Фрукты"],
  "Кухня подвал": ["1.7 Горячий цех", "1.8 Холодный цех", "1.9 Пицца"],
  Бар: ["1.2 Бар"],
};

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
      const [invRows, salesRows] = await Promise.all([
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
        // выручка по местам приготовления — база для процента
        olap(token, {
          reportType: "SALES",
          buildSummary: "false",
          groupByRowFields: ["CookingPlace", "OpenDate.Typed"],
          aggregateFields: ["DishDiscountSumInt"],
          filters: {
            "OpenDate.Typed": dateFilter(from, to),
            DeletedWithWriteoff: {
              filterType: "ExcludeValues",
              values: ["DELETED_WITHOUT_WRITEOFF"],
            },
          },
        }),
      ]);

      // выручка: месяц -> место приготовления -> сумма, плюс общий итог месяца
      const revByMonthPlace = {};
      const revByMonthTotal = {};
      for (const r of salesRows) {
        const m = String(r["OpenDate.Typed"] || "").slice(0, 7);
        if (!m) continue;
        const place = r.CookingPlace || "(не указано)";
        const v = Math.abs(parseFloat(r["DishDiscountSumInt"]) || 0);
        revByMonthPlace[m] = revByMonthPlace[m] || {};
        revByMonthPlace[m][place] = (revByMonthPlace[m][place] || 0) + v;
        revByMonthTotal[m] = (revByMonthTotal[m] || 0) + v;
      }

      /** База процента для склада за месяц: выручка его направления, иначе — вся. */
      const baseFor = (store, month) => {
        const places = STORE_TO_PLACES[store];
        if (!places) {
          return { revenue: revByMonthTotal[month] || 0, scope: "вся выручка" };
        }
        const byPlace = revByMonthPlace[month] || {};
        const revenue = places.reduce((s, p) => s + (byPlace[p] || 0), 0);
        return { revenue, scope: places.join(" + ") };
      };

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
          const month = d.date.slice(0, 7);
          const { revenue, scope } = baseFor(d.store, month);
          const spread = d.surplus + d.shortage;
          return {
            ...d,
            net, // >0 — недостача, <0 — излишек
            base_revenue: revenue,
            base_scope: scope,
            net_pct: revenue ? (net / revenue) * 100 : null,
            shortage_pct: revenue ? (d.shortage / revenue) * 100 : null,
            // доля недостачи среди всех расхождений — насколько «однобокий» пересчёт
            shortage_share_pct: spread ? (d.shortage / spread) * 100 : null,
          };
        })
        .sort((a, b) => b.date.localeCompare(a.date) || a.store.localeCompare(b.store));

      const totalSurplus = items.reduce((s, i) => s + i.surplus, 0);
      const totalShortage = items.reduce((s, i) => s + i.shortage, 0);
      const net = totalShortage - totalSurplus;
      // Итоговый процент — против суммы баз, а не против общей выручки:
      // склады пересчитываются в разные месяцы и разного объёма.
      const totalBase = items.reduce((s, i) => s + i.base_revenue, 0);

      return {
        period: { from, to },
        items,
        totals: {
          count: items.length,
          surplus: totalSurplus,
          shortage: totalShortage,
          net,
          base_revenue: totalBase,
          net_pct: totalBase ? (net / totalBase) * 100 : null,
        },
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
