import Link from 'next/link';

export type CategoryTile = {
  href: string;
  title: string;
  desc: string;
  icon: string;
  badge?: number | string;
};

export function CategoryGrid({ tiles }: { tiles: CategoryTile[] }) {
  return (
    <div className="cat-grid">
      {tiles.map((t) => (
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
