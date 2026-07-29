'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Item = { href: string; label: string; icon: string; badgeKey?: 'inbox'; adminOnly?: boolean };

const ITEMS: Item[] = [
  { href: '/dashboard', label: 'Главная', icon: '🏠' },
  { href: '/dashboard/operations', label: 'Операции', icon: '🧾' },
  { href: '/dashboard/analytics', label: 'Аналитика', icon: '📊' },
  { href: '/dashboard/warehouse', label: 'Склад', icon: '📦', badgeKey: 'inbox' },
  { href: '/dashboard/profile', label: 'Профиль', icon: '🙂' },
  { href: '/dashboard/admin', label: 'Админ', icon: '⚙️', adminOnly: true },
];

export function SidebarNav({ role, badges }: { role: string; badges?: { inbox?: number } }) {
  const path = usePathname();
  const isAdmin = role.split(':')[0] === 'admin';

  return (
    <nav className="app-sidebar__nav">
      {ITEMS.filter((it) => !it.adminOnly || isAdmin).map((it) => {
        const active = path === it.href || (it.href !== '/dashboard' && path?.startsWith(it.href));
        const badge = it.badgeKey && badges?.[it.badgeKey];
        return (
          <Link key={it.href} href={it.href} className="app-sidebar__link" data-active={active || undefined}>
            <span className="app-sidebar__icon">{it.icon}</span>
            <span style={{ flex: 1 }}>{it.label}</span>
            {badge ? <span className="nav-badge">{badge}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
