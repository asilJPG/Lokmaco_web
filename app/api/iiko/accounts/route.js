import { getAccounts } from "@/lib/iiko";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role") || "";

    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [baseRole] = userRole.split(":");
    if (baseRole !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await getAccounts();
    if (result.success) {
      return Response.json(result);
    } else {
      return Response.json({ success: false, error: result.error }, { status: 500 });
    }
  } catch (e) {
    console.error("[/api/iiko/accounts] error:", e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
