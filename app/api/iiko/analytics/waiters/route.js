import { withIikoWebSession } from "@/lib/iiko-web";
import { http1Fetch } from "@/lib/iiko";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const requesterRole = request.headers.get("x-user-role") || "";
    const [baseRole] = requesterRole.split(":");
    if (!["admin", "director", "manager"].includes(baseRole)) {
      return Response.json({ error: "Доступ запрещен для вашей роли" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get("from");
    const dateTo = searchParams.get("to");

    if (!dateFrom || !dateTo) {
      return Response.json({ error: "Missing from or to date parameters" }, { status: 400 });
    }

    const IIKO_WEB_URL = (process.env.IIKO_WEB_URL || "https://the-lokmako.iikoweb.ru").replace(/\/+$/, "");

    const data = await withIikoWebSession(async (cookies) => {
      const kpiPayload = {
        dateFrom: dateFrom,
        dateTo: dateTo,
        dataType: "DATA_DETAILS_BY_METRIC",
        metricCodes: [
          "SALES_GROSS_BY_WAITERS",
          "AVERAGE_SPEND_GROSS_BY_WAITERS",
          "TRN_BY_WAITERS",
          "REFUND_TRN_BY_WAITERS"
        ],
        storeIds: [170243]
      };

      const kpiRes = await http1Fetch(`${IIKO_WEB_URL}/api/kpi/dashboard/get-data`, {
        method: "POST",
        headers: {
          Cookie: cookies,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(kpiPayload),
      });

      const list = [];

      if (kpiRes.ok) {
        const kpiData = await kpiRes.json();
        if (kpiData && !kpiData.error && kpiData.data) {
          const dataPayload = kpiData.data || {};
          const salesMap = dataPayload.SALES_GROSS_BY_WAITERS || {};
          const ordersMap = dataPayload.TRN_BY_WAITERS || {};
          const avgCheckMap = dataPayload.AVERAGE_SPEND_GROSS_BY_WAITERS || {};
          const refundsMap = dataPayload.REFUND_TRN_BY_WAITERS || {};
          
          const decoration = kpiData.decoration || {};
          const employeeMap = decoration.employee || {};

          for (const uuid of Object.keys(salesMap)) {
            const emp = employeeMap[uuid] || {};
            const name = emp.name || "Неизвестный сотрудник";
            const sales = parseFloat(salesMap[uuid] || 0);
            const orders = parseInt(ordersMap[uuid] || 0, 10);
            const refunds = parseInt(refundsMap[uuid] || 0, 10);
            const avgCheck = Math.round(parseFloat(avgCheckMap[uuid] || 0));
            
            list.push({
              name,
              sales,
              orders,
              refunds,
              avgCheck
            });
          }
        }
      }

      // Sort by sales descending
      list.sort((a, b) => b.sales - a.sales);

      return list;
    });

    return Response.json(
      { success: true, data },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
        },
      }
    );
  } catch (e) {
    console.error("[/api/iiko/analytics/waiters] error:", e.message);
    return Response.json({ success: false, error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
