import {
  logAction,
  createCashReport,
  getCashShifts,
  getCashShiftById,
  updateCashShiftDetails,
} from "@/lib/supabase.js";

export const dynamic = "force-dynamic";

/** Список сданных смен за период — для админского редактора. */
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
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const rows = await getCashShifts(from, to);
    const shifts = rows.map((r) => ({
      id: r.id,
      date: r.details?.selected_date || (r.created_at || "").split("T")[0],
      created_at: r.created_at,
      cashier: r.details?.cashier_name || r.user_name || "Кассир",
      document_number: r.document_number,
      details: r.details || {},
      edited: Array.isArray(r.details?.edit_history) && r.details.edit_history.length > 0,
    }));

    return Response.json(
      { success: true, shifts },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    console.error("[/api/iiko/cash GET]", e.message);
    return Response.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

/**
 * Правка уже сданной смены. Только админ.
 * Производные (total_sales, total_expenses, difference, iiko_cash) пересчитываются
 * по той же формуле, что и при сдаче — руками их передавать нельзя.
 */
export async function PATCH(request) {
  try {
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role") || "";
    const userName = decodeURIComponent(request.headers.get("x-user-name") || "Админ");
    const userTgId = request.headers.get("x-user-tg-id") || "";

    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const [baseRole] = userRole.split(":");
    if (baseRole !== "admin") {
      return Response.json({ error: "Доступ только для администратора" }, { status: 403 });
    }

    const body = await request.json();
    const { id, payments, expenses, surplus, shortage, comment, date, edit_reason } = body;

    if (!id) {
      return Response.json({ error: "Не указан id смены" }, { status: 400 });
    }

    const existing = await getCashShiftById(id);
    if (!existing) {
      return Response.json({ error: "Смена не найдена" }, { status: 404 });
    }

    const prev = existing.details || {};
    const prevPay = prev.payments || {};
    const n = (v) => parseFloat(v) || 0;

    // Не переданное поле остаётся прежним — правка частичная
    const nextPay = {
      cash: payments?.cash !== undefined ? n(payments.cash) : n(prevPay.cash),
      encashment: payments?.encashment !== undefined ? n(payments.encashment) : n(prevPay.encashment),
      uzcard: payments?.uzcard !== undefined ? n(payments.uzcard) : n(prevPay.uzcard),
      humo: payments?.humo !== undefined ? n(payments.humo) : n(prevPay.humo),
      online: payments?.online !== undefined ? n(payments.online) : n(prevPay.online),
      rahmat: payments?.rahmat !== undefined ? n(payments.rahmat) : n(prevPay.rahmat),
      uzum: payments?.uzum !== undefined ? n(payments.uzum) : n(prevPay.uzum),
      yandex: payments?.yandex !== undefined ? n(payments.yandex) : n(prevPay.yandex),
    };

    const nextExpenses = Array.isArray(expenses)
      ? expenses
          .filter((it) => it && (it.name || it.amount))
          .map((it) => ({ name: String(it.name || "").trim(), amount: n(it.amount) }))
      : prev.expenses || [];

    const surp = surplus !== undefined ? n(surplus) : n(prev.surplus);
    const short = shortage !== undefined ? n(shortage) : n(prev.shortage);

    const totalSales = Object.values(nextPay).reduce((s, v) => s + v, 0);
    const totalExpenses = nextExpenses.reduce((s, it) => s + n(it.amount), 0);
    const diff = surp - short;
    const iikoCash = totalSales - diff;

    // Что реально изменилось — только это уходит в аудит
    const changes = {};
    for (const [k, v] of Object.entries(nextPay)) {
      if (n(prevPay[k]) !== v) changes[`payments.${k}`] = { from: n(prevPay[k]), to: v };
    }
    if (n(prev.total_expenses) !== totalExpenses) {
      changes.total_expenses = { from: n(prev.total_expenses), to: totalExpenses };
    }
    if (n(prev.surplus) !== surp) changes.surplus = { from: n(prev.surplus), to: surp };
    if (n(prev.shortage) !== short) changes.shortage = { from: n(prev.shortage), to: short };
    if (date && date !== prev.selected_date) {
      changes.selected_date = { from: prev.selected_date || null, to: date };
    }

    if (Object.keys(changes).length === 0) {
      return Response.json({ success: true, unchanged: true, message: "Изменений нет" });
    }

    const editEntry = {
      edited_at: new Date().toISOString(),
      edited_by: userName,
      edited_by_id: String(userId),
      reason: (edit_reason || "").trim() || null,
      changes,
    };

    const details = {
      ...prev,
      payments: nextPay,
      expenses: nextExpenses,
      surplus: surp,
      shortage: short,
      difference: diff,
      total_sales: totalSales,
      total_expenses: totalExpenses,
      iiko_cash: iikoCash,
      comment: comment !== undefined ? String(comment || "") : prev.comment || "",
      selected_date: date || prev.selected_date,
      edit_history: [...(Array.isArray(prev.edit_history) ? prev.edit_history : []), editEntry],
    };

    const ok = await updateCashShiftDetails(id, details);
    if (!ok) {
      return Response.json({ success: false, error: "Не удалось сохранить смену" }, { status: 500 });
    }

    await logAction(userTgId, userName, "cash_edit", String(existing.document_number || id), {
      shift_id: id,
      shift_date: details.selected_date,
      changes,
      reason: editEntry.reason,
    });

    return Response.json({ success: true, details, changed: Object.keys(changes).length });
  } catch (e) {
    console.error("[/api/iiko/cash PATCH]", e.message);
    return Response.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

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
