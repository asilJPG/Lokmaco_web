import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { cookies } from "next/headers";

export async function POST(request) {
  try {
    const hostHeader = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
    const rpID = hostHeader.split(":")[0] || "localhost";

    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: "preferred",
    });

    // Save challenge in cookies
    cookies().set("login_challenge", options.challenge, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 300,
      path: "/",
    });

    return Response.json(options);
  } catch (e) {
    console.error("[Passkey Login Options]", e.message);
    return Response.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
