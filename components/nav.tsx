'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

type Item = {
  href: string;
  label: string;
  icon: string;
  badgeKey?: 'inbox';
  adminOnly?: boolean;
  /** Roles allowed to see the item; omitted means everyone. */
  roles?: string[];
};

type Group = { title?: string; items: Item[] };

const IIKO_ROLES = ['admin', 'director', 'manager'];

/**
 * Grouped by how the day actually runs — what a cashier touches every shift
 * first, then stock, then the reporting layers — rather than by which system
 * the data happens to come from.
 */
const GROUPS: Group[] = [
  {
    items: [
      { href: '/dashboard', label: 'Главная', icon: '🏠' },
      { href: '/dashboard/assistant', label: 'Ассистент', icon: '✨', adminOnly: true },
    ],
  },
  {
    title: 'Смена',
    items: [
      { href: '/dashboard/cashier', label: 'Закрыть смену', icon: '🧾' },
      { href: '/dashboard/inbox', label: 'Подтверждения', icon: '📨', badgeKey: 'inbox' },
      { href: '/dashboard/history', label: 'История смен', icon: '🗂️' },
      { href: '/dashboard/attendance', label: 'Явки', icon: '🕒', adminOnly: true },
    ],
  },
  {
    title: 'Склад',
    items: [
      { href: '/dashboard/balances', label: 'Остатки', icon: '📦' },
      { href: '/dashboard/transfer', label: 'Перемещение', icon: '🔄' },
      { href: '/dashboard/invoice', label: 'Приход накладной', icon: '🚚' },
      { href: '/dashboard/inventory', label: 'Инвентаризация', icon: '📋' },
      { href: '/dashboard/production', label: 'Приготовление', icon: '🍳' },
      { href: '/dashboard/writeoff', label: 'Списание', icon: '🗑', roles: ['admin', 'bar'] },
      { href: '/dashboard/services', label: 'Услуги', icon: '🧾', roles: ['admin', 'director', 'supplier'] },
      { href: '/dashboard/documents', label: 'Документы iiko', icon: '📑' },
    ],
  },
  {
    title: 'Аналитика',
    items: [
      { href: '/dashboard/analytics', label: 'Обзор', icon: '📊', roles: IIKO_ROLES },
      { href: '/dashboard/analytics?tab=pl', label: 'ОПиУ', icon: '📈', roles: IIKO_ROLES },
      { href: '/dashboard/analytics?tab=abc', label: 'ABC-анализ блюд', icon: '🍽', roles: IIKO_ROLES },
      { href: '/dashboard/analytics?tab=liquidity', label: 'Ликвидность', icon: '🧊', roles: IIKO_ROLES },
      { href: '/dashboard/analytics?tab=purchases', label: 'Закупки', icon: '🏷', roles: IIKO_ROLES },
      { href: '/dashboard/analytics?tab=waiters', label: 'Официанты', icon: '👨‍🍳', roles: IIKO_ROLES },
    ],
  },
  {
    title: 'Финансы',
    items: [
      { href: '/dashboard/safe', label: 'Сейф', icon: '💰' },
      { href: '/dashboard/wages', label: 'Зарплаты', icon: '👥' },
      { href: '/dashboard/pnl', label: 'P&L', icon: '📈' },
      { href: '/dashboard/reconciliation', label: 'Отчёты кассы', icon: '🧮', adminOnly: true },
    ],
  },
  {
    title: 'Настройки',
    items: [
      { href: '/dashboard/profile', label: 'Профиль', icon: '🙂' },
      { href: '/dashboard/admin/users', label: 'Пользователи', icon: '👤', adminOnly: true },
      { href: '/dashboard/admin/filials', label: 'Филиалы', icon: '🏢', adminOnly: true },
    ],
  },
];

/**
 * The bottom bar on mobile fits about six targets, so it links to the section
 * landing pages rather than a subset of leaves — that way every page stays
 * reachable on a phone.
 */
const MOBILE_ITEMS: Item[] = [
  { href: '/dashboard', label: 'Главная', icon: '🏠' },
  { href: '/dashboard/assistant', label: 'Ассистент', icon: '✨', adminOnly: true },
  { href: '/dashboard/operations', label: 'Смена', icon: '🧾', badgeKey: 'inbox' },
  { href: '/dashboard/warehouse', label: 'Склад', icon: '📦' },
  { href: '/dashboard/analytics', label: 'Аналитика', icon: '📊', roles: IIKO_ROLES },
  { href: '/dashboard/finance', label: 'Финансы', icon: '💰' },
  { href: '/dashboard/profile', label: 'Профиль', icon: '🙂' },
  { href: '/dashboard/admin', label: 'Админ', icon: '⚙️', adminOnly: true },
];

export function SidebarNav({ role, badges }: { role: string; badges?: { inbox?: number } }) {
  const path = usePathname();
  const sp = useSearchParams();
  const baseRole = role.split(':')[0];
  const isAdmin = baseRole === 'admin';

  const currentTab = sp?.get('tab');

  function isActive(item: Item): boolean {
    const [href, query] = item.href.split('?');
    if (path !== href) {
      // Nested pages (e.g. /dashboard/admin/users/…) keep their parent lit.
      return href !== '/dashboard' && !!path?.startsWith(`${href}/`);
    }
    // Two entries can share a page and differ only by tab.
    const wantTab = query ? new URLSearchParams(query).get('tab') : null;
    if (wantTab) return currentTab === wantTab;
    return !currentTab;
  }

  function allowed(item: Item): boolean {
    if (item.adminOnly && !isAdmin) return false;
    if (item.roles && !item.roles.includes(baseRole)) return false;
    return true;
  }

  return (
    <>
    <nav className="app-sidebar__nav app-sidebar__nav--mobile">
      {MOBILE_ITEMS.filter(allowed).map((it) => {
        const badge = it.badgeKey && badges?.[it.badgeKey];
        const active = path === it.href || (it.href !== '/dashboard' && !!path?.startsWith(`${it.href}/`));
        return (
          <Link key={it.href} href={it.href} className="app-sidebar__link" data-active={active || undefined}>
            <span className="app-sidebar__icon">{it.icon}</span>
            <span style={{ flex: 1 }}>{it.label}</span>
            {badge ? <span className="nav-badge">{badge}</span> : null}
          </Link>
        );
      })}
    </nav>
    <nav className="app-sidebar__nav app-sidebar__nav--desktop">
      {GROUPS.map((group, gi) => {
        const items = group.items.filter(allowed);
        if (items.length === 0) return null;
        return (
          <div className="app-sidebar__group" key={group.title || gi}>
            {group.title && <div className="app-sidebar__group-title">{group.title}</div>}
            {items.map((it) => {
              const badge = it.badgeKey && badges?.[it.badgeKey];
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  className="app-sidebar__link"
                  data-active={isActive(it) || undefined}
                >
                  <span className="app-sidebar__icon">{it.icon}</span>
                  <span style={{ flex: 1 }}>{it.label}</span>
                  {badge ? <span className="nav-badge">{badge}</span> : null}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
    </>
  );
}
