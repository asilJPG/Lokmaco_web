import { withIikoWebSession } from "@/lib/iiko-web";
import { http1Fetch } from "@/lib/iiko";

export const dynamic = "force-dynamic";

const IIKO_WEB_URL = (process.env.IIKO_WEB_URL || "https://the-lokmako.iikoweb.ru").replace(/\/+$/, "");

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const type = searchParams.get("type");

    if (!id || !type) {
      return Response.json({ success: false, error: "Missing id or type parameter" }, { status: 400 });
    }

    const data = await withIikoWebSession(async (cookies) => {
      const url = `${IIKO_WEB_URL}/api/documents/get/${id}?type=${type}`;
      const res = await http1Fetch(url, {
        headers: {
          Cookie: cookies,
          "Content-Type": "application/json",
        },
      });

      if (res.ok) {
        return await res.json();
      } else {
        const text = await res.text();
        throw new Error(`iikoWeb returned status ${res.status}: ${text}`);
      }
    });

    return Response.json(data);
  } catch (e) {
    console.error("[/api/iiko/documents/detail] error:", e.message);
    return Response.json({ success: false, error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
