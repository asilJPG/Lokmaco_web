import { getActionsList } from "@/lib/supabase.js";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const list = await getActionsList();
    return Response.json({ success: true, history: list });
  } catch (e) {
    console.error("[/api/iiko/history] error:", e.message);
    return Response.json({ success: false, error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
