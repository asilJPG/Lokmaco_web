import { withIikoSession, iikoGetJson, http1Fetch } from "@/lib/iiko";
import { getAssetsList, createAsset, updateAsset, logAction, getLastActionAt } from "@/lib/supabase";
import { baseInvNumber, unitInvNumber } from "@/lib/inv-number";

export const dynamic = "force-dynamic";

const IIKO_SERVER = (process.env.IIKO_SERVER || "").replace(/\/+$/, "");
const AUTO_SYNC_INTERVAL_MS = 30 * 60 * 1000;

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

    // Автозапуск при открытии раздела: полная сверка ходит в iiko за списком
    // накладных на два года, гонять её на каждое открытие страницы незачем.
    const isAuto = new URL(request.url).searchParams.get("auto") === "1";
    if (isAuto) {
      const last = await getLastActionAt("assets_sync_iiko");
      if (last && Date.now() - new Date(last).getTime() < AUTO_SYNC_INTERVAL_MS) {
        return Response.json({ success: true, skipped: true, lastSyncAt: last });
      }
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

      // Карточки, сгруппированные по базовому номеру: у развёрнутой партии
      // самого EQ-0069 в базе нет, есть EQ-0069-01…-20.
      const byBase = new Map();
      existingAssets.forEach(a => {
        if (!a.inv_number) return;
        const base = baseInvNumber(a.inv_number);
        if (!byBase.has(base)) byBase.set(base, []);
        byBase.get(base).push(a);
      });

      let addedCount = 0;
      let updatedCount = 0;
      let unitsCreated = 0;
      let archivedCount = 0;
      let restoredCount = 0;

      // Что реально есть в iiko прямо сейчас — по этому списку в конце
      // архивируем всё, чего там больше нет.
      const seenBases = new Set();

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

        seenBases.add(invNumber);

        const existingRows = byBase.get(invNumber);

        if (existingRows?.length) {
          // Позиция уже есть (одной карточкой или партией экземпляров).
          // Имя тянем из iiko — там источник истины по номенклатуре.
          // Цену и дату не затираем: их правят руками на сайте.
          for (const existing of existingRows) {
            const updates = {};
            if (existing.name !== p.name) updates.name = p.name;
            if ((!existing.initial_cost || existing.initial_cost === 0) && initialCost > 0) {
              updates.initial_cost = initialCost;
            }
            if (!existing.commissioning_date && commissioningDate) {
              updates.commissioning_date = commissioningDate;
            }
            // Вернулась в справочник после архивации
            if (existing.status === "written_off") {
              updates.status = "in_use";
              restoredCount++;
            }

            if (Object.keys(updates).length > 0) {
              const ok = await updateAsset(existing.id, updates);
              if (ok) updatedCount++;
            }
          }
          continue;
        }

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
          let ok = 0;
          for (let i = 0; i < units.length; i++) {
            const unitInv = unitInvNumber(invNumber, i + 1, units.length);
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

      // 5. Чего в iiko больше нет — помечаем списанным, но не удаляем:
      // за карточкой могут стоять напечатанные наклейки и отметки об
      // инвентаризации. Вернут номенклатуру в iiko — карточка оживёт сама.
      const archived = [];
      for (const [base, rows] of byBase) {
        if (!base || seenBases.has(base)) continue;
        for (const row of rows) {
          if (row.status === "written_off") continue;
          const ok = await updateAsset(row.id, { status: "written_off" });
          if (ok) {
            archivedCount++;
            if (archived.length < 50) archived.push(`${row.inv_number} — ${row.name}`);
          }
        }
      }

      return {
        success: true,
        unitsCreated,
        totalFound: equipProducts.length,
        addedCount,
        updatedCount,
        archivedCount,
        restoredCount,
        archived
      };
    });

    if (syncResult.error) {
      return Response.json({ success: false, error: syncResult.error }, { status: 400 });
    }

    await logAction(userTgId, userName, "assets_sync_iiko", "iiko", {
      userId,
      userRole,
      added: syncResult.addedCount,
      updated: syncResult.updatedCount,
      archived: syncResult.archivedCount,
      restored: syncResult.restoredCount
    });

    const parts = [`создано ${syncResult.addedCount}`];
    if (syncResult.unitsCreated && syncResult.unitsCreated !== syncResult.addedCount) {
      parts.push(`карточек с учётом партий ${syncResult.unitsCreated}`);
    }
    parts.push(`обновлено ${syncResult.updatedCount}`);
    if (syncResult.archivedCount) parts.push(`списано ${syncResult.archivedCount}`);
    if (syncResult.restoredCount) parts.push(`возвращено ${syncResult.restoredCount}`);

    return Response.json({
      success: true,
      message: `Синхронизировано из iiko: ${parts.join(", ")}.`,
      data: syncResult
    });
  } catch (e) {
    console.error("[/api/iiko/assets/sync] POST error:", e.message);
    return Response.json({ success: false, error: "Ошибка при синхронизации с iiko" }, { status: 500 });
  }
}
