/**
 * POST /api/iiko/transfer
 *
 * Mirrors bot.py import_transfer():
 *   Uses iikoWeb API to create INTERNAL_TRANSFER
 *   auth → create DRAFT → load → save as PROCESSED
 *
 * Body: {
 *   store_from: "UUID" (usually MAIN_STORE_ID),
 *   store_to: "UUID" (Кухня or Бар),
 *   items: [{product_id, quantity}],
 *   comment: "optional"
 * }
 */

import { createTransfer } from "@/lib/iiko-web";

export async function POST(request) {
  try {
    const { store_from, store_to, items, comment } = await request.json();

    if (!store_from || !store_to || !items?.length) {
      return Response.json({ error: "Missing store_from, store_to or items" }, { status: 400 });
    }

    const result = await createTransfer(store_from, store_to, items, comment || "");

    if (result.success) {
      return Response.json({ success: true, documentNumber: result.documentNumber });
    } else {
      return Response.json({ success: false, error: result.error }, { status: 500 });
    }
  } catch (e) {
    console.error("[/api/iiko/transfer]", e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
