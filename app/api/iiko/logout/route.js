import { cookies } from "next/headers";
import { logAction } from "@/lib/supabase.js";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const tgId = request.headers.get("x-user-tg-id");
    const userName = decodeURIComponent(request.headers.get("x-user-name") || "");

    let reason = "manual";
    try {
      const body = await request.json();
      if (body && body.reason) {
        reason = body.reason;
      }
    } catch (_) {
      // Body might be empty
    }

    let actionType = "LOGOUT";
    let details = "Выход из системы";

    if (reason === "visibility") {
      actionType = "LOGOUT_SCREEN";
      details = "Автовыход при блокировке экрана / сворачивании";
    } else if (reason === "idle") {
      actionType = "LOGOUT_IDLE";
      details = "Автовыход по неактивности";
    }

    if (tgId && userName) {
      await logAction(tgId, userName, actionType, "-", details);
    }
  } catch (err) {
    console.error("[Logout Log Error]", err.message);
  }

  cookies().delete("session_token");
  return Response.json({ success: true });
}
