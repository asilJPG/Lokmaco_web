import { redirect } from 'next/navigation';

/**
 * Кто какой раздел видит. Матрица перенесена один в один из легаси —
 * функция `hasAccess` в `components/LocmacoApp.jsx` плюс фильтр вкладок
 * аналитики. Менять здесь что-то «на глаз» нельзя: это единственное место,
 * где решается видимость, и от него зависят и меню, и сами страницы.
 *
 * Легаси-названия вкладок → разделы v2:
 *   incoming → invoice · cash → cashier · reports → reconciliation
 *   fixed_assets → assets · agent → assistant · employees → admin/users
 *
 * `'all'` — любой залогиненный, как и в легаси (там такие разделы просто не
 * попадали в switch и были доступны всем через прямые вызовы API).
 */
export type Section =
  | 'home' | 'profile' | 'assistant'
  | 'cashier' | 'inbox' | 'history' | 'attendance'
  | 'balances' | 'transfer' | 'transferDirect' | 'invoice' | 'inventory' | 'production'
  | 'writeoff' | 'services' | 'documents' | 'assets'
  | 'analytics' | 'analytics.pl' | 'analytics.abc' | 'analytics.liquidity'
  | 'analytics.sales' | 'analytics.purchases' | 'analytics.waiters'
  | 'safe' | 'wages' | 'pnl' | 'reconciliation' | 'taxReport'
  | 'adminUsers' | 'adminFilials';

const ALL = 'all' as const;

const ACCESS: Record<Section, readonly string[] | typeof ALL> = {
  // Оболочка v2, в легаси отдельными вкладками не была.
  home: ALL,
  profile: ALL,

  // agent — только admin.
  assistant: ['admin'],

  // cash — admin + cashier.
  cashier: ['admin', 'cashier'],
  // Подтверждения — часть потока перемещений, роли те же.
  inbox: ['admin', 'kitchen', 'prep_chef', 'bar', 'supplier', 'hall'],
  // История в легаси висела внутри каждого раздела и роли не ограничивала.
  history: ALL,
  // attendance: вкладка «Кадры» скрыта от менеджера.
  attendance: ['admin', 'director'],

  // balances: `role !== "manager"`.
  balances: ['admin', 'director', 'supplier', 'kitchen', 'prep_chef', 'bar', 'cashier', 'hall'],
  transfer: ['admin', 'kitchen', 'prep_chef', 'bar', 'supplier', 'hall'],
  // Отправка перемещения напрямую в iiko, минуя подтверждение получателем.
  // Сужено до админа осознанно: остальные роли создают перемещение только
  // через подтверждение, чтобы принимающий склад видел, что ему приехало.
  // Раздел не страничный — в HREF_TO_SECTION его нет.
  transferDirect: ['admin'],
  invoice: ['admin', 'supplier'],
  inventory: ['admin', 'kitchen', 'prep_chef', 'bar', 'supplier'],
  production: ['admin', 'prep_chef', 'bar'],
  writeoff: ['admin', 'bar'],
  services: ['admin', 'supplier', 'director'],
  // Документы iiko — раздела в легаси не было; ставим как у детализации ОПиУ.
  documents: ['admin', 'director'],
  // fixed_assets.
  assets: ['admin', 'manager'],

  // Аналитика: сама вкладка — director/manager/admin, дальше по под-вкладкам.
  analytics: ['admin', 'director', 'manager'],
  'analytics.pl': ['admin', 'director'],
  // ABC, ликвидность и закупки — разделы v2. Ставим как у «Категорий»
  // (admin/director): это та же кухонная экономика, что скрыта от менеджера.
  'analytics.abc': ['admin', 'director'],
  'analytics.liquidity': ['admin', 'director'],
  'analytics.sales': ['admin', 'director'],
  'analytics.purchases': ['admin', 'director'],
  'analytics.waiters': ['admin', 'director', 'manager'],

  // cash_expenses и wages — admin/director.
  safe: ['admin', 'director'],
  wages: ['admin', 'director'],
  pnl: ['admin', 'director'],
  // reports — только admin.
  reconciliation: ['admin'],
  taxReport: ['admin', 'director'],

  adminUsers: ['admin'],
  adminFilials: ['admin'],
};

/** Роль без хвоста со складом: `bar:<storeId>` → `bar`. */
export function baseRole(role: string | null | undefined): string {
  return (role || '').split(':')[0];
}

export function canAccess(role: string | null | undefined, section: Section): boolean {
  const allowed = ACCESS[section];
  if (allowed === ALL) return true;
  return allowed.includes(baseRole(role));
}

/**
 * Страница, закрытая для роли, не должна открываться по прямой ссылке —
 * прятать пункт в меню мало. Уводим туда, куда роли точно можно.
 */
export function requireAccess(role: string | null | undefined, section: Section, fallback = '/dashboard'): void {
  if (!canAccess(role, section)) redirect(fallback);
}

/** Путь дашборда → раздел матрицы. Нужен плиткам лендингов. */
const HREF_TO_SECTION: Record<string, Section> = {
  '/dashboard': 'home',
  '/dashboard/profile': 'profile',
  '/dashboard/assistant': 'assistant',
  '/dashboard/cashier': 'cashier',
  '/dashboard/inbox': 'inbox',
  '/dashboard/history': 'history',
  '/dashboard/attendance': 'attendance',
  '/dashboard/balances': 'balances',
  '/dashboard/transfer': 'transfer',
  '/dashboard/invoice': 'invoice',
  '/dashboard/inventory': 'inventory',
  '/dashboard/production': 'production',
  '/dashboard/writeoff': 'writeoff',
  '/dashboard/services': 'services',
  '/dashboard/documents': 'documents',
  '/dashboard/assets': 'assets',
  '/dashboard/analytics': 'analytics',
  '/dashboard/safe': 'safe',
  '/dashboard/wages': 'wages',
  '/dashboard/pnl': 'pnl',
  '/dashboard/reconciliation': 'reconciliation',
  '/dashboard/tax-report': 'taxReport',
  '/dashboard/admin/users': 'adminUsers',
  '/dashboard/admin/filials': 'adminFilials',
};

export function sectionForHref(href: string): Section | null {
  return HREF_TO_SECTION[href.split('?')[0]] ?? null;
}
