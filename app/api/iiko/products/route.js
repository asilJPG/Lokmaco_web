/**
 * GET /api/iiko/products
 *
 * Mirrors bot.py get_products_list():
 *   GET /resto/api/v2/entities/products/list
 *   Filter: type === "GOODS"
 *   Returns: [{id, name, type, mainUnit}]
 */

export const dynamic = "force-dynamic";
import { withIikoSession, iikoGetJson } from "@/lib/iiko";

export async function GET() {
  try {
    const products = await withIikoSession(async (token) => {
      const data = await iikoGetJson("v2/entities/products/list", token);
      if (!data) return [];

      return data
        .filter((p) => p.type === "GOODS")
        .map((p) => ({
          id: p.id,
          name: p.name,
          type: p.type,
          mainUnit: p.mainUnit || null,
        }));
    });

    return Response.json(products);
  } catch (e) {
    console.error("[/api/iiko/products]", e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
