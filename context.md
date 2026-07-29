# Lokmaco v2

В начале каждого ответа пиши «Асиль».

**Стек**: Next.js 14 (App Router, TS strict) · Drizzle · PostgreSQL · SimpleWebAuthn · iiko XML + iikoWeb JSON.

**Локалка**: БД `lokmaco_v2` (Homebrew PG 16). `npm run dev` → `localhost:3000`. Тестовый юзер `Asil` admin, код `1234`, филиал id=1 «Fergana».

**БД (Drizzle, multi-tenant — `filial_id` везде)**:
`filials` · `users` · `user_filials` · `user_passkeys` · `bot_actions` · `cash_reports` · `pending_transfers`.

**Auth**: middleware декодирует JWT cookie → инжектит `x-user-*` headers → API-роуты читают только из них (никогда из body).

**iiko**: `lib/iiko.ts` (XML) + `lib/iiko-web.ts` (JSON) + `lib/filial-iiko.ts` (per-filial creds, шифрование AES-256-GCM с `IIKO_CRED_KEY`). Все fetch-ы шлют браузерный User-Agent (иначе iikoweb отвечает 500).

**Дизайн**: всё в `app/globals.css`, без Tailwind. Классы: `.card`, `.btn[--primary|--danger|--sm|--icon]`, `.stat-card`, `.stat-grid`, `.banner[--info|--warn|--error|--success]`, `.field`, `.input[--inline|--number]`, `.totals-row`, `.empty-state`, `.action-bar`, `.tabs/.tab`, `.nav-badge`, `.cat-grid/.cat-tile` (категории-плитки на landing-страницах разделов). Dark mode через `prefers-color-scheme`. Print-friendly.

**Навигация** (`components/nav.tsx`): на десктопе — раскрытое дерево по группам **Смена / Склад / Аналитика / Финансы / Настройки**, каждая страница в один клик. На мобильном рендерится второй `<nav>` (`.app-sidebar__nav--mobile`) с точками входа в разделы (landing-страницы с `CategoryGrid`), потому что в нижнюю панель влезает ~6 пунктов. Переключение — чисто CSS по `max-width: 768px`.
- Финансы (сейф/зарплаты/P&L) вынесены из Аналитики: это данные кассы и доступны всем, а Аналитика — только iiko и по ролям admin/director/manager.
- Аналитика — один ряд вкладок в `analytics/hub.tsx` (вкладка живёт в `?tab=`): Обзор / ОПиУ / ABC-анализ блюд / Ликвидность / Продажи по группам / Закупки / Официанты. **Явки** (`dashboard/attendance`, в группе «Смена») и **Сверка** (`dashboard/reconciliation`, в «Финансах») — отдельные страницы, обе admin-only; старые `?tab=attendance|reconciliation` редиректятся из хаба (`MOVED`).

⚠️ **iikoWeb ходит только через `lib/http1.ts`** (`iikoWebFetch`), а не через глобальный `fetch`: undici получает от этого хоста 500 на любой запрос, `node:https` — 200. Проверено: content-length, accept-encoding, connection, тело как Buffer и form-urlencoded — всё через fetch падало. iiko XML API с глобальным fetch работает нормально.

**БД в проде**: реальный Supabase (shared проект, там же чужие таблицы appointments/pipls_*/etc — не трогать). Подключение строго через **Transaction pooler** (`aws-1-ap-south-1.pooler.supabase.com:6543`), direct connection (`db.*.supabase.co:5432`) не резолвится для новых проектов. `DATABASE_URL` в `.env` (не `.env.local`). Таблица `users` в реальной БД называется `bot_users`, `tgId` — bigint. Готовится деплой на Vercel (без своего сервера).

**Перенесено из легаси в v2 (2026-07-25, через параллельных агентов)**:
- Приход накладных: `app/api/iiko/invoice`, `/parse` (AI-парсинг текста через OpenRouter), `/suppliers` + `dashboard/invoice` страница. ⚠️ `INCOMING_INVOICE` в `lib/iiko-web-docs.ts` — поля инференс по аналогии с легаси XML, НЕ проверено на реальном iikoWeb, тестировать перед продакшн-использованием.
- `app/api/iiko/employees`, `/documents/detail`, `/analytics/pl/details` — детализация P&L и документов раскрывается по клику в `iiko-analytics/client.tsx` и `documents-client.tsx`.
- Сверка касса/iiko (`dashboard/reconciliation`) и «Явки» (`dashboard/attendance`) — обе **только admin**.

