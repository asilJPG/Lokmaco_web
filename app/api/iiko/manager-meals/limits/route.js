import { getManagerLimits, getManagerMeals } from "@/lib/supabase";
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
