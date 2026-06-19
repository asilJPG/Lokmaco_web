import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function POST(request) {
  cookies().delete("session_token");
  return Response.json({ success: true });
}
