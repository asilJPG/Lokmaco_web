import { logAction, createCashReport } from "@/lib/supabase.js";

export async function POST(request) {
  try {
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role") || "";
    const userTgId = request.headers.get("x-user-tg-id") || "";
    const userName = decodeURIComponent(request.headers.get("x-user-name") || "");

    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = {
      id: userId,
      role: userRole,
      tg_id: userTgId,
      name: userName
    };

    const { payments, expenses, surplus, shortage, comment, date, employeeWages } = await request.json();

    const [baseRole] = (user.role || "").split(":");
    const allowedRoles = ["admin", "director", "cashier"];
    if (!allowedRoles.includes(baseRole)) {
      return Response.json({ error: "Доступ запрещен для вашей роли" }, { status: 403 });
    }

    const now = new Date();
    const tashkent = new Date(now.getTime() + 5 * 60 * 60 * 1000);
    const dn = `CSH-${formatCompact(tashkent)}`;

    const pay = payments || {};
    const exp = expenses || [];

    const cashVal = parseFloat(pay.cash) || 0;
    const encashmentVal = parseFloat(pay.encashment) || 0;
    const uzcardVal = parseFloat(pay.uzcard) || 0;
    const humoVal = parseFloat(pay.humo) || 0;
    const onlineVal = parseFloat(pay.online) || 0;
    const rahmatVal = parseFloat(pay.rahmat) || 0;
    const uzumVal = parseFloat(pay.uzum) || 0;
    const yandexVal = parseFloat(pay.yandex) || 0;

    const totalSales = cashVal + encashmentVal + uzcardVal + humoVal + onlineVal + rahmatVal + uzumVal + yandexVal;
    const totalExpenses = exp.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

    const surp = parseFloat(surplus) || 0;
    const short = parseFloat(shortage) || 0;

    // Discrepancy = surplus - shortage
    const diff = surp - short;
    const iikoCash = totalSales - diff;

    // Construct Tashkent timezone timestamp for target date
    // e.g. "2026-05-30" -> "2026-05-30T12:00:00+05:00"
    const createdAt = date ? `${date}T12:00:00+05:00` : null;

    await createCashReport(user.tg_id, user.name, totalSales, iikoCash, diff, createdAt);

    // Detailed JSON for bot_actions
    const details = {
      payments: {
        cash: cashVal,
        encashment: encashmentVal,
        uzcard: uzcardVal,
        humo: humoVal,
        online: onlineVal,
        rahmat: rahmatVal,
        uzum: uzumVal,
        yandex: yandexVal,
      },
      expenses: exp,
      employee_wages: employeeWages || [],
      total_sales: totalSales,
      total_expenses: totalExpenses,
      surplus: surp,
      shortage: short,
      difference: diff,
      iiko_cash: iikoCash,
      comment: comment || "",
    };

    if (date) {
      details.selected_date = date;
    }

    await logAction(user.tg_id, user.name, "cash", dn, details, createdAt);

    return Response.json({ success: true, documentNumber: dn });
  } catch (e) {
    console.error("[/api/iiko/cash]", e.message);
    return Response.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function formatCompact(d) {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
}
