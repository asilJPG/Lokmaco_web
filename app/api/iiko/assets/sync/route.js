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
    if (baseRole !== "admin" && baseRole !== "manager") {
      return Response.json({ error: "Доступ только для администратора и менеджера" }, { status: 403 });
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

      // 4. Get existing DB assets.
      // NOTE: the `assets` table has no `iiko_id`/`code` columns, so we dedupe on the
      // deterministic inventory number and on the serial number (which stores iiko code).
      const existingAssets = await getAssetsList();
      const existingMapByCode = {};
      const existingMapBySerial = {};
      // Позиция могла быть уже развёрнута на экземпляры (EQ-0069-01…-20).
      // Тогда самого EQ-0069 в базе нет, и без этой карты повторный импорт
      // создал бы партию заново поверх существующей.
      const existingBases = new Set();

      existingAssets.forEach(a => {
        if (a.inv_number) {
          existingMapByCode[a.inv_number] = a;
          existingBases.add(String(a.inv_number).replace(/-\d+$/, ""));
        }
        if (a.serial_number) existingMapBySerial[a.serial_number] = a;
      });

      let addedCount = 0;
      let updatedCount = 0;
      let unitsCreated = 0;

      // Больше этого на одну номенклатуру не разворачиваем: расходники вроде
      // салфеток приходят сотнями, и поштучные карточки для них бессмысленны.
      const MAX_UNITS = 50;

      for (const p of equipProducts) {
        const purchases = equipPurchaseMap[p.id] || [];
        purchases.sort((a, b) => new Date(a.date || "1970-01-01") - new Date(b.date || "1970-01-01"));
        const lastPurchase = purchases[purchases.length - 1] || {};

        const invNumber = p.num ? `EQ-${p.num.padStart(4, "0")}` : (p.code ? `EQ-${p.code}` : `EQ-${p.id.slice(0, 6).toUpperCase()}`);
        const initialCost = lastPurchase.price || lastPurchase.sum || p.estimatedPurchasePrice || 0;
        const commissioningDate = lastPurchase.date || new Date().toISOString().split("T")[0];

        const existing =
          existingMapByCode[invNumber] ||
          (p.code ? existingMapBySerial[p.code] : null);

        if (existing) {
          const updates = {};
          if ((!existing.initial_cost || existing.initial_cost === 0) && initialCost > 0) {
            updates.initial_cost = initialCost;
          }
          if (!existing.commissioning_date && commissioningDate) {
            updates.commissioning_date = commissioningDate;
          }

          if (Object.keys(updates).length > 0) {
            const ok = await updateAsset(existing.id, updates);
            if (ok) updatedCount++;
          }
          continue;
        }

        // Уже развёрнута на экземпляры — второй раз не заводим
        if (existingBases.has(invNumber)) continue;

        // Сколько штук реально пришло: суммируем ВСЕ приходы, а не только последний.
        // Каждый экземпляр наследует цену и дату своего прихода.
        const units = [];
        for (const pu of purchases) {
          const amount = Math.round(parseFloat(pu.amount) || 0);
          if (amount <= 0) continue;
          const unitPrice = pu.price || (amount > 0 ? pu.sum / amount : pu.sum) || 0;
          for (let k = 0; k < amount && units.length < MAX_UNITS; k++) {
            units.push({ price: unitPrice, date: pu.date || commissioningDate });
          }
          if (units.length >= MAX_UNITS) break;
        }

        const base = {
          name: p.name,
          category: "Оборудование",
          location: "Кухня / Ресторан",
          responsible_person: "Материально-ответственное лицо",
          status: "in_use",
        };

        if (units.length > 1) {
          // Партия: сразу поштучные карточки со своими QR
          const pad = (i) => String(i).padStart(String(units.length).length < 2 ? 2 : String(units.length).length, "0");
          let ok = 0;
          for (let i = 0; i < units.length; i++) {
            const unitInv = `${invNumber}-${pad(i + 1)}`;
            const row = await createAsset({
              ...base,
              inv_number: unitInv,
              quantity: 1,
              initial_cost: units[i].price,
              commissioning_date: units[i].date,
              serial_number: unitInv,
              notes: `Экземпляр ${i + 1} из ${units.length}. Импортировано из iiko (ID: ${p.id}${p.code ? ", Код: " + p.code : ""})`,
            });
            if (row) ok++;
          }
          if (ok > 0) {
            addedCount++;
            unitsCreated += ok;
          }
        } else {
          const created = await createAsset({
            ...base,
            inv_number: invNumber,
            quantity: 1,
            initial_cost: units[0]?.price ?? initialCost,
            commissioning_date: units[0]?.date ?? commissioningDate,
            serial_number: p.code || "",
            notes: `Импортировано из iiko (ID: ${p.id}${p.code ? ", Код: " + p.code : ""})`,
          });
          if (created) { addedCount++; unitsCreated++; }
        }
      }

      return {
        success: true,
        unitsCreated,
        totalFound: equipProducts.length,
        addedCount,
        updatedCount
      };
    });

    if (syncResult.error) {
      return Response.json({ success: false, error: syncResult.error }, { status: 400 });
    }

    await logAction(userTgId, userName, "assets_sync_iiko", "iiko", {
      userId,
      userRole,
      added: syncResult.addedCount,
      updated: syncResult.updatedCount
    });

    return Response.json({
      success: true,
      message:
        `Синхронизировано из iiko: позиций создано ${syncResult.addedCount}` +
        (syncResult.unitsCreated && syncResult.unitsCreated !== syncResult.addedCount
          ? ` (карточек с учётом партий — ${syncResult.unitsCreated})`
          : "") +
        `, обновлено ${syncResult.updatedCount}.`,
      data: syncResult
    });
  } catch (e) {
    console.error("[/api/iiko/assets/sync] POST error:", e.message);
    return Response.json({ success: false, error: "Ошибка при синхронизации с iiko" }, { status: 500 });
  }
}
