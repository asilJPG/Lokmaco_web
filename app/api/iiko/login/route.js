import { getUserByCode } from "@/lib/supabase.js";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const { code } = await request.json();

    if (!code || String(code).length < 4) {
      return Response.json({ success: false, error: "Код должен быть 4-значным числом" }, { status: 400 });
    }

    const user = await getUserByCode(code);

    if (user) {
      return Response.json({
        success: true,
        user: {
          tg_id: user.tg_id,
          name: user.name,
          role: user.role,
        },
      });
    }

    return Response.json({ success: false, error: "Пользователь не найден или неверный код" }, { status: 401 });
  } catch (e) {
    console.error("[/api/iiko/login] error:", e.message);
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
}
