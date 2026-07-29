# Lokmaco v2

В начале каждого ответа пиши «Асиль».

**Стек**: Next.js 14 (App Router, TS strict) · Drizzle · PostgreSQL · SimpleWebAuthn · iiko XML + iikoWeb JSON.

**Локалка**: БД `lokmaco_v2` (Homebrew PG 16). `npm run dev` → `localhost:3000`. Тестовый юзер `Asil` admin, код `1234`, филиал id=1 «Fergana».

**БД (Drizzle, multi-tenant — `filial_id` везде)**:
`filials` · `users` · `user_filials` · `user_passkeys` · `bot_actions` · `cash_reports` · `pending_transfers`.

**Auth**: middleware декодирует JWT cookie → инжектит `x-user-*` headers → API-роуты читают только из них (никогда из body).

**iiko**: `lib/iiko.ts` (XML) + `lib/iiko-web.ts` (JSON) + `lib/filial-iiko.ts` (per-filial creds, шифрование AES-256-GCM с `IIKO_CRED_KEY`). Все fetch-ы шлют браузерный User-Agent (иначе iikoweb отвечает 500).

**Дизайн**: всё в `app/globals.css`, без Tailwind. Классы: `.card`, `.btn[--primary|--danger|--sm|--icon]`, `.stat-card`, `.stat-grid`, `.banner[--info|--warn|--error|--success]`, `.field`, `.input[--inline|--number]`, `.totals-row`, `.empty-state`, `.action-bar`, `.tabs/.tab`, `.nav-badge`, `.cat-grid/.cat-tile` (категории-плитки на landing-страницах разделов). Dark mode через `prefers-color-scheme`. Print-friendly.

**Навигация**: сайдбар сгруппирован в 6 категорий вместо 14 плоских вкладок — `components/nav.tsx`: Главная/Операции/Аналитика/Склад/Профиль/Админ. Внутри каждой категории — landing-страница с `CategoryGrid` (`components/category-grid.tsx`) с крупными плитками-ссылками на конкретные страницы.

**БД в проде**: реальный Supabase (shared проект, там же чужие таблицы appointments/pipls_*/etc — не трогать). Подключение строго через **Transaction pooler** (`aws-1-ap-south-1.pooler.supabase.com:6543`), direct connection (`db.*.supabase.co:5432`) не резолвится для новых проектов. `DATABASE_URL` в `.env` (не `.env.local`). Таблица `users` в реальной БД называется `bot_users`, `tgId` — bigint. Готовится деплой на Vercel (без своего сервера).

**Перенесено из легаси в v2 (2026-07-25, через параллельных агентов)**:
- Приход накладных: `app/api/iiko/invoice`, `/parse` (AI-парсинг текста через OpenRouter), `/suppliers` + `dashboard/invoice` страница. ⚠️ `INCOMING_INVOICE` в `lib/iiko-web-docs.ts` — поля инференс по аналогии с легаси XML, НЕ проверено на реальном iikoWeb, тестировать перед продакшн-использованием.
- `app/api/iiko/employees`, `/documents/detail`, `/analytics/pl/details` — детализация P&L и документов раскрывается по клику в `iiko-analytics/client.tsx` и `documents-client.tsx`.
- Сверка касса/iiko (`dashboard/reconciliation`, `app/api/iiko/analytics/cash-reconciliation`) и вкладка «Явки»/attendance в `iiko-analytics` — оба доступны **только admin** (сузили по явной просьбе, а не по умолчанию агента). В легаси нашли и исправили баг: в `LocmacoApp.jsx` строки "Наличные"/"Наличные-" сверялись с перепутанными полями кассира (cash↔encashment) и расходы вычитались не из той строки — в новой реализации каждый тип сверяется строго сам с собой.
- Все 3 параллельных агента (invoice+parse+suppliers, cash-reconciliation+attendance, employees+documents-detail+pl-details) завершены, `npx tsc --noEmit` по всему проекту чистый, конфликтов на общих файлах (`iiko-analytics/client.tsx`) не было.
- ⚠️ Приход накладных (`INCOMING_INVOICE` в `lib/iiko-web-docs.ts`) — поля собраны по аналогии со старым XML-форматом, НЕ протестировано на реальном iikoWeb. Проверить перед реальным использованием.

**Аналитика меню** (`dashboard/menu-analytics`, admin/director/manager) — аналог сервиса Ресториум, но данные из iiko, а не из ручного справочника:
- Вкладка «Блюда»: food cost и наценка по каждому блюду, ABC-анализ, CSV-экспорт. Источник — OLAP SALES с полем `ProductCostBase.ProductCost` (iiko отдаёт себестоимость готовой).
- Вкладка «Цены»: закупки (суммы, поставщики), история цен, алерты, оценка экономии «закупать по лучшей своей цене». Источник — `documents/export/incomingInvoice` (все накладные с ценами одним XML-запросом, своя таблица в БД НЕ нужна) + `suppliers`.
- Главный приём, взятый у Ресториума: **каждый блок отвечает «сколько это в деньгах»**. Потенциал блюда = `выручка × (FC% − целевой FC%)`, целевой FC настраивается (20/25/30/35). ABC считается трижды — по количеству, выручке и прибыли.
- ⚠️ Два неочевидных момента в данных накладных, не сломать при правках `lib/ingredient-prices.ts`:
  1. Поле `price` в накладной — цена за **упаковку**, не за единицу (мешок муки 25кг = 220000, 50кг = 440000 при неизменных 8800/кг). Цену за базовую единицу считать только как `sum / actualAmount`.
  2. Алерты «каждая закупка против предыдущей» дают шум (клубника чередуется между двумя поставщиками 65000↔85000 → сотни ложных алертов). Правильно: один алерт на ингредиент — последняя цена против **медианы** предыдущих, сортировка по влиянию на деньги. Скачки >200% отделены в «похоже на ошибку ввода» (количество в коробках вместо штук).

**Старый код**: `_legacy/` — только для справки, НЕ трогать.
