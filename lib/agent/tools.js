/**
 * Определения инструментов агента + диспетчер.
 *
 * Описания намеренно прескриптивные («вызывай, когда…») — это заметно повышает
 * точность выбора инструмента по сравнению с описаниями «что делает».
 */
import {
  avgCheckByPlace,
  guestsPerDay,
  turnover,
  dailyRevenue,
  topDishes,
  expensesBreakdown,
  verifyExpenseAccount,
  rawOlap,
} from "./skills.js";

const dateRange = {
  from: { type: "string", description: "Начало периода включительно, YYYY-MM-DD" },
  to: {
    type: "string",
    description:
      "Конец периода, YYYY-MM-DD. Граница НЕ включается (includeHigh=false), " +
      "поэтому для «весь июнь» передавай to=2026-07-01, а не 2026-06-30.",
  },
};

export const TOOLS = [
  {
    name: "avg_check_by_place",
    description:
      "Вызывай при вопросах про средний чек, наценку, маржу или food cost — в целом или " +
      "по направлениям (Кухня / Бар / Мороженое). Возвращает по каждому направлению: чеки, " +
      "выручку, средний чек, блюд на чек, food cost %, наценку %, маржу %, долю в выручке.",
    input_schema: {
      type: "object",
      properties: { ...dateRange },
      required: ["from", "to"],
    },
  },
  {
    name: "guests_per_day",
    description:
      "Вызывай при вопросах про гостей, трафик, посещаемость или загрузку по дням. " +
      "Возвращает минимум / медиану / среднее / пик по столам за день. ВНИМАНИЕ: это " +
      "количество столов (чеков), а не живых людей — обязательно предупреди об этом.",
    input_schema: {
      type: "object",
      properties: { ...dateRange },
      required: ["from", "to"],
    },
  },
  {
    name: "turnover",
    description:
      "Вызывай при вопросах про оборачиваемость посадочных мест, загрузку зала или выручку " +
      "на место. Считает от 51 посадочного места и 13 рабочих часов.",
    input_schema: {
      type: "object",
      properties: { ...dateRange },
      required: ["from", "to"],
    },
  },
  {
    name: "daily_revenue",
    description:
      "Вызывай при вопросах про выручку по дням, динамику, сравнение периодов, поиск " +
      "лучшего или худшего дня, «просела ли касса». Возвращает построчно по дням: столы, " +
      "блюда, выручку, средний чек.",
    input_schema: {
      type: "object",
      properties: { ...dateRange },
      required: ["from", "to"],
    },
  },
  {
    name: "top_dishes",
    description:
      "Вызывай при вопросах про топ блюд, что лучше или хуже продаётся, хиты меню. " +
      "Возвращает два рейтинга — по выручке и по количеству.",
    input_schema: {
      type: "object",
      properties: {
        ...dateRange,
        limit: { type: "integer", description: "Сколько позиций в каждом рейтинге, по умолчанию 20" },
      },
      required: ["from", "to"],
    },
  },
  {
    name: "expenses_breakdown",
    description:
      "Вызывай при вопросах про расходы, затраты, P&L, прибыль, «сколько потратили на X». " +
      "Разбивает по типам счетов (INCOME / COST_OF_GOODS_SOLD / EXPENSES / OTHER_EXPENSES) " +
      "и по конкретным статьям внутри каждого типа.",
    input_schema: {
      type: "object",
      properties: { ...dateRange },
      required: ["from", "to"],
    },
  },
  {
    name: "verify_expense_account",
    description:
      "Вызывай ОБЯЗАТЕЛЬНО перед тем, как назвать владельцу финальную цифру по конкретной " +
      "статье расходов, а также всегда, когда сумма из expenses_breakdown выглядит " +
      "подозрительно. Пересчитывает статью по отдельным документам — это надёжнее агрегации. " +
      "Известный прецедент расхождения по счёту «Налог»: 45.9 млн против 70.2 млн.",
    input_schema: {
      type: "object",
      properties: {
        ...dateRange,
        account_name: {
          type: "string",
          description: "Точное название счёта как в iiko, например «Налог» или «Аренда помещение»",
        },
      },
      required: ["from", "to", "account_name"],
    },
  },
  {
    name: "raw_olap",
    description:
      "Вызывай ТОЛЬКО когда вопрос не покрывается остальными инструментами — например разрез " +
      "по официантам, по часам, по группам меню. Для типовых вопросов всегда предпочитай " +
      "готовый скилл: он даёт стабильные цифры при повторном вопросе. Дата-поле выбирается " +
      "автоматически: OpenDate.Typed для SALES, DateTime.Typed для TRANSACTIONS.",
    input_schema: {
      type: "object",
      properties: {
        report_type: { type: "string", enum: ["SALES", "TRANSACTIONS"] },
        group_by: {
          type: "array",
          items: { type: "string" },
          description:
            "Поля группировки. SALES: DishName, DishGroup, CookingPlace, WaiterName, " +
            "HourOpen, OpenDate.Typed, OrderNum. TRANSACTIONS: Account.Name, Account.Type, " +
            "Document, DateTime.Typed. НЕ используй DishCategory и OrderType — они пустые.",
        },
        aggregate_fields: {
          type: "array",
          items: { type: "string" },
          description:
            "SALES: DishDiscountSumInt (выручка), DishAmountInt (штук), " +
            "ProductCostBase.ProductCost (себестоимость). TRANSACTIONS: Sum.ResignedSum.",
        },
        ...dateRange,
        extra_filters: {
          type: "object",
          description:
            "Необязательные доп. фильтры в формате iiko OLAP, например " +
            '{"Account.Name": {"filterType": "IncludeValues", "values": ["Налог"]}}',
        },
      },
      required: ["report_type", "group_by", "aggregate_fields", "from", "to"],
    },
  },
];

const HANDLERS = {
  avg_check_by_place: avgCheckByPlace,
  guests_per_day: guestsPerDay,
  turnover,
  daily_revenue: dailyRevenue,
  top_dishes: topDishes,
  expenses_breakdown: expensesBreakdown,
  verify_expense_account: verifyExpenseAccount,
  raw_olap: rawOlap,
};

/** Человекочитаемая подпись для индикатора в UI («Смотрю выручку по дням…»). */
export const TOOL_LABELS = {
  avg_check_by_place: "Считаю средний чек и маржу",
  guests_per_day: "Считаю трафик по дням",
  turnover: "Считаю оборачиваемость мест",
  daily_revenue: "Смотрю выручку по дням",
  top_dishes: "Собираю топ блюд",
  expenses_breakdown: "Разбираю расходы по счетам",
  verify_expense_account: "Перепроверяю статью по документам",
  raw_olap: "Запрашиваю данные из iiko",
};

export async function runTool(name, input) {
  const handler = HANDLERS[name];
  if (!handler) {
    return { error: true, message: `Неизвестный инструмент: ${name}` };
  }
  try {
    return await handler(input || {});
  } catch (e) {
    console.error(`[agent] tool ${name} failed:`, e.message);
    // Ошибку отдаём как есть — агенту запрещено выдумывать данные вместо ошибки
    return { error: true, message: String(e.message || e) };
  }
}
