import { generateRegistrationOptions } from "@simplewebauthn/server";
import { isoUint8Array } from "@simplewebauthn/server/helpers";
import { getUserPasskeys } from "@/lib/supabase";
import { cookies } from "next/headers";

export async function POST(request) {
  try {
    const verifiedUserId = request.headers.get("x-user-id");
    const verifiedUserName = request.headers.get("x-user-name") ? decodeURIComponent(request.headers.get("x-user-name")) : null;

    const { user } = await request.json().catch(() => ({}));
    
    // Determine the target user ID securely
    let targetUserId = verifiedUserId ? parseInt(verifiedUserId, 10) : (user?.id ? parseInt(user.id, 10) : null);
    let targetUserName = verifiedUserName || user?.name || `User ${targetUserId}`;

    if (!targetUserId || isNaN(targetUserId)) {
      return Response.json({ error: "Missing or invalid user session info" }, { status: 400 });
    }

    const rpName = "Lokmaco Admin";
    const hostHeader = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
    const rpID = hostHeader.split(":")[0] || "localhost";

    // Fetch existing keys to prevent registering same device twice
    const userKeys = await getUserPasskeys(targetUserId);
    const excludeCredentials = userKeys.map((key) => ({
      id: key.credential_id,
      type: "public-key",
      transports: ["internal"],
    }));

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: isoUint8Array.fromUTF8String(String(targetUserId)),
      userName: targetUserName,
      userDisplayName: targetUserName,
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
    cookies().set("reg_user_id", String(targetUserId), {
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
