import { uploadInvoiceFile, downloadInvoiceFile, storageConfigured } from "@/lib/storage";

export const dynamic = "force-dynamic";

// Загружают те же, кто оформляет приход; смотрит — только админ.
const UPLOAD_ROLES = ["admin", "supplier"];
const VIEW_ROLES = ["admin"];

const MAX_BYTES = 12 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];

// draft/файл — только безопасные символы, чтобы нельзя было выйти из бакета
const SAFE_PATH = /^[A-Za-z0-9_-]{6,64}\/[A-Za-z0-9._-]{1,120}$/;

function extFor(type) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/heic") return "heic";
  if (type === "application/pdf") return "pdf";
  return "jpg";
}

/** Загрузка фотографии товара или накладной. Файл кладём в папку черновика. */
export async function POST(request) {
  try {
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role") || "";
    const [baseRole] = userRole.split(":");

    if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!UPLOAD_ROLES.includes(baseRole)) {
      return Response.json({ error: "Доступ запрещен для вашей роли" }, { status: 403 });
    }

    if (!storageConfigured()) {
      return Response.json(
        { error: "Хранилище фотографий не настроено: нет SUPABASE_SERVICE_KEY" },
        { status: 503 }
      );
    }

    const form = await request.formData();
    const file = form.get("file");
    const draftId = String(form.get("draft_id") || "").replace(/[^A-Za-z0-9_-]/g, "");
    const kind = form.get("kind") === "invoice" ? "invoice" : "item";

    if (!file || typeof file.arrayBuffer !== "function") {
      return Response.json({ error: "Файл не передан" }, { status: 400 });
    }
    if (draftId.length < 6) {
      return Response.json({ error: "Некорректный идентификатор черновика" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return Response.json({ error: "Файл больше 12 МБ" }, { status: 400 });
    }

    const type = file.type || "image/jpeg";
    if (!ALLOWED_TYPES.includes(type)) {
      return Response.json({ error: "Поддерживаются только изображения и PDF" }, { status: 400 });
    }

    const name = `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extFor(type)}`;
    const path = `${draftId}/${name}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadInvoiceFile(path, buffer, type);
    if (result.error) {
      return Response.json({ error: result.error }, { status: 502 });
    }

    return Response.json({
      success: true,
      photo: { path, kind, size: file.size, content_type: type },
    });
  } catch (e) {
    console.error("[/api/iiko/invoice/photos POST]", e.message);
    return Response.json({ error: "Не удалось загрузить фотографию" }, { status: 500 });
  }
}

/** Отдаёт саму картинку. Бакет приватный, поэтому только через этот роут. */
export async function GET(request) {
  try {
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role") || "";
    const [baseRole] = userRole.split(":");

    if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!VIEW_ROLES.includes(baseRole)) {
      return Response.json({ error: "Просмотр фотографий доступен администратору" }, { status: 403 });
    }

    const path = new URL(request.url).searchParams.get("path") || "";
    if (!SAFE_PATH.test(path)) {
      return Response.json({ error: "Некорректный путь" }, { status: 400 });
    }

    const file = await downloadInvoiceFile(path);
    if (!file) return Response.json({ error: "Файл не найден" }, { status: 404 });

    return new Response(file.body, {
      headers: {
        "Content-Type": file.contentType,
        ...(file.contentLength ? { "Content-Length": file.contentLength } : {}),
        // приватный документ: кэшируем только в браузере пользователя
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    console.error("[/api/iiko/invoice/photos GET]", e.message);
    return Response.json({ error: "Не удалось открыть фотографию" }, { status: 500 });
  }
}
