/**
 * Ночной отчёт — порт из Python-бота (`bot_lokmaco/bot.py`, `send_nightly_report`).
 *
 * Формат сообщений повторён один в один: владелец читает этот отчёт каждый день,
 * и менять вёрстку при переезде было нельзя.
 *
 * Бот при этом больше не нужен как процесс: Telegram не требует запущенного
 * приложения, чтобы принимать отправку — нужен только токен.
 */
import { withIikoSession, http1Fetch } from "./iiko.js";

const IIKO_SERVER = (process.env.IIKO_SERVER || "").replace(/\/+$/, "");
const BRANCH = "Lokmaco г.Фергана тц Festival";

// iiko под нагрузкой отвечает «HTTP Client says - Request timeout error»: её
// движок отчётов не успевает. Ночью это регулярно, потому что параллельно идут
// регламентные задачи закрытия дня. Поэтому повторяем, а не сдаёмся сразу.
const RETRIES = 3;
const RETRY_DELAY_MS = 45_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const fmt = (n) =>
  new Intl.NumberFormat("ru-RU").format(Math.round(Number(n) || 0)).replace(/ /g, " ");

const num = (v) => Number(v) || 0;

async function olap(token, groupBy, aggregates, day) {
  const res = await http1Fetch(`${IIKO_SERVER}/resto/api/v2/reports/olap`, {
    method: "POST",
    headers: { Cookie: `key=${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      reportType: "SALES",
      buildSummary: "true",
      groupByRowFields: groupBy,
      groupByColFields: [],
      aggregateFields: aggregates,
      filters: {
        "OpenDate.Typed": {
          filterType: "DateRange",
          periodType: "CUSTOM",
          from: day,
          to: day,
          includeLow: "true",
          includeHigh: "true",
        },
        DeletedWithWriteoff: {
          filterType: "ExcludeValues",
          values: ["DELETED_WITHOUT_WRITEOFF"],
        },
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`OLAP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const json = await res.json();
  return json?.data || [];
}

/** Раскладка выручки по местам приготовления — как в боте. */
function splitByCookingPlace(rows) {
  let kitchenMain = 0;
  let kitchenBasement = 0;
  let bar = 0;

  for (const row of rows || []) {
    const amount = Math.abs(num(row["DishDiscountSumInt"]));
    const place = String(row["CookingPlace"] || "").toLowerCase();
    if (place.includes("бар") || place.includes("bar")) bar += amount;
    else if (
      place.includes("горячий цех") ||
      place.includes("холодный цех") ||
      place.includes("пицца")
    ) {
      kitchenBasement += amount;
    } else kitchenMain += amount;
  }
  return { kitchenMain, kitchenBasement, bar };
}

function buildCashMessage({ payTypes, summary, cookingPlaces, dateLabel }) {
  const lines = [`📊 <b>Касса (${BRANCH}) за ${dateLabel}</b>`, ""];

  let rev = 0;
  let orders = 0;
  let guests = 0;
  for (const r of summary || []) {
    rev += num(r["DishDiscountSumInt"]);
    orders += Math.trunc(num(r["UniqOrderId.OrdersCount"]));
    guests += Math.trunc(num(r["GuestNum"]));
  }
  const avg = orders ? rev / orders : 0;

  lines.push(
    `💰 Выручка: <b>${fmt(rev)} сум</b>`,
    `🧾 Чеков: <b>${orders}</b>`,
    `📈 Средний чек: <b>${fmt(avg)} сум</b>`
  );
  if (guests) lines.push(`👥 Гостей: <b>${guests}</b>`);

  if (cookingPlaces) {
    const { kitchenMain, kitchenBasement, bar } = splitByCookingPlace(cookingPlaces);
    const pct = (v) => (rev ? Math.round((v / rev) * 100) : 0);
    lines.push(
      "",
      `🍳 Кухня главная: <b>${fmt(kitchenMain)} сум</b> (${pct(kitchenMain)}%)`,
      `🍕 Кухня подвал: <b>${fmt(kitchenBasement)} сум</b> (${pct(kitchenBasement)}%)`,
      `🍹 Бар: <b>${fmt(bar)} сум</b> (${pct(bar)}%)`
    );
  }

  if (payTypes?.length) {
    lines.push("", "<b>По типам оплат:</b>");
    const sorted = payTypes
      .map((r) => [String(r["PayTypes"] || "?"), num(r["DishDiscountSumInt"])])
      .sort((a, b) => b[1] - a[1]);
    for (const [name, sum] of sorted) {
      if (sum > 0) {
        const icon = name.toLowerCase().includes("нал") ? "💵" : "💳";
        lines.push(`  ${icon} ${name}: ${fmt(sum)} сум`);
      }
    }
  }

  return lines.join("\n");
}

function buildTopMessage({ dishes, dateLabel }) {
  const head = [`🍽 <b>Топ продаж за ${dateLabel}</b>`, ""];
  if (!dishes?.length) return [...head, "<i>Нет данных</i>"].join("\n");

  const byCategory = new Map();
  for (const r of dishes) {
    const cat = r["DishCategory"] || "?";
    const amount = num(r["DishAmountInt"]);
    const sum = num(r["DishDiscountSumInt"]);
    if (amount <= 0) continue;
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat).push({ name: r["DishName"] || "—", amount, sum });
  }

  const lines = [...head];
  const cats = [...byCategory.entries()].sort(
    (a, b) =>
      b[1].reduce((s, d) => s + d.sum, 0) - a[1].reduce((s, d) => s + d.sum, 0)
  );

  for (const [cat, list] of cats) {
    list.sort((a, b) => b.sum - a.sum);
    lines.push(`📂 <b>${cat}</b>  (${fmt(list.reduce((s, d) => s + d.sum, 0))} сум)`);
    list.slice(0, 3).forEach((d, i) => {
      lines.push(`  ${["🥇", "🥈", "🥉"][i]} ${d.name} — ${Math.trunc(d.amount)} шт, ${fmt(d.sum)} сум`);
    });
    lines.push("");
  }

  return lines.join("\n");
}

/** Вчерашний день по Ташкенту: отчёт всегда про уже закрытые сутки. */
export function yesterdayTashkent() {
  const now = new Date(Date.now() + 5 * 60 * 60 * 1000);
  now.setUTCDate(now.getUTCDate() - 1);
  const iso = now.toISOString().slice(0, 10);
  const [y, m, d] = iso.split("-");
  return { iso, label: `${d}.${m}.${y}` };
}

async function collect(day) {
  return withIikoSession(async (token) => {
    const [payTypes, summary, dishes, cookingPlaces] = await Promise.all([
      olap(token, ["PayTypes"], ["DishDiscountSumInt", "OrderNum", "UniqOrderId.OrdersCount"], day),
      olap(token, [], ["DishDiscountSumInt", "OrderNum", "UniqOrderId.OrdersCount", "GuestNum"], day),
      olap(token, ["DishCategory", "DishName"], ["DishAmountInt", "DishDiscountSumInt"], day),
      olap(token, ["CookingPlace"], ["DishDiscountSumInt"], day),
    ]);
    return { payTypes, summary, dishes, cookingPlaces };
  });
}

/**
 * Собирает отчёт за вчера. Возвращает два сообщения — касса и топ продаж:
 * вместе они регулярно перебивают лимит Telegram в 4096 символов.
 */
export async function buildNightlyReport() {
  const { iso, label } = yesterdayTashkent();

  let lastError = null;
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const data = await collect(iso);
      return {
        date: iso,
        cash: buildCashMessage({ ...data, dateLabel: label }),
        top: buildTopMessage({ dishes: data.dishes, dateLabel: label }),
        attempts: attempt,
      };
    } catch (e) {
      lastError = e;
      console.error(`[nightly] попытка ${attempt}/${RETRIES}:`, e.message);
      if (attempt < RETRIES) await sleep(RETRY_DELAY_MS);
    }
  }

  throw lastError || new Error("Не удалось собрать отчёт");
}
