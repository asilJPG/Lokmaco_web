import {
  getLocations,
  createLocation,
  updateLocation,
  deleteLocation,
  countAssetsByLocation,
  logAction,
} from "@/lib/supabase";

export const dynamic = "force-dynamic";

const ALLOWED = ["admin", "manager"];

function guard(request) {
  const userId = request.headers.get("x-user-id");
  const [baseRole] = (request.headers.get("x-user-role") || "").split(":");
  if (!userId) return { error: "Unauthorized", status: 401 };
  if (!ALLOWED.includes(baseRole)) {
    return { error: "Доступ только для администратора и менеджера", status: 403 };
  }
  return {
    userName: decodeURIComponent(request.headers.get("x-user-name") || "Админ"),
    userTgId: request.headers.get("x-user-tg-id") || "",
  };
}

export async function GET(request) {
  const g = guard(request);
  if (g.error) return Response.json({ error: g.error }, { status: g.status });

  const [locations, counts] = await Promise.all([getLocations(), countAssetsByLocation()]);
  return Response.json({
    success: true,
    data: locations.map((l) => ({ ...l, assets_count: counts[l.id] || 0 })),
  });
}

export async function POST(request) {
  const g = guard(request);
  if (g.error) return Response.json({ error: g.error }, { status: g.status });

  const { name, note, sort_order } = await request.json();
  const clean = String(name || "").trim();
  if (!clean) return Response.json({ error: "Укажите название места" }, { status: 400 });

  const res = await createLocation({
    name: clean,
    note: String(note || "").trim(),
    sort_order: Number(sort_order) || 0,
  });
  if (res.error) return Response.json({ error: res.error }, { status: 400 });

  await logAction(g.userTgId, g.userName, "asset_location_create", clean, { name: clean });
  return Response.json({ success: true, location: res.row });
}

export async function PATCH(request) {
  const g = guard(request);
  if (g.error) return Response.json({ error: g.error }, { status: g.status });

  const { id, name, note, sort_order } = await request.json();
  if (!id) return Response.json({ error: "Не указан id места" }, { status: 400 });

  const updates = {};
  if (name !== undefined) {
    const clean = String(name).trim();
    if (!clean) return Response.json({ error: "Название не может быть пустым" }, { status: 400 });
    updates.name = clean;
  }
  if (note !== undefined) updates.note = String(note).trim();
  if (sort_order !== undefined) updates.sort_order = Number(sort_order) || 0;

  if (Object.keys(updates).length === 0) {
    return Response.json({ success: true, unchanged: true });
  }

  const ok = await updateLocation(id, updates);
  if (!ok) return Response.json({ error: "Не удалось сохранить место" }, { status: 500 });
  return Response.json({ success: true });
}

export async function DELETE(request) {
  const g = guard(request);
  if (g.error) return Response.json({ error: g.error }, { status: g.status });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "Не указан id места" }, { status: 400 });

  // Место с оборудованием не удаляем: карточки остались бы без привязки,
  // а человек бы этого не заметил.
  const counts = await countAssetsByLocation();
  if (counts[id]) {
    return Response.json(
      { error: `В этом месте числится оборудование (${counts[id]} шт.). Сначала перенесите его.` },
      { status: 400 }
    );
  }

  const ok = await deleteLocation(id);
  if (!ok) return Response.json({ error: "Не удалось удалить место" }, { status: 500 });
  return Response.json({ success: true });
}
