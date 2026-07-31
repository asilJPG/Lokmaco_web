import Link from 'next/link';
import { canAccess, sectionForHref } from '@/lib/access';

export type CategoryTile = {
  href: string;
  title: string;
  desc: string;
  icon: string;
  badge?: number | string;
};

/**
 * Плитки лендингов (мобильная навигация) фильтруются той же матрицей, что и
 * меню: иначе роль видит вход в раздел, который тут же её развернёт.
 */
export function CategoryGrid({ tiles, role }: { tiles: CategoryTile[]; role?: string }) {
  const visible = role === undefined
    ? tiles
    : tiles.filter((t) => {
        const section = sectionForHref(t.href);
        return section ? canAccess(role, section) : true;
      });
  return (
    <div className="cat-grid">
      {visible.map((t) => (
        <Link key={t.href} href={t.href} className="cat-tile">
          <div className="cat-tile__icon">{t.icon}</div>
          <div className="cat-tile__body">
            <div className="cat-tile__title">
              {t.title}
              {t.badge != null && t.badge !== 0 && <span className="nav-badge" style={{ marginLeft: 8 }}>{t.badge}</span>}
            </div>
            <div className="cat-tile__desc">{t.desc}</div>
          </div>
          <div className="cat-tile__arrow">→</div>
        </Link>
      ))}
    </div>
  );
}
