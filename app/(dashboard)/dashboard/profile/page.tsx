import { headers } from 'next/headers';
import { getSession } from '@/lib/auth-session';
import { getUserById, getUserPasskeys } from '@/lib/users';
import { ProfileClient } from './profile-client';

export const metadata = { title: 'Профиль' };
export const dynamic = 'force-dynamic';

const ROLE_COLORS: Record<string, { bg: string; fg: string }> = {
  admin: { bg: '#fee2e2', fg: '#991b1b' },
  director: { bg: '#dbeafe', fg: '#1e40af' },
  manager: { bg: '#fef3c7', fg: '#92400e' },
  cashier: { bg: '#dcfce7', fg: '#166534' },
  kitchen: { bg: '#f3e8ff', fg: '#6b21a8' },
};

const LOGIN_LABEL: Record<string, string> = {
  passkey: '🔐 Face ID / Touch ID',
  access_code: '🔢 Код доступа',
  password: '🔑 Пароль',
};

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) return null;
  const [user, allPasskeys] = await Promise.all([getUserById(session.id), getUserPasskeys(session.id)]);
  // Ключи со старого сайта здесь физически не сработают — помечаем их, чтобы
  // человек не гадал, почему Face ID не появляется.
  const h = headers();
  const rpId = (h.get('x-forwarded-host') || h.get('host') || 'localhost').split(':')[0];
  const passkeys = allPasskeys.map((p) => ({
    id: p.id,
    createdAt: p.createdAt,
    worksHere: p.rpId === rpId,
    rpId: p.rpId,
  }));
  const baseRole = session.role.split(':')[0];
  const roleStyle = ROLE_COLORS[baseRole] || { bg: 'var(--surface-muted)', fg: 'var(--text-muted)' };

  return (
    <div className="grid">
      <div>
        <h1 className="page-title">Профиль</h1>
        <p className="page-subtitle">
          {session.name}
          {' '}
          <span style={{ display: 'inline-block', marginLeft: 6, padding: '2px 10px', borderRadius: 999, background: roleStyle.bg, color: roleStyle.fg, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{session.role}</span>
        </p>
      </div>
      {user?.lastLoginAt && (
        <div className="banner banner--info">
          Последний вход: <b style={{ marginLeft: 4 }}>{new Date(user.lastLoginAt).toLocaleString('ru-RU')}</b>
          {user.lastLoginMethod && <span style={{ marginLeft: 8 }}>· {LOGIN_LABEL[user.lastLoginMethod] || user.lastLoginMethod}</span>}
        </div>
      )}
      <ProfileClient
        passkeys={passkeys.map((k) => ({ ...k, createdAt: k.createdAt.toISOString() }))}
      />
    </div>
  );
}
