import {
  getManagerMeals,
  createManagerMeal,
  getManagerMealById,
  deleteManagerMeal,
  getManagerLimits,
  logAction,
} from "@/lib/supabase";
import { guard, monthRange, todayTashkent } from "@/lib/manager-meals";

export const dynamic = "force-dynamic";

/**
 * Обеды руководства.
 *
 * Лежит под `/api/iiko/`, хотя к iiko не обращается: только этот префикс
 * покрыт `middleware.js`, который проверяет сессию и прокидывает заголовки
 * пользователя. Вне него эндпоинт был бы открыт всем.
 */
export async function GET(request) {
  const g = guard(request);
  if (g.error) return Response.json({ error: g.error }, { status: g.status });

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  // ?date=YYYY-MM-DD — записи за один день (блок «сегодня» в кассе)
  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return Response.json({ error: "Некорректная дата" }, { status: 400 });
    }
    const meals = await getManagerMeals(date, date);
    return Response.json({ success: true, date, data: meals });
  }

  const { month, from, to } = monthRange(searchParams.get("month"));
  const meals = await getManagerMeals(from, to);

  const byManager = {};
  for (const m of meals) {
    byManager[m.manager_name] = (byManager[m.manager_name] || 0) + Number(m.amount || 0);
  }

  return Response.json({
    success: true,
    month,
    data: meals,
    total: meals.reduce((s, m) => s + Number(m.amount || 0), 0),
    byManager,
  });
}

export async function POST(request) {
  const g = guard(request);
  if (g.error) return Response.json({ error: g.error }, { status: g.status });

  const { date, manager_name, amount, comment } = await request.json();

  const day = date || todayTashkent();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return Response.json({ error: "Некорректная дата" }, { status: 400 });
  }

  const name = String(manager_name || "").trim();
  if (!name) return Response.json({ error: "Выберите руководителя" }, { status: 400 });

  // Имя сверяем со справочником: свободный ввод расползётся в «Равшан ака»
  // и «Равшан», и остаток лимита посчитается по каждому отдельно.
  const limits = await getManagerLimits();
  if (limits.length && !limits.some((l) => l.manager_name === name)) {
    return Response.json({ error: "Такого руководителя нет в списке" }, { status: 400 });
  }

  const sum = Math.round(Number(amount));
  if (!Number.isFinite(sum) || sum <= 0) {
    return Response.json({ error: "Сумма должна быть больше нуля" }, { status: 400 });
  }

  const res = await createManagerMeal({
    date: day,
    manager_name: name,
    amount: sum,
    entered_by_tg_id: g.tgId,
    entered_by_name: g.userName,
    comment: comment ? String(comment).trim() : null,
  });
  if (res.error) return Response.json({ error: res.error }, { status: 500 });

  await logAction(g.tgId, g.userName, "manager_meal", day, {
    manager_name: name,
    amount: sum,
    comment: comment || "",
  });

  return Response.json({ success: true, meal: res.row });
}

/** Удалять может админ или тот, кто внёс — и только записи за сегодня. */
export async function DELETE(request) {
  const g = guard(request);
  if (g.error) return Response.json({ error: g.error }, { status: g.status });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "Не указан id записи" }, { status: 400 });

  const meal = await getManagerMealById(id);
  if (!meal) return Response.json({ error: "Запись не найдена" }, { status: 404 });

  if (g.baseRole !== "admin") {
    if (Number(meal.entered_by_tg_id) !== g.tgId) {
      return Response.json({ error: "Можно удалять только свои записи" }, { status: 403 });
    }
    if (meal.date !== todayTashkent()) {
      return Response.json(
        { error: "Запись за прошлый день может удалить только администратор" },
        { status: 403 }
      );
    }
  }

  const ok = await deleteManagerMeal(id);
  if (!ok) return Response.json({ error: "Не удалось удалить запись" }, { status: 500 });

  await logAction(g.tgId, g.userName, "manager_meal_delete", meal.date, {
    manager_name: meal.manager_name,
    amount: meal.amount,
  });

  return Response.json({ success: true });
}
