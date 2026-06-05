export const dynamic = "force-dynamic";
import { withIikoSession, iikoGetRaw } from "@/lib/iiko";

const FALLBACK = [
  { id: "1239d270-1bbe-f64f-b7ea-5f00518ef508", name: "Основной склад" },
  { id: "6be6e519-c4d8-4461-9333-7810062486ed", name: "Кухня" },
  { id: "c1a132f0-5a33-4f0b-a47b-5b6d8f381c9f", name: "Бар" },
  { id: "6da08473-087b-4efb-ad9e-ba14e8999fae", name: "Мойка" },
  { id: "0cf0f2c5-891c-412c-8ab7-7b2bacdd2b01", name: "Посуда" },
  { id: "9101f69e-ab51-44b6-8c1a-f80e84d8eec3", name: "Хоз товары" },
  {
    id: "2e9688bb-5130-4188-94a5-7a850e1d9f55",
    name: "Кухня Заготовки(смесь)",
  },
];

export async function GET() {
  try {
    const stores = await withIikoSession(async (token) => {
      const xml = await iikoGetRaw("corporation/stores", token);
      if (!xml) return FALLBACK;

      // XML структура: <corporateItemDtoes><corporateItemDto><id>...</id><name>...</name>...
      const results = [];
      const regex = /<corporateItemDto>([\s\S]*?)<\/corporateItemDto>/g;
      let match;
      while ((match = regex.exec(xml)) !== null) {
        const block = match[1];
        const id = tag(block, "id");
        const name = tag(block, "name");
        const type = tag(block, "type");
        if (id && name && type === "STORE") {
          results.push({ id, name });
        }
      }

      return results.length > 0 ? results : FALLBACK;
    });

    return Response.json(stores);
  } catch (e) {
    console.error("[/api/iiko/stores]", e.message);
    return Response.json(FALLBACK);
  }
}

function tag(xml, name) {
  const m = xml.match(new RegExp(`<${name}>([^<]*)</${name}>`));
  return m ? m[1].trim() : "";
}
