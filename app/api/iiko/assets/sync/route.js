import { withIikoSession, iikoGetJson, http1Fetch } from "@/lib/iiko";
import { getAssetsList, createAsset, updateAsset, logAction } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const IIKO_SERVER = (process.env.IIKO_SERVER || "").replace(/\/+$/, "");

export async function POST(request) {
  try {
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role") || "";
    const userName = decodeURIComponent(request.headers.get("x-user-name") || "Админ");
    const userTgId = request.headers.get("x-user-tg-id") || "";

    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [baseRole] = userRole.split(":");
    if (!["admin", "director", "accountant", "manager"].includes(baseRole)) {
      return Response.json({ error: "Доступ запрещен" }, { status: 403 });
    }

    const syncResult = await withIikoSession(async (token) => {
      // 1. Fetch groups to get 'Оборудование' ID
      const groups = await iikoGetJson("v2/entities/products/group/list", token);
      const equipGroupIds = new Set();

      if (Array.isArray(groups)) {
        groups.forEach(g => {
          if (
            g.id === "caa82432-fe8b-4eb0-988b-c0bffd04fc6b" ||
            (g.name || "").toLowerCase().includes("оборудование") ||
            (g.name || "").toLowerCase().includes("инвентарь")
          ) {
            equipGroupIds.add(g.id);
          }
        });
      }

      equipGroupIds.add("caa82432-fe8b-4eb0-988b-c0bffd04fc6b");

      // 2. Fetch products
      const products = await iikoGetJson("v2/entities/products/list?includeDeleted=false", token);
      if (!Array.isArray(products)) {
        return { error: "Не удалось получить список товаров из iiko" };
      }

      const equipProducts = products.filter(p => 
        !p.deleted && 
        (equipGroupIds.has(p.parent) || equipGroupIds.has(p.category) || (p.name || "").toLowerCase().includes("оборудовани"))
      );

      // 3. Fetch incoming invoices for prices & dates
      const nowYear = new Date().getFullYear();
      const fromDate = `${nowYear - 2}-01-01`;
      const toDate = `${nowYear}-12-31`;

      const invoicesUrl = `${IIKO_SERVER}/resto/api/documents/export/incomingInvoice?key=${token}&from=${fromDate}&to=${toDate}`;
      const invRes = await http1Fetch(invoicesUrl, {
        headers: { Accept: "application/xml" }
      });
      const xmlText = invRes.ok ? await invRes.text() : "";

      const equipPurchaseMap = {};
      if (xmlText) {
        const docRegex = /<document>([\s\S]*?)<\/document>/g;
        let docMatch;
        while ((docMatch = docRegex.exec(xmlText)) !== null) {
          const docXml = docMatch[1];
          const dateMatch = docXml.match(/<dateIncoming>(.*?)<\/dateIncoming>/) || docXml.match(/<date>(.*?)<\/date>/);
          const dateIncoming = dateMatch ? dateMatch[1].split("T")[0] : null;

          const itemRegex = /<item>([\s\S]*?)<\/item>/g;
          let itemMatch;
          while ((itemMatch = itemRegex.exec(docXml)) !== null) {
            const itemXml = itemMatch[1];
            const prodMatch = itemXml.match(/<product>(.*?)<\/product>/);
            const priceMatch = itemXml.match(/<price>(.*?)<\/price>/) || itemXml.match(/<amount>(.*?)<\/amount>/);
            const sumMatch = itemXml.match(/<sum>(.*?)<\/sum>/);
            const amountMatch = itemXml.match(/<amount>(.*?)<\/amount>/);

            if (prodMatch) {
              const productId = prodMatch[1];
              const price = priceMatch ? parseFloat(priceMatch[1]) : 0;
              const sum = sumMatch ? parseFloat(sumMatch[1]) : 0;
              const amount = amountMatch ? parseFloat(amountMatch[1]) : 1;

              if (!equipPurchaseMap[productId]) equipPurchaseMap[productId] = [];
              equipPurchaseMap[productId].push({
                date: dateIncoming,
                price: price || (amount > 0 ? sum / amount : sum),
                sum: sum,
                amount: amount
              });
            }
          }
        }
      }

      // 4. Get existing DB assets
      const existingAssets = await getAssetsList();
      const existingMapByIikoId = {};
      const existingMapByCode = {};

      existingAssets.forEach(a => {
        if (a.iiko_id) existingMapByIikoId[a.iiko_id] = a;
        if (a.inv_number) existingMapByCode[a.inv_number] = a;
        if (a.code) existingMapByCode[a.code] = a;
      });

      let addedCount = 0;
      let updatedCount = 0;

      for (const p of equipProducts) {
        const purchases = equipPurchaseMap[p.id] || [];
        purchases.sort((a, b) => new Date(b.date || "1970-01-01") - new Date(a.date || "1970-01-01"));
        const lastPurchase = purchases[0] || {};

        const invNumber = p.num ? `EQ-${p.num.padStart(4, "0")}` : (p.code ? `EQ-${p.code}` : `EQ-${p.id.slice(0, 6).toUpperCase()}`);
        const initialCost = lastPurchase.price || lastPurchase.sum || p.estimatedPurchasePrice || 0;
        const commissioningDate = lastPurchase.date || new Date().toISOString().split("T")[0];

        const existing = existingMapByIikoId[p.id] || existingMapByCode[invNumber] || existingMapByCode[p.code];

        if (existing) {
          const updates = {};
          if ((!existing.initial_cost || existing.initial_cost === 0) && initialCost > 0) {
            updates.initial_cost = initialCost;
          }
          if (!existing.commissioning_date && commissioningDate) {
            updates.commissioning_date = commissioningDate;
          }
          if (!existing.iiko_id) {
            updates.iiko_id = p.id;
          }

          if (Object.keys(updates).length > 0) {
            await updateAsset(existing.id, updates);
            updatedCount++;
          }
        } else {
          await createAsset({
            inv_number: invNumber,
            name: p.name,
            category: "Оборудование",
            location: "Кухня / Ресторан",
            responsible_person: "Материально-ответственное лицо",
            quantity: lastPurchase.amount || 1,
            initial_cost: initialCost,
            commissioning_date: commissioningDate,
            status: "in_use",
            serial_number: p.code || "",
            notes: `Импортировано из iiko (Код: ${p.code || p.num || ""})`,
            iiko_id: p.id
          });
          addedCount++;
        }
      }

      return {
        success: true,
        totalFound: equipProducts.length,
        addedCount,
        updatedCount
      };
    });

    if (syncResult.error) {
      return Response.json({ success: false, error: syncResult.error }, { status: 400 });
    }

    await logAction("assets_sync_iiko", {
      userId,
      userName,
      userRole,
      userTgId,
      added: syncResult.addedCount,
      updated: syncResult.updatedCount
    });

    return Response.json({
      success: true,
      message: `Синхронизировано из iiko: создано ${syncResult.addedCount} шт, обновлено ${syncResult.updatedCount} шт.`,
      data: syncResult
    });
  } catch (e) {
    console.error("[/api/iiko/assets/sync] POST error:", e.message);
    return Response.json({ success: false, error: "Ошибка при синхронизации с iiko" }, { status: 500 });
  }
}
