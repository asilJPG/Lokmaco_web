import { getAssetById, createAsset, updateAsset, logAction } from "@/lib/supabase";
import { baseInvNumber, unitInvNumber } from "@/lib/inv-number";

export const dynamic = "force-dynamic";

/**
 * Разворачивает позицию с quantity > 1 в отдельные карточки — по одной на
 * физический предмет, чтобы каждый получил свой QR и попадал в инвентаризацию
 * поштучно.
 *
 * В iiko при этом ничего не меняется: там остаётся одна номенклатура на N штук,
 * мы читаем её как есть. Разбивка живёт только на сайте.
 */
export async function POST(request) {
  try {
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role") || "";
    const userName = decodeURIComponent(request.headers.get("x-user-name") || "Админ");
    const userTgId = request.headers.get("x-user-tg-id") || "";

    if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const [baseRole] = userRole.split(":");
    if (baseRole !== "admin" && baseRole !== "manager") {
      return Response.json({ error: "Доступ только для администратора и менеджера" }, { status: 403 });
    }

    const { id, count } = await request.json();
    if (!id) return Response.json({ error: "Не указан id позиции" }, { status: 400 });

    const asset = await getAssetById(id);
    if (!asset) return Response.json({ error: "Позиция не найдена" }, { status: 404 });

    const n = parseInt(count ?? asset.quantity, 10);
    if (!Number.isFinite(n) || n < 2) {
      return Response.json({ error: "Количество должно быть 2 или больше" }, { status: 400 });
    }
    if (n > 200) {
      return Response.json({ error: "За раз можно разбить максимум на 200 штук" }, { status: 400 });
    }

    // Стоимость делим поровну; остаток от округления отдаём последнему экземпляру,
    // чтобы сумма по карточкам совпала с исходной до копейки.
    const totalCost = parseFloat(asset.initial_cost) || 0;
    const per = Math.floor((totalCost / n) * 100) / 100;
    const lastCost = Math.round((totalCost - per * (n - 1)) * 100) / 100;

    const baseInv = baseInvNumber(asset.inv_number || `EQ-${String(asset.id).slice(0, 6)}`);

    // Первым экземпляром делаем саму исходную карточку, а не создаём её
    // заново: на ней могут висеть наклейка и отметки инвентаризации, а
    // удаление источника всё это обнулило бы.
    const firstInv = unitInvNumber(baseInv, 1, n);
    const firstOk = await updateAsset(id, {
      inv_number: firstInv,
      quantity: 1,
      initial_cost: n === 1 ? lastCost : per,
      serial_number: firstInv,
      notes: `Экземпляр 1 из ${n}. Разбито из позиции ${asset.inv_number || id}.${
        asset.notes ? " " + asset.notes : ""
      }`,
    });
    if (!firstOk) {
      return Response.json(
        { success: false, error: "Не удалось преобразовать исходную позицию" },
        { status: 500 }
      );
    }

    const created = [{ id, inv_number: firstInv }];
    for (let i = 2; i <= n; i++) {
      const unitInv = unitInvNumber(baseInv, i, n);
      const row = await createAsset({
        inv_number: unitInv,
        name: asset.name,
        category: asset.category || "Оборудование",
        location: asset.location || "",
        responsible_person: asset.responsible_person || "",
        quantity: 1,
        initial_cost: i === n ? lastCost : per,
        commissioning_date: asset.commissioning_date || new Date().toISOString().split("T")[0],
        status: asset.status || "in_use",
        serial_number: unitInv,
        notes: `Экземпляр ${i} из ${n}. Разбито из позиции ${asset.inv_number || asset.id}.${
          asset.notes ? " " + asset.notes : ""
        }`,
        photo_url: asset.photo_url || "",
      });
      if (row) created.push({ id: row.id, inv_number: row.inv_number });
    }

    await logAction(userTgId, userName, "asset_split", String(asset.inv_number || id), {
      source_id: id,
      source_inv: asset.inv_number,
      name: asset.name,
      count: n,
      created: created.length,
      total_cost: totalCost,
    });

    return Response.json({
      success: true,
      count: created.length,
      created,
      message:
        created.length === n
          ? `Позиция разбита на ${n} экземпляров`
          : `Создано ${created.length} из ${n} — остальные не сохранились, проверьте список`,
    });
  } catch (e) {
    console.error("[/api/iiko/assets/split]", e.message);
    return Response.json({ success: false, error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
