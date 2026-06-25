import { getUserByCode, getUserPasskeys, updateUserLastLogin, logAction } from "@/lib/supabase.js";
import { signSession } from "@/lib/auth.js";
import { cookies } from "next/headers";
import { rateLimit } from "@/lib/rate-limit.js";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    // 1. Rate limiting by IP
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "127.0.0.1";
    const limiter = rateLimit(ip);
    if (!limiter.allowed) {
      return Response.json(
        { success: false, error: `Слишком много попыток входа. Пожалуйста, подождите ${Math.ceil(limiter.retryAfterMs / 1000)} сек.` },
        { status: 429 }
      );
    }

    const { code } = await request.json();

    if (!code || String(code).length < 4) {
      limiter.increment();
      return Response.json({ success: false, error: "Пароль должен быть не менее 4 символов" }, { status: 400 });
    }

    const user = await getUserByCode(code);

    if (user) {
      const [baseRole] = (user.role || "").split(":");
      if (baseRole === "director") {
        const passkeys = await getUserPasskeys(user.id);
        if (passkeys && passkeys.length > 0) {
          limiter.increment();
          return Response.json(
            { success: false, error: "Вход по коду заблокирован. Используйте Face ID / Touch ID" },
            { status: 403 }
          );
        }
      }

      // Sign session token and set HTTP-only cookie
      const token = await signSession({
        id: user.id,
        tg_id: user.tg_id,
        name: user.name,
        role: user.role,
      });

      cookies().set("session_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 3600, // 7 days
      });

      // Update user last login and write to audit log in Supabase
      try {
        await updateUserLastLogin(user.id, "password");
        await logAction(user.tg_id, user.name, "LOGIN_PASSWORD", "-", "Вход по паролю");
      } catch (logErr) {
        console.error("[Login Log Error]", logErr.message);
      }

      return Response.json({
        success: true,
        user: {
          id: user.id,
          tg_id: user.tg_id,
          name: user.name,
          role: user.role,
        },
      });
    }

    limiter.increment();
    return Response.json({ success: false, error: "Пользователь не найден или неверный код" }, { status: 401 });
  } catch (e) {
    console.error("[/api/iiko/login] error:", e.message);
    return Response.json({ success: false, error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