⚠️ **Формула месячной сверки — ровно как в легаси, не переизобретать.** Первая версия v2 (`analytics/cash-reconciliation`, удалена) сверяла каждый тип оплаты iiko против одноимённого поля кассира и вычитала расходы из наличных iiko — модель была выдумана и давала расхождение в миллионы. Рабочая логика (`app/api/iiko/reports/monthly-cash`, порт `app/api/iiko/reports/monthly-cash/route.js` из легаси):
- iiko отдаёт **выручку за день целиком**, OLAP группируется по `OpenDate.Typed`, без разбивки по `PayTypes`;
- **«Наличные -» = `payments.cash` (фискал) + `payments.encashment` (инкассация) + `total_expenses`** — расходы, оплаченные кассиром прямо из ящика, тоже были выручкой налом;
- «Общая Сумма» = «Наличные -» + humo + uzcard + rahmat + uzum + yandex + online;
- «Разница» = Общая Сумма − продажи iiko.
Проверено на июле 2026 живыми данными: по этой формуле дневное расхождение 20–13 000 сум при обороте ~20 млн, без `total_expenses` — миллионы каждый день.
- Все 3 параллельных агента (invoice+parse+suppliers, cash-reconciliation+attendance, employees+documents-detail+pl-details) завершены, `npx tsc --noEmit` по всему проекту чистый, конфликтов на общих файлах (`iiko-analytics/client.tsx`) не было.
- ⚠️ Приход накладных (`INCOMING_INVOICE` в `lib/iiko-web-docs.ts`) — поля собраны по аналогии со старым XML-форматом, НЕ протестировано на реальном iikoWeb. Проверить перед реальным использованием.

**Перенесено из легаси (2026-07-29)** — раздел «Склад»: `dashboard/writeoff` (акт списания, XML `v2/documents/writeoff`, счёт по умолчанию «Пищевые потери» `6f983109-…`, склад берётся из роли), `dashboard/services` (услуга без товара — уходит приходной накладной с одной строкой: контрагент «Представительские», товар «Транспорт расходы», счёт затрат пишется в комментарий, потому что документ его не несёт), `dashboard/assets` (опись ОС). Раздел «Финансы»: `dashboard/tax-report` (реализация + расход сырья разворачиванием техкарт + списания, выгрузка для 1С), `dashboard/reconciliation`.

**Опись ОС** (`dashboard/assets`, admin/manager) — таблица `assets` **общая с легаси и без `filial_id`**, схема в `db/schema.ts` описана ровно по существующим колонкам, DDL не делали. Сверка при импорте из iiko идёт по инвентарному номеру (`EQ-<num>`) и по коду iiko, который лежит в `serial_number`, — колонки под iiko-id в таблице нет. QR-стикер несёт данные **текстом**, а не ссылкой, поэтому карточка `dashboard/assets/[id]` лежит внутри дашборда: публичный `/asset/[id]` из легаси ничем не открывался, и middleware трогать не пришлось.

**Аналитика меню** (`dashboard/menu-analytics`, admin/director/manager) — аналог сервиса Ресториум, но данные из iiko, а не из ручного справочника:
- Вкладка «Блюда»: food cost и наценка по каждому блюду, ABC-анализ, CSV-экспорт. Источник — OLAP SALES с полем `ProductCostBase.ProductCost` (iiko отдаёт себестоимость готовой).
- Вкладка «Цены»: закупки (суммы, поставщики), история цен, алерты, оценка экономии «закупать по лучшей своей цене». Источник — `documents/export/incomingInvoice` (все накладные с ценами одним XML-запросом, своя таблица в БД НЕ нужна) + `suppliers`.
- Главный приём, взятый у Ресториума: **каждый блок отвечает «сколько это в деньгах»**. Потенциал блюда = `выручка × (FC% − целевой FC%)`, целевой FC настраивается (20/25/30/35). ABC считается трижды — по количеству, выручке и прибыли.
- ⚠️ Два неочевидных момента в данных накладных, не сломать при правках `lib/ingredient-prices.ts`:
  1. Поле `price` в накладной — цена за **упаковку**, не за единицу (мешок муки 25кг = 220000, 50кг = 440000 при неизменных 8800/кг). Цену за базовую единицу считать только как `sum / actualAmount`.
  2. Алерты «каждая закупка против предыдущей» дают шум (клубника чередуется между двумя поставщиками 65000↔85000 → сотни ложных алертов). Правильно: один алерт на ингредиент — последняя цена против **медианы** предыдущих, сортировка по влиянию на деньги. Скачки >200% отделены в «похоже на ошибку ввода» (количество в коробках вместо штук).

**Графики**: `components/charts.tsx` — самописный SVG без библиотек: `LineChart` (с пунктирной линией пред. периода), `ShareBars`, `Heatmap` (день×час), `KpiCard` (со стрелкой дельты). Вкладка «Обзор» в `iiko-analytics` собрана на них (`lib/sales-overview.ts` + `/api/iiko/analytics/overview`).
- ⚠️ Поля iiko, на которых легко ошибиться: `DayOfWeekOpen` приходит как **«1. Понедельник»** (нужно срезать префикс), `DishCategory` в этом аккаунте **пустой** (бухкатегории не заполнены) — реальную группировку меню даёт `DishGroup`, а `Store.Name` даёт разрез Бар / Кухня главная / Кухня подвал.

**Старый код**: `_legacy/` — только для справки, НЕ трогать.
