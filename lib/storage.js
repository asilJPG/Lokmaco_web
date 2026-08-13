/**
 * Файловое хранилище на Supabase Storage — фотографии товаров и накладных.
 *
 * Бакет приватный: читать можно только через наш роут с проверкой роли,
 * прямая ссылка из браузера ничего не отдаст. Поэтому нужен сервисный ключ —
 * анонимный не имеет права ни создать бакет, ни залить в приватный объект.
 */

const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const STORAGE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || "";

export const INVOICE_BUCKET = "invoice-photos";

export function storageConfigured() {
  return Boolean(SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);
}

function authHeaders(extra = {}) {
  return {
    apikey: STORAGE_KEY,
    Authorization: `Bearer ${STORAGE_KEY}`,
    ...extra,
  };
}

let bucketChecked = false;

/** Создаёт бакет при первом обращении. Повторные вызовы бесплатны. */
export async function ensureInvoiceBucket() {
  if (bucketChecked) return true;

  const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      id: INVOICE_BUCKET,
      name: INVOICE_BUCKET,
      public: false,
      file_size_limit: 15 * 1024 * 1024,
      allowed_mime_types: ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"],
    }),
  });

  if (res.ok) {
    bucketChecked = true;
    return true;
  }

  const text = await res.text();
  // Бакет уже есть — это не ошибка
  if (res.status === 409 || /already exists|Duplicate/i.test(text)) {
    bucketChecked = true;
    return true;
  }

  console.error("[storage] ensureInvoiceBucket:", res.status, text);
  return false;
}

/** Загружает файл. path — относительный путь внутри бакета. */
export async function uploadInvoiceFile(path, body, contentType) {
  const ok = await ensureInvoiceBucket();
  if (!ok) return { error: "Хранилище недоступно" };

  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${INVOICE_BUCKET}/${encodeURI(path)}`,
    {
      method: "POST",
      headers: authHeaders({
        "Content-Type": contentType || "application/octet-stream",
        "x-upsert": "true",
        "Cache-Control": "31536000",
      }),
      body,
    }
  );

  if (!res.ok) {
    const text = await res.text();
    console.error("[storage] upload:", res.status, text);
    return { error: `Не удалось сохранить файл (${res.status})` };
  }

  return { path };
}

/**
 * Временная ссылка на приватный файл. Нужна, чтобы Telegram скачал картинку
 * сам: гонять байты через наш сервер дороже и ломается тише — при любой
 * осечке отчёт молча уходил без фотографий.
 */
export async function createSignedUrl(path, expiresIn = 3600) {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/storage/v1/object/sign/${INVOICE_BUCKET}/${encodeURI(path)}`,
      {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ expiresIn }),
      }
    );
    if (!res.ok) {
      console.error("[storage] createSignedUrl:", path, res.status, await res.text());
      return null;
    }
    const data = await res.json();
    // приходит относительный /object/sign/...
    return data?.signedURL ? `${SUPABASE_URL}/storage/v1${data.signedURL}` : null;
  } catch (e) {
    console.error("[storage] createSignedUrl:", path, e.message);
    return null;
  }
}

/** Отдаёт содержимое файла. Вызывающий обязан сам проверить права. */
export async function downloadInvoiceFile(path) {
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${INVOICE_BUCKET}/${encodeURI(path)}`,
    { headers: authHeaders() }
  );

  if (!res.ok) {
    console.error("[storage] downloadInvoiceFile:", path, res.status, await res.text());
    return null;
  }
  return {
    body: res.body,
    contentType: res.headers.get("content-type") || "application/octet-stream",
    contentLength: res.headers.get("content-length"),
  };
}

export async function deleteInvoiceFile(path) {
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${INVOICE_BUCKET}/${encodeURI(path)}`,
    { method: "DELETE", headers: authHeaders() }
  );
  return res.ok;
}
