import { gzipSync } from "zlib";

/**
 * Ночная выгрузка базы в Telegram.
 *
 * На бесплатном тарифе Supabase внятного окна восстановления нет — сам
 * Supabase советует бесплатным проектам регулярно выгружать данные и держать
 * копию на стороне. Здесь это и сделано: раз в сутки вся база уходит одним
 * gzip-файлом в закрытый канал, где её никто не удалит вместе с проектом.
 *
 * Это копия данных, а не схемы: таблицы, индексы и права восстанавливать
 * придётся руками. Для нашей задачи этого достаточно — схема лежит в
 * `supabase/migrations` и в `context.md`, а невосстановимы только сами
 * записи кассы, зарплат и прихода.
 */

const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_KEY = process.env.SUPABASE_KEY || "";

const TG_TOKEN = process.env.TG_BOT_TOKEN || "";

// По умолчанию копия ложится в тот же закрытый канал, что и оригиналы
// снимков: бот там уже сидит, а посторонних нет. Отдельный
// `TG_BACKUP_CHAT_ID` нужен, только если копии захочется развести.
const TG_BACKUP_CHAT_ID = String(
  process.env.TG_BACKUP_CHAT_ID || process.env.TG_ARCHIVE_CHAT_ID || ""
)
  .trim()
  .replace(/^["']|["']$/g, "");

const TABLES = [
  "bot_actions",
  "bot_users",
  "cash_reports",
  "pending_transfers",
  "assets",
  "asset_tags",
  "asset_locations",
  "user_passkeys",
];

/**
 * Поля, которые в выгрузку не попадают.
 *
 * Код входа — это пароль сотрудника, а Telegram не сейф: файл увидит любой,
 * кто попадёт в канал, и останется он там навсегда. При восстановлении коды
 * проще раздать заново, чем объяснять их утечку.
 */
const REDACT = {
  bot_users: ["access_code"],
};

const PAGE = 1000;

function headers(extra = {}) {
  return {
    "Content-Type": "application/json",
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    ...extra,
  };
}

/** Читает таблицу целиком, страницами: разом PostgREST больше тысячи не отдаст. */
async function fetchTable(table) {
  const rows = [];
  let offset = 0;

  while (true) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=*&limit=${PAGE}&offset=${offset}`;
    const res = await fetch(url, { headers: headers() });
    if (!res.ok) {
      throw new Error(`${table}: ${res.status} ${await res.text()}`);
    }
    const batch = await res.json();
    if (!batch || batch.length === 0) break;

    const hidden = REDACT[table] || [];
    for (const row of batch) {
      for (const field of hidden) delete row[field];
      rows.push(row);
    }

    if (batch.length < PAGE) break;
    offset += PAGE;
  }

  return rows;
}

/** Собирает выгрузку всех таблиц в один сжатый файл. */
export async function buildBackup() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("Supabase не настроен");
  }

  const tables = {};
  const counts = {};
  const failed = [];

  for (const table of TABLES) {
    try {
      const rows = await fetchTable(table);
      tables[table] = rows;
      counts[table] = rows.length;
    } catch (e) {
      // Одна недоступная таблица не должна отменять выгрузку остальных —
      // лучше неполная копия, чем никакой.
      console.error("[backup]", e.message);
      failed.push(table);
    }
  }

  const payload = {
    generated_at: new Date().toISOString(),
    source: SUPABASE_URL,
    redacted: REDACT,
    counts,
    failed,
    tables,
  };

  const gz = gzipSync(Buffer.from(JSON.stringify(payload)), { level: 9 });
  const total = Object.values(counts).reduce((s, n) => s + n, 0);

  return { gz, counts, failed, total };
}

function pad(n) {
  return String(n).padStart(2, "0");
}

/** Имя файла по ташкентской дате: в Фергане ночь, а в UTC ещё вчерашний день. */
function backupName(now = new Date()) {
  const d = new Date(now.getTime() + 5 * 60 * 60 * 1000);
  return `lokmaco-${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}.json.gz`;
}

/**
 * Собирает выгрузку и кладёт её файлом в закрытый канал.
 *
 * Канал обязателен и должен быть закрытым: выгрузка содержит кассу, зарплаты
 * и весь журнал, в рабочую группу такому не место.
 */
export async function sendBackup() {
  if (!TG_TOKEN) return { error: "Не задан TG_BOT_TOKEN" };
  if (!TG_BACKUP_CHAT_ID) {
    return { error: "Некуда слать: нет ни TG_BACKUP_CHAT_ID, ни TG_ARCHIVE_CHAT_ID" };
  }

  const { gz, counts, failed, total } = await buildBackup();

  // У бота потолок 50 МБ на документ. Наша база на порядок меньше, но если
  // когда-нибудь дорастёт — лучше увидеть внятную ошибку, чем молчание.
  if (gz.length > 49 * 1024 * 1024) {
    return { error: `Файл ${(gz.length / 1048576).toFixed(1)} МБ — больше лимита Telegram` };
  }

  const name = backupName();
  const lines = [
    "💾 <b>Резервная копия базы</b>",
    name,
    `${total.toLocaleString("ru-RU")} записей · ${(gz.length / 1024).toFixed(0)} КБ`,
    "",
    ...Object.entries(counts).map(([t, n]) => `• ${t} — ${n.toLocaleString("ru-RU")}`),
  ];
  if (failed.length > 0) lines.push("", `⚠️ не выгрузились: ${failed.join(", ")}`);
  lines.push("", "<i>Коды входа сотрудников в копию не включены.</i>");

  const form = new FormData();
  form.append("chat_id", TG_BACKUP_CHAT_ID);
  form.append("caption", lines.join("\n"));
  form.append("parse_mode", "HTML");
  form.append("document", new Blob([gz], { type: "application/gzip" }), name);

  const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendDocument`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    const botId = String(TG_TOKEN).split(":")[0] || "?";
    console.error(`[backup] sendDocument: бот ${botId} → чат ${TG_BACKUP_CHAT_ID}:`, res.status, text);
    return { error: `Telegram отказал (${res.status})`, counts, bytes: gz.length };
  }

  return { success: true, file: name, bytes: gz.length, total, counts, failed };
}
