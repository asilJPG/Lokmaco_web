import { getAssetsList, createAsset, updateAsset, deleteAsset, auditAsset, logAction } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const userId = request.headers.get("x-user-id");
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const location = searchParams.get("location");
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    let assets = await getAssetsList();

    if (location && location !== "all") {
      assets = assets.filter((a) => a.location === location);
    }
    if (status && status !== "all") {
      assets = assets.filter((a) => a.status === status);
    }
    if (search) {
      const q = search.toLowerCase();
      assets = assets.filter(
        (a) =>
          (a.name || "").toLowerCase().includes(q) ||
          (a.inv_number || "").toLowerCase().includes(q) ||
          (a.responsible_person || "").toLowerCase().includes(q) ||
          (a.serial_number || "").toLowerCase().includes(q)
      );
    }

    return Response.json({ success: true, data: assets });
  } catch (e) {
    console.error("[/api/iiko/assets] GET error:", e.message);
    return Response.json({ success: false, error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role") || "";
    const userName = decodeURIComponent(request.headers.get("x-user-name") || "");
    const userTgId = request.headers.get("x-user-tg-id") || "";

    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [baseRole] = userRole.split(":");
    if (!["admin", "director", "manager", "supplier", "kitchen", "prep_chef", "bar", "hall", "cashier"].includes(baseRole)) {
      return Response.json({ error: "Доступ запрещен для вашей роли" }, { status: 403 });
    }

    const body = await request.json();
    let {
      inv_number,
      name,
      category,
      location,
      responsible_person,
      quantity,
      initial_cost,
      commissioning_date,
      status,
      serial_number,
      notes,
      photo_url
    } = body;

    if (!name || !location || !responsible_person) {
      return Response.json({ error: "Укажите наименование, место эксплуатации и МОЛ" }, { status: 400 });
    }

    // Auto-generate inventory number if empty
    if (!inv_number || !inv_number.trim()) {
      const locationPrefix = (location || "GEN")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .substring(0, 4) || "INV";
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      inv_number = `INV-${locationPrefix}-${randomSuffix}`;
    }

    const assetData = {
      inv_number: inv_number.trim(),
      name: name.trim(),
      category: category || "Оборудование",
      location: location.trim(),
      responsible_person: responsible_person.trim(),
      quantity: parseInt(quantity) || 1,
      initial_cost: parseFloat(initial_cost) || 0,
      commissioning_date: commissioning_date || new Date().toISOString().split("T")[0],
      status: status || "in_use",
      serial_number: serial_number ? serial_number.trim() : "",
      notes: notes ? notes.trim() : "",
      photo_url: photo_url || ""
    };

    const newAsset = await createAsset(assetData);
    if (newAsset) {
      await logAction(userTgId, userName, "asset_create", newAsset.inv_number, {
        name: newAsset.name,
        location: newAsset.location,
        responsible_person: newAsset.responsible_person
      });
      return Response.json({ success: true, data: newAsset });
    } else {
      return Response.json({ success: false, error: "Не удалось сохранить основной средство в БД" }, { status: 500 });
    }
  } catch (e) {
    console.error("[/api/iiko/assets] POST error:", e.message);
    return Response.json({ success: false, error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role") || "";
    const userName = decodeURIComponent(request.headers.get("x-user-name") || "");
    const userTgId = request.headers.get("x-user-tg-id") || "";

    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, action, ...updates } = body;

    if (!id) {
      return Response.json({ error: "Missing asset id" }, { status: 400 });
    }

    if (action === "audit") {
      const ok = await auditAsset(id);
      if (ok) {
        await logAction(userTgId, userName, "asset_audit", id, { action: "inventory_audit" });
        return Response.json({ success: true });
      }
      return Response.json({ success: false, error: "Ошибка проведения инвентаризации" }, { status: 500 });
    }

    const [baseRole] = userRole.split(":");
    if (!["admin", "director", "manager", "supplier", "kitchen", "prep_chef", "bar", "hall", "cashier"].includes(baseRole)) {
      return Response.json({ error: "Доступ запрещен для вашей роли" }, { status: 403 });
    }

    const ok = await updateAsset(id, updates);
    if (ok) {
      await logAction(userTgId, userName, "asset_update", id, updates);
      return Response.json({ success: true });
    }
    return Response.json({ success: false, error: "Не удалось обновить запись" }, { status: 500 });
  } catch (e) {
    console.error("[/api/iiko/assets] PUT error:", e.message);
    return Response.json({ success: false, error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role") || "";
    const userName = decodeURIComponent(request.headers.get("x-user-name") || "");
    const userTgId = request.headers.get("x-user-tg-id") || "";

    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [baseRole] = userRole.split(":");
    if (!["admin", "director"].includes(baseRole)) {
      return Response.json({ error: "Доступ запрещен для вашей роли" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return Response.json({ error: "Missing asset id" }, { status: 400 });
    }

    const ok = await deleteAsset(id);
    if (ok) {
      await logAction(userTgId, userName, "asset_delete", id, { status: "deleted" });
      return Response.json({ success: true });
    }
    return Response.json({ success: false, error: "Не удалось удалить объект" }, { status: 500 });
  } catch (e) {
    console.error("[/api/iiko/assets] DELETE error:", e.message);
    return Response.json({ success: false, error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
