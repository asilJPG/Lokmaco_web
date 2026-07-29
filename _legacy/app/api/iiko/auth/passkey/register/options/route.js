import { generateRegistrationOptions } from "@simplewebauthn/server";
import { isoUint8Array } from "@simplewebauthn/server/helpers";
import { getUserPasskeys } from "@/lib/supabase";
import { cookies } from "next/headers";

export async function POST(request) {
  try {
    const { user } = await request.json();
    if (!user || !user.id) {
      return Response.json({ error: "Missing user info" }, { status: 400 });
    }

    const rpName = "Lokmaco Admin";
    const hostHeader = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
    const rpID = hostHeader.split(":")[0] || "localhost";

    // Fetch existing keys to prevent registering same device twice
    const userKeys = await getUserPasskeys(user.id);
    const excludeCredentials = userKeys.map((key) => ({
      id: key.credential_id,
      type: "public-key",
      transports: ["internal"],
    }));

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: isoUint8Array.fromUTF8String(String(user.id)),
      userName: user.name || `User ${user.id}`,
      userDisplayName: user.name || `User ${user.id}`,
      attestationType: "none",
      excludeCredentials,
      authenticatorSelection: {
        residentKey: "required",
        userVerification: "preferred",
        authenticatorAttachment: "platform", // forces platform biometric (FaceID/TouchID)
      },
    });

    // Save challenge in cookies
    cookies().set("reg_challenge", options.challenge, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 300,
      path: "/",
    });
    
    // Save user_id in cookies as well for verification
    cookies().set("reg_user_id", String(user.id), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 300,
      path: "/",
    });

    return Response.json(options);
  } catch (e) {
    console.error("[Passkey Register Options]", e.message);
    return Response.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
