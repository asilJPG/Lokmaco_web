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

const UNIT_MAP = {
  "7ba81c3a-8de5-8f9d-fb9f-e39efcbc57cc": "кг",
  "69859c74-db72-b006-cba5-326cf6f4fc6e": "л",
  "cd19b5ea-1b32-a6e5-1df7-5d2784a0549a": "шт",
  "109fb602-70ad-473d-ba1f-f037b6e72887": "шт",
};

export async function GET() {
  try {
    const products = await withIikoSession(async (token) => {
      const data = await iikoGetJson("v2/entities/products/list", token);
      if (!data) return [];

      return data
        .filter((p) => p.type === "GOODS" || p.type === "PREPARED")
        .map((p) => ({
          id: p.id,
          name: p.name,
          type: p.type,
          code: p.code || "",
          num: p.num || "",
          mainUnit: p.mainUnit ? (UNIT_MAP[p.mainUnit] || "шт") : "шт",
        }));
    });

    return Response.json(products);
  } catch (e) {
    console.error("[/api/iiko/products]", e.message);
    return Response.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
