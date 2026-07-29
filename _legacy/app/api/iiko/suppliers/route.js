export const dynamic = "force-dynamic";
import { withIikoSession, iikoGetRaw } from "@/lib/iiko";
import { parseStringPromise } from "xml2js";

const ALLOWED = new Set([
  "16c6e655-945c-4002-a117-934749aea133",
  "3bdcfdbb-e66c-4b16-9025-03dedb7905fa",
  "4268b082-79b2-4df6-8335-4b6b2e610f37",
]);

// Рекурсивно ищем объекты с id из ALLOWED_SUPPLIERS
function findSuppliers(obj, results = []) {
  if (!obj || typeof obj !== "object") return results;
  if (Array.isArray(obj)) {
    for (const item of obj) findSuppliers(item, results);
    return results;
  }
  const id = Array.isArray(obj.id) ? obj.id[0] : obj.id;
  const name = Array.isArray(obj.name) ? obj.name[0] : obj.name;
  const supplier = Array.isArray(obj.supplier) ? obj.supplier[0] : obj.supplier;
  const deleted = Array.isArray(obj.deleted) ? obj.deleted[0] : obj.deleted;

  if (id && name && typeof id === "string") {
    // Если есть поля supplier/deleted — фильтруем как в боте
    const supplierOk = !supplier || supplier === "true";
    const deletedOk = !deleted || deleted === "false";
    if (
      supplierOk &&
      deletedOk &&
      ALLOWED.has(id.trim()) &&
      !results.find((r) => r.id === id.trim())
    ) {
      results.push({
        id: id.trim(),
        name: (typeof name === "string" ? name : name[0]).trim(),
      });
    }
  }

  for (const key of Object.keys(obj)) {
    findSuppliers(obj[key], results);
  }
  return results;
}

export async function GET() {
  try {
    const suppliers = await withIikoSession(async (token) => {
      const xml = await iikoGetRaw("suppliers", token);
      if (!xml) {
        return [];
      }


      try {
        const parsed = await parseStringPromise(xml, {
          explicitArray: true,
          ignoreAttrs: false,
        });

        const results = findSuppliers(parsed);
        return results;
      } catch (parseErr) {
        console.error("[suppliers] xml2js error:", parseErr.message);
        return [];
      }
    });

    return Response.json(suppliers);
  } catch (e) {
    console.error("[/api/iiko/suppliers]", e.message);
    return Response.json([]);
  }
}
