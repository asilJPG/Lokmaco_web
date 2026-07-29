import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth-session';
import { getCurrentFilialId } from '@/lib/current-filial';
import { SidebarNav } from '@/components/nav';
import { FilialSwitcher } from '@/components/filial-switcher';
import { LogoutButton } from '@/components/logout-button';
import { CommandPalette } from '@/components/command-palette';
import { and, inArray, or, eq, sql } from 'drizzle-orm';
import { db, schema } from '@/db/client';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const filials = session.filialIds.length > 0
    ? await db.select({ id: schema.filials.id, name: schema.filials.name })
        .from(schema.filials)
        .where(inArray(schema.filials.id, session.filialIds))
    : [];
  const current = await getCurrentFilialId();
  const baseRole = session.role.split(':')[0];
  const allowAll = baseRole === 'admin' || baseRole === 'director';

  const inboxCount = session.filialIds.length === 0 ? 0 : Number((await db
    .select({ c: sql<number>`count(*)::int` })
    .from(schema.pendingTransfers)
    .where(and(
      inArray(schema.pendingTransfers.filialId, session.filialIds),
      or(
        eq(schema.pendingTransfers.status, 'pending_receiver'),
        eq(schema.pendingTransfers.status, 'pending_sender'),
        eq(schema.pendingTransfers.status, 'pending_creator')
      )!
    )))[0]?.c || 0);

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-sidebar__brand">Lokmaco</div>
        <FilialSwitcher filials={filials} current={current} allowAll={allowAll} />
        <SidebarNav role={session.role} badges={{ inbox: inboxCount }} />
        <div className="cmdk-hint" data-print-hide style={{
          padding: '6px 12px 12px', fontSize: 11, color: 'var(--text-faint)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span>Быстрый поиск</span>
          <kbd style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 6px', background: 'var(--surface-muted)' }}>⌘K</kbd>
        </div>
        <div className="app-sidebar__user">
          <div>
            <div className="app-sidebar__user-name">{session.name}</div>
            <div>{session.role}</div>
          </div>
          <LogoutButton />
        </div>
      </aside>
      <main className="app-main">{children}</main>
      <CommandPalette isAdmin={baseRole === 'admin'} />
    </div>
  );
}
