import { logAction, updateActionDetails } from "@/lib/supabase.js";
import {
  BALANCE_ACTION,
  buildReconciliation,
  findCountRow,
  getCountRow,
  tashkentDate,
} from "@/lib/bazaar.js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Остаток вносит бухгалтер; админ — сверх всего. Остальным раздел закрыт.
const ROLES = ["admin", "accountant"];

function guard(request) {
  const userId = request.headers.get("x-user-id");
  const [baseRole] = (request.headers.get("x-user-role") || "").split(":");
  if (!userId) return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!ROLES.includes(baseRole)) {
    return { error: Response.json({ error: "Доступ закрыт для вашей роли" }, { status: 403 }) };
  }
  return {
    role: baseRole,
    tgId: request.headers.get("x-user-tg-id") || "",
    name: decodeURIComponent(request.headers.get("x-user-name") || ""),
  };
}

/** Отметки остатка и результат сверки по окнам. */
export async function GET(request) {
  const g = guard(request);
  if (g.error) return g.error;

  try {
    const { counts, windows, baseline } = await buildReconciliation();
    return Response.json({
      success: true,
      today: tashkentDate(new Date().toISOString()),
      baseline,
      // Последние отметки — чтобы видеть, что уже внесено
      counts: [...counts].reverse().slice(0, 30),
      windows,
    });
  } catch (e) {
    console.error("[/api/iiko/bazaar GET]", e.message);
    return Response.json({ error: "Не удалось загрузить сверку" }, { status: 500 });
  }
}

/** Внести (или исправить) остаток у снабженца на конец дня закупа. */
export async function POST(request) {
  const g = guard(request);
  if (g.error) return g.error;

  try {
    const body = await request.json();
    const date = String(body.date || "");
    const leftover = Number(body.leftover);
    const comment = String(body.comment || "").slice(0, 300);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return Response.json({ error: "Укажите дату закупа" }, { status: 400 });
    }
    if (date > tashkentDate(new Date().toISOString())) {
      return Response.json({ error: "Дата не может быть в будущем" }, { status: 400 });
    }
    // Остаток может быть нулём (всё потратил), но не отрицательным и не абсурдным
    if (!Number.isFinite(leftover) || leftover < 0 || leftover > 1_000_000_000) {
      return Response.json({ error: "Остаток — число от 0 до 1 000 000 000" }, { status: 400 });
    }

    const details = { date, leftover: Math.round(leftover), comment };

    // Повторный ввод на ту же дату исправляет запись, а не плодит дубли
    const existing = await findCountRow(date);
    if (existing) {
      const ok = await updateActionDetails(existing.id, {
        ...existing.details,
        ...details,
        edited_by: g.name,
        edited_at: new Date().toISOString(),
      });
      if (!ok) return Response.json({ error: "Не удалось сохранить" }, { status: 502 });
      return Response.json({ success: true, updated: true });
    }

    const logged = await logAction(g.tgId, g.name, BALANCE_ACTION, date, details);
    if (!logged) return Response.json({ error: "Не удалось сохранить" }, { status: 502 });
    return Response.json({ success: true, updated: false });
  } catch (e) {
    console.error("[/api/iiko/bazaar POST]", e.message);
    return Response.json({ error: "Не удалось сохранить остаток" }, { status: 500 });
  }
}

/**
 * Убрать ошибочную отметку. Запись не стирается, а помечается: так остаётся
 * след, кто и когда её убрал, а сверка её просто не учитывает.
 */
export async function DELETE(request) {
  const g = guard(request);
  if (g.error) return g.error;

  try {
    const { id } = await request.json();
    if (!id) return Response.json({ error: "Не указана отметка" }, { status: 400 });

    const row = await getCountRow(id);
    if (!row) return Response.json({ error: "Отметка не найдена" }, { status: 404 });

    const ok = await updateActionDetails(id, {
      ...row.details,
      deleted_at: new Date().toISOString(),
      deleted_by: g.name,
    });
    if (!ok) return Response.json({ error: "Не удалось убрать" }, { status: 502 });
    return Response.json({ success: true });
  } catch (e) {
    console.error("[/api/iiko/bazaar DELETE]", e.message);
    return Response.json({ error: "Не удалось убрать отметку" }, { status: 500 });
  }
}
