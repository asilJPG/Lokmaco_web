import { getStoreBalances } from "@/lib/iiko-web";

export const dynamic = "force-dynamic";

export async function GET(_request) {
  try {
    const data = await getStoreBalances();
    return Response.json(data);
  } catch (e) {
    console.error("[/api/iiko/balances] GET error:", e.message);
    return Response.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
