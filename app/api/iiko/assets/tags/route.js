import {
  getTags,
  getTagByCode,
  createTags,
  updateTag,
  getLastTagCode,
  updateAsset,
  logAction,
} from "@/lib/supabase";
import { normalizeTagCode, TAG_PREFIX as PREFIX } from "@/lib/asset-tags";

export const dynamic = "force-dynamic";

const ALLOWED = ["admin", "manager"];
const MAX_BATCH = 500;

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

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const norm = normalizeTagCode(code);
    if (!norm) return Response.json({ error: "Некорректный код наклейки" }, { status: 400 });
    const tag = await getTagByCode(norm);
    if (!tag) return Response.json({ error: "Наклейка не найдена", code: norm }, { status: 404 });
    return Response.json({ success: true, tag });
  }

  const tags = await getTags({
    batch: searchParams.get("batch") || undefined,
    onlyFree: searchParams.get("free") === "1",
  });
  return Response.json({
    success: true,
    data: tags,
    stats: {
      total: tags.length,
      free: tags.filter((t) => !t.asset_id).length,
    },
  });
}

/** Печать новой пачки: заводим пустые коды, продолжая общую нумерацию. */
export async function POST(request) {
  const g = guard(request);
  if (g.error) return Response.json({ error: g.error }, { status: g.status });

  const { count } = await request.json();
  const n = parseInt(count, 10);
  if (!Number.isFinite(n) || n < 1) {
    return Response.json({ error: "Укажите количество наклеек" }, { status: 400 });
  }
  if (n > MAX_BATCH) {
    return Response.json({ error: `За раз можно напечатать не больше ${MAX_BATCH}` }, { status: 400 });
  }

  const last = await getLastTagCode(PREFIX);
  const lastNum = last ? parseInt(String(last).slice(PREFIX.length), 10) || 0 : 0;

  const batch = new Date().toISOString().slice(0, 19).replace("T", " ");
  const rows = [];
  for (let i = 1; i <= n; i++) {
    rows.push({ code: `${PREFIX}${String(lastNum + i).padStart(4, "0")}`, batch });
  }

  const res = await createTags(rows);
  if (res.error) return Response.json({ error: res.error }, { status: 500 });

  await logAction(g.userTgId, g.userName, "asset_tags_create", batch, {
    count: n,
    from: rows[0].code,
    to: rows[rows.length - 1].code,
  });

  return Response.json({ success: true, batch, tags: res.rows });
}

/**
 * Привязка наклейки к единице оборудования (и заодно к месту) — то самое
 * действие «подошёл, отсканировал, выбрал что это».
 */
export async function PATCH(request) {
  const g = guard(request);
  if (g.error) return Response.json({ error: g.error }, { status: g.status });

  const body = await request.json();
  const code = normalizeTagCode(body.code);
  if (!code) return Response.json({ error: "Некорректный код наклейки" }, { status: 400 });

  const tag = await getTagByCode(code);
  if (!tag) return Response.json({ error: "Такой наклейки нет в системе" }, { status: 404 });

  // Отвязка
  if (body.unbind) {
    const res = await updateTag(code, { asset_id: null, bound_at: null, bound_by: null });
    if (res.error) return Response.json({ error: res.error }, { status: 400 });
    await logAction(g.userTgId, g.userName, "asset_tag_unbind", code, {
      was_asset_id: tag.asset_id,
    });
    return Response.json({ success: true, unbound: true });
  }

  const assetId = body.asset_id;
  if (!assetId) return Response.json({ error: "Не выбрано оборудование" }, { status: 400 });

  // Перепривязка на другую единицу — осознанное действие, требует флага:
  // иначе случайный скан занятой наклейки молча переклеил бы учёт.
  if (tag.asset_id && tag.asset_id !== assetId && !body.force) {
    return Response.json(
      {
        error: "Наклейка уже привязана к другому оборудованию",
        conflict: true,
        current: tag.asset,
      },
      { status: 409 }
    );
  }

  const res = await updateTag(code, {
    asset_id: assetId,
    bound_at: new Date().toISOString(),
    bound_by: g.userName,
  });
  if (res.error) return Response.json({ error: res.error }, { status: 400 });

  // Место меняем тем же действием: чаще всего его и уточняют при оклейке
  if (body.location_id !== undefined) {
    await updateAsset(assetId, { location_id: body.location_id || null });
  }

  await logAction(g.userTgId, g.userName, "asset_tag_bind", code, {
    asset_id: assetId,
    location_id: body.location_id || null,
    rebound_from: tag.asset_id || null,
  });

  return Response.json({ success: true });
}
