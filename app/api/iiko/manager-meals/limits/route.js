import {
  getManagerLimits,
  getManagerMeals,
  upsertManagerLimit,
  deleteManagerLimit,
  logAction,
} from "@/lib/supabase";
import { guard, monthRange } from "@/lib/manager-meals";

export const dynamic = "force-dynamic";

/**
 * Руководители с лимитом и остатком на месяц.
 *
 * Остаток может уйти в минус — это осознанно: превышение показываем, но не
 * запрещаем. Решение, что делать с перерасходом, за администратором, а не за
 * кассиром у стойки.
 */
export async function GET(request) {
  const g = guard(request);
  if (g.error) return Response.json({ error: g.error }, { status: g.status });

  const { month, from, to } = monthRange(new URL(request.url).searchParams.get("month"));

  const [limits, meals] = await Promise.all([
    getManagerLimits(),
    getManagerMeals(from, to),
  ]);

  const spent = {};
  for (const m of meals) {
    spent[m.manager_name] = (spent[m.manager_name] || 0) + Number(m.amount || 0);
  }

  const data = limits.map((l) => {
    const used = spent[l.manager_name] || 0;
    const limit = Number(l.monthly_limit) || 0;
    return {
      manager_name: l.manager_name,
      monthly_limit: limit,
      spent: used,
      remaining: limit - used,
      exceeded: used > limit,
    };
  });

  return Response.json({
    success: true,
    month,
    data,
    total_spent: Object.values(spent).reduce((s, v) => s + v, 0),
  });
}

/** Завести руководителя или поменять лимит. Только админ. */
export async function POST(request) {
  const g = guard(request);
  if (g.error) return Response.json({ error: g.error }, { status: g.status });
  if (g.baseRole !== "admin") {
    return Response.json({ error: "Менять лимиты может только администратор" }, { status: 403 });
  }

  const { manager_name, monthly_limit } = await request.json();

  const name = String(manager_name || "").trim();
  if (!name) return Response.json({ error: "Укажите имя руководителя" }, { status: 400 });

  const limit = Math.round(Number(monthly_limit));
  if (!Number.isFinite(limit) || limit < 0) {
    return Response.json({ error: "Лимит должен быть числом от нуля" }, { status: 400 });
  }

  const res = await upsertManagerLimit(name, limit);
  if (res.error) return Response.json({ error: res.error }, { status: 500 });

  await logAction(g.tgId, g.userName, "manager_limit_set", name, {
    manager_name: name,
    monthly_limit: limit,
  });

  return Response.json({ success: true, limit: res.row });
}

/**
 * Убрать руководителя из списка. Записи об обедах при этом остаются: они
 * часть истории, и удалять их вслед за строкой справочника нельзя.
 */
export async function DELETE(request) {
  const g = guard(request);
  if (g.error) return Response.json({ error: g.error }, { status: g.status });
  if (g.baseRole !== "admin") {
    return Response.json({ error: "Менять лимиты может только администратор" }, { status: 403 });
  }

  const name = new URL(request.url).searchParams.get("manager_name");
  if (!name) return Response.json({ error: "Не указан руководитель" }, { status: 400 });

  const ok = await deleteManagerLimit(name);
  if (!ok) return Response.json({ error: "Не удалось удалить" }, { status: 500 });

  await logAction(g.tgId, g.userName, "manager_limit_delete", name, { manager_name: name });
  return Response.json({ success: true });
}
