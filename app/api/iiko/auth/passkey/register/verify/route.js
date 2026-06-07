import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { saveUserPasskey } from "@/lib/supabase";
import { cookies } from "next/headers";

export async function POST(request) {
  try {
    const body = await request.json();
    const cookieStore = cookies();
    
    const expectedChallenge = cookieStore.get("reg_challenge")?.value;
    const userIdStr = cookieStore.get("reg_user_id")?.value;

    if (!expectedChallenge || !userIdStr) {
      return Response.json({ error: "Challenge expired or user session missing" }, { status: 400 });
    }

    const hostHeader = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
    const rpID = hostHeader.split(":")[0] || "localhost";
    const protoHeader = request.headers.get("x-forwarded-proto") || "http";
    const origin = `${protoHeader}://${hostHeader}`;

    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    const { verified, registrationInfo } = verification;

    if (verified && registrationInfo) {
      const { credential } = registrationInfo;
      const { id, publicKey, counter } = credential;

      // Convert Uint8Array to Base64 so we can store it in postgres text columns
      const credIdBase64 = id; // id is already a Base64URL string
      const pubKeyBase64 = Buffer.from(publicKey).toString("base64");

      const saved = await saveUserPasskey(
        parseInt(userIdStr),
        credIdBase64,
        pubKeyBase64,
        counter
      );

      if (saved) {
        // Clear cookies
        cookieStore.delete("reg_challenge");
        cookieStore.delete("reg_user_id");
        return Response.json({ verified: true });
      } else {
        return Response.json({ error: "Failed to save key in database" }, { status: 500 });
      }
    }

    return Response.json({ verified: false, error: "Verification failed" }, { status: 400 });
  } catch (e) {
    console.error("[Passkey Register Verify]", e.message);
    return Response.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
