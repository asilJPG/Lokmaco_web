import { getManagerByToken, getManagerMeals } from "@/lib/supabase";
import { guard, monthRange, normalizeManagerToken } from "@/lib/manager-meals";

export const dynamic = "force-dynamic";

/**
 * Кто стоит за QR-кодом и сколько у него осталось лимита.
 *
 * Остаток отдаётся **только здесь** — при ручном выборе из списка кассир его
 * не видит. Смысл в том, что QR предъявляет сам руководитель: он в курсе
 * своего лимита, а кассиру знать чужие лимиты незачем.
 */
export async function GET(request) {
  const g = guard(request);
  if (g.error) return Response.json({ error: g.error }, { status: g.status });

  const token = normalizeManagerToken(new URL(request.url).searchParams.get("token"));
  if (!token) return Response.json({ error: "Некорректный QR-код" }, { status: 400 });

  const manager = await getManagerByToken(token);
  if (!manager) {
    return Response.json({ error: "Код не найден — возможно, он устарел" }, { status: 404 });
  }

  const { month, from, to } = monthRange();
  const meals = await getManagerMeals(from, to);
  const spent = meals
    .filter((m) => m.manager_name === manager.manager_name)
    .reduce((s, m) => s + Number(m.amount || 0), 0);

  const limit = Number(manager.monthly_limit) || 0;

  return Response.json({
    success: true,
    month,
    manager: {
      manager_name: manager.manager_name,
      monthly_limit: limit,
      spent,
      remaining: limit - spent,
      exceeded: spent > limit,
    },
  });
}
