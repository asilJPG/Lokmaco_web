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

/** Удаляет пачку файлов из бакета (до 100 за раз). */
export async function deleteInvoiceFiles(paths) {
  if (!paths || paths.length === 0) return true;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/storage/v1/object/${INVOICE_BUCKET}`,
      {
        method: "DELETE",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ prefixes: paths }),
      }
    );
    if (!res.ok) {
      console.error("[storage] deleteInvoiceFiles failed:", res.status, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error("[storage] deleteInvoiceFiles error:", e.message);
    return false;
  }
}

/**
 * Очищает файлы фотографий из хранилища для приходов старше `days` дней.
 * Сами записи о приходах в базе данных остаются нетронутыми.
 */
export async function cleanupOldInvoicePhotos(days = 30) {
  if (!SUPABASE_URL || !STORAGE_KEY) {
    return { error: "Хранилище не настроено" };
  }

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  let totalDeleted = 0;
  let totalBytes = 0;
  let offset = 0;
  const limit = 500;

  while (true) {
    const url = `${SUPABASE_URL}/rest/v1/bot_actions?action_type=eq.invoice&created_at=lt.${encodeURIComponent(cutoff)}&select=id,created_at,details&order=created_at.asc&limit=${limit}&offset=${offset}`;
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) {
      console.error("[storage] cleanup lookup failed:", res.status, await res.text());
      break;
    }
    const rows = await res.json();
    if (!rows || rows.length === 0) break;

    const pathsToDelete = [];
    for (const r of rows) {
      const photos = r.details?.photos || [];
      for (const p of photos) {
        if (p.path) {
          pathsToDelete.push(p.path);
          totalBytes += Number(p.size) || 0;
        }
      }
    }

    if (pathsToDelete.length > 0) {
      for (let i = 0; i < pathsToDelete.length; i += 100) {
        const batch = pathsToDelete.slice(i, i + 100);
        const ok = await deleteInvoiceFiles(batch);
        if (ok) totalDeleted += batch.length;
      }
    }

    if (rows.length < limit) break;
    offset += limit;
  }

  return {
    success: true,
    deletedCount: totalDeleted,
    freedBytes: totalBytes,
    freedMB: +(totalBytes / 1024 / 1024).toFixed(1),
    days,
  };
}
