import { withIikoSession, iikoGetRaw, iikoGetJson } from "@/lib/iiko";

export const dynamic = "force-dynamic";

const FALLBACK_STORES = [
  { id: "1239d270-1bbe-f64f-b7ea-5f00518ef508", name: "Основной склад" },
  { id: "6be6e519-c4d8-4461-9333-7810062486ed", name: "Кухня главная" },
  { id: "c1a132f0-5a33-4f0b-a47b-5b6d8f381c9f", name: "Бар" },
  { id: "0cf0f2c5-891c-412c-8ab7-7b2bacdd2b01", name: "Посуда" },
  { id: "9101f69e-ab51-44b6-8c1a-f80e84d8eec3", name: "Хоз товары" },
  { id: "2e9688bb-5130-4188-94a5-7a850e1d9f55", name: "Заготовочный цех" },
  { id: "41fc6872-f84c-4fbd-ab67-a25eb9f8d353", name: "Зал" },
  { id: "0e7c3f59-e55d-427f-895f-f24e2f106fbc", name: "Кухня подвал" }
];

const UNIT_MAP = {
  "7ba81c3a-8de5-8f9d-fb9f-e39efcbc57cc": "кг",
  "cd19b5ea-1b32-a6e5-1df7-5d2784a0549a": "шт",
  "69859c74-db72-b006-cba5-326cf6f4fc6e": "л",
  "6040d92d-e286-f4f9-a613-ed0e6fd241e1": "порц",
  "effa6e01-7c7c-4195-8ba7-8a0158b636a0": "м",
  "109fb602-70ad-473d-ba1f-f037b6e72887": "пачка"
};

function tag(xml, name) {
  const m = xml.match(new RegExp(`<${name}>([^<]*)</${name}>`));
  return m ? m[1].trim() : "";
}

export async function GET(_request) {
  try {
    const data = await withIikoSession(async (token) => {
      const timestamp = new Date().toISOString().split('.')[0];

      // Fetch stores, products, and balances in parallel for maximum speed
      const [storesXml, rawProducts, balancesData] = await Promise.all([
        iikoGetRaw("corporation/stores", token).catch(() => null),
        iikoGetJson("v2/entities/products/list", token).catch(() => null),
        iikoGetJson(`v2/reports/balance/stores?timestamp=${timestamp}`, token).catch(() => null),
      ]);

      // 1. Process stores
      let storesList = [];
      if (storesXml) {
        const regex = /<corporateItemDto>([\s\S]*?)<\/corporateItemDto>/g;
        let match;
        while ((match = regex.exec(storesXml)) !== null) {
          const block = match[1];
          const id = tag(block, "id");
          const name = tag(block, "name");
          const type = tag(block, "type");
          if (id && name && type === "STORE") {
            storesList.push({ id, name });
          }
        }
      }
      if (storesList.length === 0) {
        storesList = FALLBACK_STORES;
      }
      const storesMap = new Map(storesList.map(s => [s.id, s]));

      // 2. Process products
      let productsList = [];
      if (rawProducts && Array.isArray(rawProducts)) {
        productsList = rawProducts.map(p => ({
          id: p.id,
          name: p.name,
          num: p.num || "",
          mainUnitName: p.mainUnit ? (UNIT_MAP[p.mainUnit] || "шт") : "шт"
        }));
      }
      const productsMap = new Map(productsList.map(p => [p.id, p]));

      // 3. Group by store
      const grouped = {};
      const actualBalances = Array.isArray(balancesData) ? balancesData : [];
      
      for (const item of actualBalances) {
        const storeId = item.store;
        const productId = item.product;
        const amount = parseFloat(item.amount) || 0;
        const sum = parseFloat(item.sum) || 0;

        if (!grouped[storeId]) {
          const storeMeta = storesMap.get(storeId) || { id: storeId, name: `Склад ${storeId.substring(0,8)}` };
          grouped[storeId] = {
            storage: {
              id: storeMeta.id,
              name: storeMeta.name
            },
            balanceItems: []
          };
        }

        const productMeta = productsMap.get(productId) || { id: productId, name: `Товар ${productId.substring(0,8)}`, num: "", mainUnitName: "шт" };
        grouped[storeId].balanceItems.push({
          product: {
            id: productMeta.id,
            name: productMeta.name,
            num: productMeta.num,
            mainUnitName: productMeta.mainUnitName
          },
          amount,
          sum
        });
      }

      return Object.values(grouped);
    });

    return Response.json({ success: true, data });
  } catch (e) {
    console.error("[/api/iiko/balances] GET error:", e.message);
    return Response.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
