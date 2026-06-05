import { NextResponse } from "next/server";
import { verifySessionToken } from "./lib/auth.js";

export async function middleware(request) {
  const path = request.nextUrl.pathname;

  // Public API endpoints that don't need session verification
  const isPublicApi =
    path === "/api/iiko/login" ||
    path === "/api/iiko/auth/passkey/login/options" ||
    path === "/api/iiko/auth/passkey/login/verify";

  if (path.startsWith("/api/iiko")) {
    if (isPublicApi) {
      return NextResponse.next();
    }

    const token = request.cookies.get("session_token")?.value;
    const user = await verifySessionToken(token);

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Session expired or invalid" },
        { status: 401 }
      );
    }

    // Forward verified user details as headers
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", String(user.id || ""));
    requestHeaders.set("x-user-role", String(user.role || ""));
    requestHeaders.set("x-user-tg-id", String(user.tg_id || ""));
    requestHeaders.set("x-user-name", encodeURIComponent(user.name || ""));

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/iiko/:path*",
};
