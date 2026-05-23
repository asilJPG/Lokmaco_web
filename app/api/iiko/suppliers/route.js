/**
 * GET /api/iiko/suppliers
 * GET /resto/api/suppliers → XML → [{id, name}]
 * Filter: supplier=true, deleted=false, only ALLOWED_SUPPLIERS
 */

import { withIikoSession, iikoGetRaw } from "@/lib/iiko";

const ALLOWED_SUPPLIERS = new Set([
  "16c6e655-945c-4002-a117-934749aea133",
  "3bdcfdbb-e66c-4b16-9025-03dedb7905fa",
]);

export async function GET() {
  try {
    const suppliers = await withIikoSession(async (token) => {
      const xml = await iikoGetRaw("suppliers", token);
      if (!xml) return [];

      console.log("[suppliers] XML length:", xml.length);
      console.log("[suppliers] XML preview:", xml.substring(0, 500));

      const results = [];

      // Try multiple patterns
      const patterns = [
        /<employee>([\s\S]*?)<\/employee>/g,
        /<supplier>([\s\S]*?)<\/supplier>/g,
        /<item>([\s\S]*?)<\/item>/g,
      ];

      for (const regex of patterns) {
        let match;
        while ((match = regex.exec(xml)) !== null) {
          const block = match[1];
          const id = extractTag(block, "id");
          const name = extractTag(block, "name");
          const isSupplier = extractTag(block, "supplier");
          const isDeleted = extractTag(block, "deleted");

          if (id && name) {
            // If it has supplier/deleted fields, filter
            if (isSupplier && isSupplier !== "true") continue;
            if (isDeleted && isDeleted === "true") continue;
            if (
              ALLOWED_SUPPLIERS.has(id) &&
              !results.find((r) => r.id === id)
            ) {
              results.push({ id, name });
            }
          }
        }
        if (results.length > 0) break;
      }

      console.log("[suppliers] Found:", results.length);
      return results;
    });

    return Response.json(suppliers);
  } catch (e) {
    console.error("[/api/iiko/suppliers]", e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
}

function extractTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
  return m ? m[1].trim() : "";
}
