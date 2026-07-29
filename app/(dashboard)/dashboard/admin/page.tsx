import { redirect } from 'next/navigation';
import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { getSession } from '@/lib/auth-session';
import { db, schema } from '@/db/client';

export const metadata = { title: 'Админ' };
export const dynamic = 'force-dynamic';

const SECTIONS = [
  { href: '/dashboard/admin/users', title: '👥 Пользователи', desc: 'Создание, выдача кодов, привязка к филиалам', countKey: 'users' as const },
  { href: '/dashboard/admin/filials', title: '🏢 Филиалы', desc: 'Список филиалов и их iiko-настройки', countKey: 'filials' as const },
];

export default async function AdminHome() {
  const session = await getSession();
  if (session?.role.split(':')[0] !== 'admin') redirect('/dashboard');

  const [counts] = await db.select({
    users: sql<number>`(select count(*)::int from ${schema.users})`,
    filials: sql<number>`(select count(*)::int from ${schema.filials})`,
    passkeys: sql<number>`(select count(*)::int from ${schema.userPasskeys})`,
  }).from(sql`(select 1) as _`);

  return (
    <div className="grid">
      <div>
        <h1 className="page-title">Администрирование</h1>
        <p className="page-subtitle">{counts.users} пользователей · {counts.filials} филиалов · {counts.passkeys} устройств</p>
      </div>
      <div className="grid grid--2">
        {SECTIONS.map((s) => (
          <Link key={s.href} href={s.href} className="card" style={{ textDecoration: 'none' }}>
            <div className="card__title">
              <span className="card__title-text">{s.title}</span>
              <span style={{ background: 'var(--surface-muted)', padding: '2px 10px', borderRadius: 999, fontSize: 12, color: 'var(--text-muted)' }}>{counts[s.countKey]}</span>
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{s.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
