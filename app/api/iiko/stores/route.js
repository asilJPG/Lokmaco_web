/**
 * GET /api/iiko/stores
 *
 * Mirrors bot.py get_stores_list():
 *   GET /resto/api/corporation/stores → XML
 *   Parse: find <corporateItemDto> with <id> and <name>
 *   Returns: [{id, name}]
 */

import { withIikoSession, iikoGetRaw } from "@/lib/iiko";

export async function GET() {
  try {
    const stores = await withIikoSession(async (token) => {
      const xml = await iikoGetRaw("corporation/stores", token);
      if (!xml) return [];

      const results = [];
      // bot.py tries both corporateItemDto and .//*
      const itemRegex = /<corporateItemDto>([\s\S]*?)<\/corporateItemDto>/g;
      let match;

      while ((match = itemRegex.exec(xml)) !== null) {
        const block = match[1];
        const id = extractTag(block, "id");
        const name = extractTag(block, "name");
        if (id && name) {
          results.push({ id, name });
        }
      }

      return results;
    });

    return Response.json(stores);
  } catch (e) {
    console.error("[/api/iiko/stores]", e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
}

function extractTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}>(.*?)</${tag}>`));
  return m ? m[1].trim() : "";
}
