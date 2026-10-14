/**
 * Файловое хранилище на Supabase Storage — фотографии товаров и накладных.
 *
 * Бакет приватный: читать можно только через наш роут с проверкой роли,
 * прямая ссылка из браузера ничего не отдаст. Поэтому нужен сервисный ключ —
 * анонимный не имеет права ни создать бакет, ни залить в приватный объект.
 */

import { updateActionDetails } from "./supabase.js";

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

// ---------------------------------------------------------------------------
// Хранилище как перевалочный пункт
//
// Бакет держит снимок ровно до тех пор, пока его не принял Telegram: ссылка
// на файл нужна самому Telegram, чтобы его скачать. Как только пришла
// расписка (`file_id`) — файл из бакета удаляется, а показываем мы его потом
// обратно из Telegram. Иначе гигабайт набирается за два месяца.
// ---------------------------------------------------------------------------

/**
 * Проставляет распискам место в `details` и говорит, какие файлы можно убрать.
 * Чистая функция: ничего не удаляет и в базу не ходит.
 */
export function applyDelivery(details, delivered) {
  const byPath = new Map((delivered || []).map((d) => [d.path, d]));
  const photos = details?.photos || [];

  const purgePaths = [];
  const nextPhotos = photos.map((p) => {
    const d = p.path ? byPath.get(p.path) : null;
    if (!d) return p;
    purgePaths.push(p.path);
    // Путь затираем: файла по нему больше нет, и попытка открыть его
    // должна сразу вести в Telegram, а не в 404.
    return {
      ...p,
      path: "",
      storage_path: p.path,
      tg_chat_id: d.chat_id,
      tg_message_id: d.message_id,
      tg_file_id: d.file_id,
    };
  });

  const pending = nextPhotos.filter((p) => p.path).length;

  return {
    details: {
      ...details,
      photos: nextPhotos,
      photos_in_telegram: pending === 0,
      photos_purged_at: purgePaths.length > 0 ? new Date().toISOString() : details?.photos_purged_at || null,
    },
    purgePaths,
    pending,
  };
}

/**
 * Удаляет из бакета всё, что Telegram подтвердил, и переписывает запись.
 * Файлы без расписки остаются лежать — их заберёт ночная уборка, когда
 * отчёт переотправят.
 */
export async function purgeDeliveredPhotos(actionId, details, delivered) {
  const { details: nextDetails, purgePaths, pending } = applyDelivery(details, delivered);
  if (purgePaths.length === 0) return { deleted: 0, pending };

  const ok = await deleteInvoiceFiles(purgePaths);
  if (!ok) return { deleted: 0, pending, error: "не удалось удалить файлы" };

  await updateActionDetails(actionId, nextDetails);

  return { deleted: purgePaths.length, pending };
}

/** Перечисляет объекты бакета по префиксу. Папка — запись с `id: null`. */
async function listBucketEntries(prefix = "", limit = 100, offset = 0) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${INVOICE_BUCKET}`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ prefix, limit, offset, sortBy: { column: "name", order: "asc" } }),
  });
  if (!res.ok) {
    console.error("[storage] list:", prefix, res.status, await res.text());
    return [];
  }
  return (await res.json()) || [];
}

/**
 * Выносит из бакета всё подчистую.
 *
 * Разовая операция: снимки августа–сентября в рабочей группе уже лежат, а в
 * хранилище занимают гигабайт. Сами записи о приходах не трогаем — пропадают
 * только файлы, и в карточке об этом остаётся отметка.
 */
export async function purgeBucket() {
  if (!storageConfigured()) {
    return { error: "Хранилище не настроено: нет SUPABASE_SERVICE_KEY" };
  }

  let deleted = 0;
  let failed = 0;
  const done = new Set();

  // Опустевшая папка пропадает из выдачи, поэтому смещение не двигаем, а
  // ведём список уже обработанных: обход кончается, когда новых не осталось.
  while (true) {
    const batch = await listBucketEntries("", 100, 0);
    const fresh = batch.map((e) => e?.name).filter((n) => n && !done.has(n));
    if (fresh.length === 0) break;

    for (const name of fresh) {
      done.add(name);

      while (true) {
        const files = await listBucketEntries(`${name}/`, 100, 0);
        const paths = files.filter((f) => f?.name).map((f) => `${name}/${f.name}`);
        if (paths.length === 0) break;

        if (!(await deleteInvoiceFiles(paths))) {
          // Иначе та же сотня возвращалась бы бесконечно.
          failed += paths.length;
          break;
        }
        deleted += paths.length;
      }
    }
  }

  return { success: true, folders: done.size, deleted, failed };
}

/**
 * Ночная уборка: подчищает хвосты.
 *
 * Обычно файл удаляется сразу после отправки, прямо в роуте прихода. Сюда
 * попадает то, что тогда не удалось: Telegram ответил ошибкой, бакет не дал
 * удалить, приход вообще не сохранился. Удаляем только снимки с распиской —
 * то, чего в Telegram нет, остаётся лежать.
 */
export async function sweepDeliveredPhotos({ days = 0, force = false } = {}) {
  if (!storageConfigured()) {
    return { error: "Хранилище не настроено: нет SUPABASE_SERVICE_KEY" };
  }

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  let scanned = 0;
  let deleted = 0;
  let touched = 0;
  let offset = 0;

  while (true) {
    const url =
      `${SUPABASE_URL}/rest/v1/bot_actions?action_type=eq.invoice` +
      `&created_at=lt.${encodeURIComponent(cutoff)}` +
      `&select=id,created_at,details&order=created_at.asc&limit=200&offset=${offset}`;
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) {
      console.error("[storage] sweep lookup:", res.status, await res.text());
      break;
    }
    const rows = await res.json();
    if (!rows || rows.length === 0) break;

    for (const row of rows) {
      scanned++;
      const photos = row.details?.photos || [];
      const live = photos.filter((p) => p.path);
      if (live.length === 0) continue;

      // force — разовая зачистка старья: сносим, даже если расписки нет.
      const paths = force ? live.map((p) => p.path) : live.filter((p) => p.tg_file_id).map((p) => p.path);
      if (paths.length === 0) continue;

      const ok = await deleteInvoiceFiles(paths);
      if (!ok) continue;
      deleted += paths.length;

      const gone = new Set(paths);
      const nextPhotos = photos.map((p) =>
        gone.has(p.path) ? { ...p, path: "", storage_path: p.path } : p
      );
      await updateActionDetails(row.id, {
        ...row.details,
        photos: nextPhotos,
        photos_purged_at: new Date().toISOString(),
      });
      touched++;
    }

    if (rows.length < 200) break;
    offset += 200;
  }

  return { success: true, scanned, deleted, touched, days, force };
}

