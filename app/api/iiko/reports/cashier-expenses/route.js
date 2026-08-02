import { getCashShifts } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Расходы кассира из кассы, сведённые по месяцам.
 * Строки — назначение расхода (как его вписал кассир), колонки — месяцы.
 */
export async function GET(request) {
  try {
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role") || "";
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const [baseRole] = userRole.split(":");
    if (baseRole !== "admin") {
      return Response.json({ error: "Доступ только для администратора" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from") || null; // YYYY-MM-DD, опционально
    const to = searchParams.get("to") || null;

    const shifts = await getCashShifts(from, to);

    const monthsSet = new Set();
    const items = {}; // name -> { byMonth: {}, total, days: [] }
    const monthTotals = {};
    let grandTotal = 0;
    let rowsCount = 0;

    for (const shift of shifts) {
      const day = shift.details?.selected_date || (shift.created_at || "").split("T")[0];
      if (!day) continue;
      const month = day.slice(0, 7);
      monthsSet.add(month);

      const expenses = Array.isArray(shift.details?.expenses) ? shift.details.expenses : [];
      for (const e of expenses) {
        const amount = parseFloat(e?.amount) || 0;
        if (!amount) continue;
        // Названия кассир вбивает руками — сравниваем без учёта регистра и пробелов,
        // но показываем в исходном виде
        const raw = String(e?.name || "").trim() || "(без названия)";
        const key = raw.toUpperCase().replace(/\s+/g, " ");

        if (!items[key]) items[key] = { name: raw, byMonth: {}, total: 0, entries: [] };
        items[key].byMonth[month] = (items[key].byMonth[month] || 0) + amount;
        items[key].total += amount;
        items[key].entries.push({ date: day, amount, cashier: shift.details?.cashier_name || shift.user_name || null });

        monthTotals[month] = (monthTotals[month] || 0) + amount;
        grandTotal += amount;
        rowsCount += 1;
      }
    }

    const months = Array.from(monthsSet).sort();
    const list = Object.values(items).sort((a, b) => b.total - a.total);

    return Response.json(
      {
        success: true,
        months,
        items: list,
        month_totals: monthTotals,
        grand_total: grandTotal,
        entries_count: rowsCount,
        distinct_names: list.length,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    console.error("[/api/iiko/reports/cashier-expenses]", e.message);
    return Response.json({ success: false, error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
