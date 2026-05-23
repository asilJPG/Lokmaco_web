/**
 * GET /api/iiko/stores
 * GET /resto/api/corporation/stores → XML → [{id, name}]
 */

import { withIikoSession, iikoGetRaw } from "@/lib/iiko";

export async function GET() {
  try {
    const stores = await withIikoSession(async (token) => {
      const xml = await iikoGetRaw("corporation/stores", token);
      if (!xml) return [];

      console.log("[stores] XML length:", xml.length);
      console.log("[stores] XML preview:", xml.substring(0, 500));

      const results = [];

      // Try multiple tag patterns — iiko XML structure varies
      const patterns = [
        /<corporateItemDto>([\s\S]*?)<\/corporateItemDto>/g,
        /<store>([\s\S]*?)<\/store>/g,
        /<item>([\s\S]*?)<\/item>/g,
      ];

      for (const regex of patterns) {
        let match;
        while ((match = regex.exec(xml)) !== null) {
          const block = match[1];
          const id = extractTag(block, "id");
          const name = extractTag(block, "name");
          if (id && name && !results.find((r) => r.id === id)) {
            results.push({ id, name });
          }
        }
        if (results.length > 0) break;
      }

      // Fallback: grab ALL <id>...</id> and <name>...</name> pairs
      if (results.length === 0) {
        const ids = [...xml.matchAll(/<id>([^<]+)<\/id>/g)].map((m) =>
          m[1].trim()
        );
        const names = [...xml.matchAll(/<name>([^<]+)<\/name>/g)].map((m) =>
          m[1].trim()
        );
        const count = Math.min(ids.length, names.length);
        for (let i = 0; i < count; i++) {
          if (ids[i] && names[i]) {
            results.push({ id: ids[i], name: names[i] });
          }
        }
      }

      console.log("[stores] Found:", results.length);
      return results;
    });

    return Response.json(stores);
  } catch (e) {
    console.error("[/api/iiko/stores]", e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
}

function extractTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
  return m ? m[1].trim() : "";
}
