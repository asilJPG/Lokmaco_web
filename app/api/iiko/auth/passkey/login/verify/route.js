import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { getPasskeyById, updatePasskeyCounter, getUserById } from "@/lib/supabase";
import { cookies } from "next/headers";

export async function POST(request) {
  try {
    const body = await request.json();
    const cookieStore = cookies();

    const expectedChallenge = cookieStore.get("login_challenge")?.value;
    if (!expectedChallenge) {
      return Response.json({ error: "Login challenge expired or missing" }, { status: 400 });
    }

    const url = new URL(request.url);
    const rpID = url.hostname;
    const origin = url.origin;

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
      authenticator: {
        credentialID: Buffer.from(passkey.credential_id, "base64url"),
        credentialPublicKey: publicKeyBuffer,
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

      // Clear cookie
      cookieStore.delete("login_challenge");

      return Response.json({ verified: true, user: userSession });
    }

    return Response.json({ verified: false, error: "Verification failed" }, { status: 400 });
  } catch (e) {
    console.error("[Passkey Login Verify]", e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
