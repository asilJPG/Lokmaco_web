import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function POST() {
  cookies().delete("session_token");
  return Response.json({ success: true });
}
