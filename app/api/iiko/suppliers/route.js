/**
 * GET /api/iiko/suppliers
 *
 * Mirrors bot.py get_suppliers_list():
 *   GET /resto/api/suppliers → XML
 *   Parse: find <employee> where <supplier>true</supplier> and <deleted>false</deleted>
 *   Filter: only ALLOWED_SUPPLIERS UUIDs
 *   Returns: [{id, name}]
 */

import { withIikoSession, iikoGetRaw } from "@/lib/iiko";

// From bot.py — only these two suppliers are allowed
const ALLOWED_SUPPLIERS = new Set([
  "16c6e655-945c-4002-a117-934749aea133",
  "3bdcfdbb-e66c-4b16-9025-03dedb7905fa",
]);

export async function GET() {
  try {
    const suppliers = await withIikoSession(async (token) => {
      const xml = await iikoGetRaw("suppliers", token);
      if (!xml) return [];

      // Simple XML parsing (same logic as bot.py ET.fromstring)
      // Extract <employee> blocks where supplier=true, deleted=false
      const results = [];
      const employeeRegex = /<employee>([\s\S]*?)<\/employee>/g;
      let match;

      while ((match = employeeRegex.exec(xml)) !== null) {
        const block = match[1];
        const id = extractTag(block, "id");
        const name = extractTag(block, "name");
        const isSupplier = extractTag(block, "supplier");
        const isDeleted = extractTag(block, "deleted");

        if (isSupplier === "true" && isDeleted === "false" && id && ALLOWED_SUPPLIERS.has(id)) {
          results.push({ id, name });
        }
      }

      return results;
    });

    return Response.json(suppliers);
  } catch (e) {
    console.error("[/api/iiko/suppliers]", e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
}

function extractTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}>(.*?)</${tag}>`));
  return m ? m[1].trim() : "";
}
