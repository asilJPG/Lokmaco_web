import { withIikoSession, http1Fetch } from "@/lib/iiko.js";

export const dynamic = "force-dynamic";

const UNIT_MAP = {
  "7ba81c3a-8de5-8f9d-fb9f-e39efcbc57cc": "кг",
  "69859c74-db72-b006-cba5-326cf6f4fc6e": "л",
  "cd19b5ea-1b32-a6e5-1df7-5d2784a0549a": "шт",
  "6040d92d-e286-f4f9-a613-ed0e6fd241e1": "порц",
  "effa6e01-7c7c-4195-8ba7-8a0158b636a0": "м",
  "109fb602-70ad-473d-ba1f-f037b6e72887": "пачка"
};

function tag(xml, name) {
  const m = xml.match(new RegExp(`<${name}>([^<]*)</${name}>`));
  return m ? m[1].trim() : "";
}

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

    const IIKO_SERVER = (process.env.IIKO_SERVER || "").replace(/\/+$/, "");

    const reportData = await withIikoSession(async (token) => {
      // 1. Fetch products catalogue
      const productsRes = await http1Fetch(`${IIKO_SERVER}/resto/api/v2/entities/products/list`, {
        headers: { Cookie: `key=${token}`, Accept: "application/json" }
      });
      const rawProducts = productsRes.ok ? await productsRes.json() : [];
      const productsMap = new Map();
      rawProducts.forEach(p => {
        productsMap.set(p.id, {
          id: p.id,
          name: p.name,
          type: p.type,
          code: p.code || "",
          unit: p.mainUnit ? (UNIT_MAP[p.mainUnit] || "шт") : "шт"
        });
      });

      // 2. Fetch assembly charts
      const chartsRes = await http1Fetch(`${IIKO_SERVER}/resto/api/v2/assemblyCharts/getAll?dateFrom=${dateFrom}&dateTo=${dateTo}&includeDeletedProducts=true&includePreparedCharts=true`, {
        headers: { Cookie: `key=${token}`, Accept: "application/json" }
      });
      const chartsData = chartsRes.ok ? await chartsRes.json() : {};
      const chartsList = chartsData.assemblyCharts || [];
      
      const chartsMap = new Map();
      chartsList.forEach(chart => {
        const pId = chart.assembledProductId;
        if (!chartsMap.has(pId)) {
          chartsMap.set(pId, []);
        }
        chartsMap.get(pId).push(chart);
      });

      for (const [pId, list] of chartsMap.entries()) {
        list.sort((a, b) => {
          const fromA = a.dateFrom || "";
          const fromB = b.dateFrom || "";
          return fromB.localeCompare(fromA);
        });
      }

      // 3. Fetch sales OLAP
      const olapBody = {
        reportType: "SALES",
        buildSummary: "true",
        groupByRowFields: ["OpenDate.Typed", "DishId", "DishName", "DishCode"],
        groupByColFields: [],
        aggregateFields: ["DishAmountInt"],
        filters: {
          "OpenDate.Typed": {
            filterType: "DateRange",
            periodType: "CUSTOM",
            from: dateFrom,
            to: dateTo,
            includeLow: "true",
            includeHigh: "true",
          },
          DeletedWithWriteoff: {
            filterType: "ExcludeValues",
            values: ["DELETED_WITHOUT_WRITEOFF"],
          },
        },
      };
      const salesRes = await http1Fetch(`${IIKO_SERVER}/resto/api/v2/reports/olap`, {
        method: "POST",
        headers: { Cookie: `key=${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(olapBody)
      });
      const rawSales = salesRes.ok ? await salesRes.json() : {};
      const salesData = rawSales.data || [];

      // 4. Fetch write-offs
      const writeoffRes = await http1Fetch(`${IIKO_SERVER}/resto/api/v2/documents/writeoff?dateFrom=${dateFrom}&dateTo=${dateTo}`, {
        headers: { Cookie: `key=${token}`, Accept: "application/json" }
      });
      const rawWriteoffs = writeoffRes.ok ? await writeoffRes.json() : {};
      const writeoffsList = rawWriteoffs.response || [];

      // 5. Fetch accounts list
      const accountsRes = await http1Fetch(`${IIKO_SERVER}/resto/api/v2/entities/list?rootType=Account`, {
        headers: { Cookie: `key=${token}`, Accept: "application/json" }
      });
      const rawAccounts = accountsRes.ok ? await accountsRes.json() : [];
      const accountsMap = new Map();
      rawAccounts.forEach(acc => {
        accountsMap.set(acc.id, acc.name);
      });

      // 6. Fetch stores list
      const storesXml = await http1Fetch(`${IIKO_SERVER}/resto/api/corporation/stores`, {
        headers: { Cookie: `key=${token}`, Accept: "application/xml" }
      });
      const xmlText = storesXml.ok ? await storesXml.text() : "";
      const storesMap = new Map();
      const storeRegex = /<corporateItemDto>([\s\S]*?)<\/corporateItemDto>/g;
      let match;
      while ((match = storeRegex.exec(xmlText)) !== null) {
        const block = match[1];
        const id = tag(block, "id");
        const name = tag(block, "name");
        const type = tag(block, "type");
        if (id && name && type === "STORE") {
          storesMap.set(id, name);
        }
      }

      // Recursive ingredient expansion function
      function expandIngredients(productId, quantity, saleDate, accumulatedIngredients, path = new Set()) {
        if (path.has(productId)) return; // prevent loop
        
        const productCharts = chartsMap.get(productId) || [];
        const targetDateStr = saleDate.substring(0, 10);
        
        let activeChart = null;
        for (const chart of productCharts) {
          const from = chart.dateFrom ? chart.dateFrom.substring(0, 10) : "";
          const to = chart.dateTo ? chart.dateTo.substring(0, 10) : "";
          const isValidFrom = !from || from <= targetDateStr;
          const isValidTo = !to || to >= targetDateStr;
          if (isValidFrom && isValidTo) {
            activeChart = chart;
            break;
          }
        }

        if (activeChart && activeChart.items && activeChart.items.length > 0) {
          const yieldAmount = parseFloat(activeChart.assembledAmount) || 1.0;
          activeChart.items.forEach(item => {
            const ingId = item.productId;
            const ingQty = parseFloat(item.amountIn) || 0.0;
            const requiredQty = quantity * (ingQty / yieldAmount);
            expandIngredients(ingId, requiredQty, saleDate, accumulatedIngredients, new Set([...path, productId]));
          });
        } else {
          const existing = accumulatedIngredients.get(productId) || 0.0;
          accumulatedIngredients.set(productId, existing + quantity);
        }
      }

      // Process sold dishes
      const soldDishes = [];
      const accumulatedIngredients = new Map();

      salesData.forEach(row => {
        const dishId = row.DishId;
        const dishName = row.DishName;
        const dishCode = row.DishCode;
        const qty = parseFloat(row.DishAmountInt) || 0.0;
        const saleDate = row["OpenDate.Typed"] || dateFrom;

        if (qty > 0) {
          soldDishes.push({
            id: dishId,
            name: dishName,
            code: dishCode,
            quantity: qty,
            date: saleDate.substring(0, 10)
          });

          // Expand ingredients recursively
          expandIngredients(dishId, qty, saleDate, accumulatedIngredients);
        }
      });

      // Format ingredients output
      const ingredientsList = [];
      for (const [ingId, qty] of accumulatedIngredients.entries()) {
        const p = productsMap.get(ingId) || {
          name: `Неизвестный ингредиент (${ingId.substring(0,8)})`,
          code: "",
          unit: "шт"
        };
        ingredientsList.push({
          id: ingId,
          name: p.name,
          code: p.code,
          quantity: qty,
          unit: p.unit
        });
      }

      // Sort lists alphabetically
      soldDishes.sort((a, b) => a.name.localeCompare(b.name, "ru"));
      ingredientsList.sort((a, b) => a.name.localeCompare(b.name, "ru"));

      // Process write-offs
      const formattedWriteoffs = [];
      writeoffsList.forEach(doc => {
        const date = doc.dateIncoming || "";
        const num = doc.documentNumber || "";
        const storeName = storesMap.get(doc.storeId) || "Неизвестный склад";
        const accountName = accountsMap.get(doc.accountId) || "Неизвестный счет";
        
        if (doc.items) {
          doc.items.forEach(it => {
            const p = productsMap.get(it.productId) || {
              name: `Неизвестный товар (${it.productId.substring(0,8)})`,
              code: ""
            };
            formattedWriteoffs.push({
              date: date.substring(0, 10),
              number: num,
              storeName,
              accountName,
              productName: p.name,
              code: p.code,
              quantity: parseFloat(it.amount) || 0.0,
              cost: parseFloat(it.cost) || 0.0
            });
          });
        }
      });

      formattedWriteoffs.sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return a.number.localeCompare(b.number);
      });

      return {
        sales: soldDishes,
        ingredients: ingredientsList,
        writeoffs: formattedWriteoffs
      };
    });

    return Response.json({ success: true, ...reportData });
  } catch (e) {
    console.error("[/api/iiko/analytics/tax-report] error:", e.message);
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
}
