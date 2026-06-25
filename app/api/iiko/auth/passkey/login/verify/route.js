import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { getPasskeyById, updatePasskeyCounter, getUserById, updateUserLastLogin, logAction } from "@/lib/supabase";
import { cookies } from "next/headers";
import { signSession } from "@/lib/auth";

export async function POST(request) {
  try {
    const body = await request.json();
    const cookieStore = cookies();

    const expectedChallenge = cookieStore.get("login_challenge")?.value;
    if (!expectedChallenge) {
      return Response.json({ error: "Login challenge expired or missing" }, { status: 400 });
    }

    const hostHeader = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
    const rpID = hostHeader.split(":")[0] || "localhost";
    const protoHeader = request.headers.get("x-forwarded-proto") || "http";
    const origin = `${protoHeader}://${hostHeader}`;

    // The browser returns the credential ID in base64url or raw. We check body.id.
    const credentialId = body.id;
    const passkey = await getPasskeyById(credentialId);

    if (!passkey) {
      return Response.json({ error: "Device not registered for any user" }, { status: 404 });
    }

    // Convert stored base64 public key back to Uint8Array/Buffer
    const publicKeyBuffer = Buffer.from(passkey.public_key, "base64");

    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: passkey.credential_id,
        publicKey: publicKeyBuffer,
        counter: passkey.counter,
      },
    });

    const { verified, authenticationInfo } = verification;

    if (verified && authenticationInfo) {
      // Update counter in DB
      await updatePasskeyCounter(passkey.credential_id, authenticationInfo.newCounter);

      // Fetch user details to sign them in
      const dbUser = await getUserById(passkey.user_id);
      if (!dbUser) {
        return Response.json({ error: "User not found" }, { status: 404 });
      }

      // Format role string for frontend parsing
      const rawRole = dbUser.role || "";
      const [baseRole, storeId] = rawRole.split(":");

      const userSession = {
        id: dbUser.id,
        tg_id: dbUser.tg_id,
        name: dbUser.name,
        role: rawRole,
        baseRole: baseRole || "",
        storeId: storeId || null,
      };

      // Sign session token and set HTTP-only cookie
      const token = await signSession({
        id: dbUser.id,
        tg_id: dbUser.tg_id,
        name: dbUser.name,
        role: rawRole,
      });

      cookieStore.set("session_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 3600, // 7 days
      });

      // Clear cookie
      cookieStore.delete("login_challenge");

      // Update last login and write to audit log in Supabase
      try {
        await updateUserLastLogin(dbUser.id, "passkey");
        await logAction(dbUser.tg_id, dbUser.name, "LOGIN_PASSKEY", "-", "Вход по Face ID / Touch ID");
      } catch (logErr) {
        console.error("[Passkey Login Log Error]", logErr.message);
      }

      return Response.json({ verified: true, user: userSession });
    }

    return Response.json({ verified: false, error: "Verification failed" }, { status: 400 });
  } catch (e) {
    console.error("[Passkey Login Verify]", e.message);
    return Response.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
