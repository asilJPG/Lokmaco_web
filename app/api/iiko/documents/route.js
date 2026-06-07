import { withIikoWebSession } from "@/lib/iiko-web";
import { http1Fetch } from "@/lib/iiko";

export const dynamic = "force-dynamic";

const IIKO_WEB_URL = (process.env.IIKO_WEB_URL || "https://the-lokmako.iikoweb.ru").replace(/\/+$/, "");
const STORE_NUM = process.env.IIKO_STORE_NUM || "170243";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Default to start of current month up to tomorrow (Tashkent time offset +5 hours)
    const now = new Date();
    const tzNow = new Date(now.getTime() + 5 * 60 * 60 * 1000);
    
    // Calculate 1st day of current month in Tashkent
    const tzStartOfMonth = new Date(tzNow.getFullYear(), tzNow.getMonth(), 1, 5, 0, 0);
    const tzTomorrow = new Date(tzNow.getTime() + 24 * 60 * 60 * 1000);
    
    const format = (d) => d.toISOString().split("T")[0];
    const dateFrom = searchParams.get("dateFrom") || format(tzStartOfMonth);
    const dateTo = searchParams.get("dateTo") || format(tzTomorrow);
    
    const store = searchParams.get("store") || STORE_NUM;


    const data = await withIikoWebSession(async (cookies) => {
      const url = `${IIKO_WEB_URL}/api/documents/list?dateFrom=${dateFrom}&dateTo=${dateTo}&store=${store}`;
      const res = await http1Fetch(url, {
        headers: {
          Cookie: cookies,
          "Content-Type": "application/json",
        },
      });

      if (res.ok) {
        const payload = await res.json();
        let documentsArray = [];
        if (Array.isArray(payload)) {
          documentsArray = payload;
        } else if (payload && payload.data && Array.isArray(payload.data.documents)) {
          // iikoWeb returns { error: false, data: { documents: [...] } }
          documentsArray = payload.data.documents;
        } else if (payload && Array.isArray(payload.data)) {
          documentsArray = payload.data;
        } else if (payload && payload.documents && Array.isArray(payload.documents)) {
          documentsArray = payload.documents;
        } else if (payload && typeof payload === 'object') {
          const firstKey = Object.keys(payload).find(k => Array.isArray(payload[k]));
          if (firstKey) {
            documentsArray = payload[firstKey];
          }
        }

        return { success: true, data: documentsArray };
      } else {
        const text = await res.text();
        throw new Error(`iikoWeb returned status ${res.status}: ${text}`);
      }
    });

    return Response.json(data);
  } catch (e) {
    console.error("[/api/iiko/documents] error:", e.message);
    return Response.json({ success: false, error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
