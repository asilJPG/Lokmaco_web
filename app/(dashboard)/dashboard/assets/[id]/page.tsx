import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { db, schema } from '@/db/client';
import { getSession } from '@/lib/auth-session';

export const metadata = { title: 'Карточка ОС' };
export const dynamic = 'force-dynamic';

const STATUS: Record<string, { label: string; color: string }> = {
  in_use: { label: '🟢 В эксплуатации', color: 'var(--success)' },
  repair: { label: '🟡 В ремонте', color: 'var(--warning)' },
  in_stock: { label: '🔵 На складе', color: 'var(--accent)' },
  written_off: { label: '🔴 Списан', color: 'var(--danger)' },
  sold: { label: '⚪ Продан', color: 'var(--text-muted)' },
};

function money(v: string | null) {
  if (v === null || v === '') return '—';
  return `${Math.round(Number(v) || 0).toLocaleString('ru-RU')} сум`;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 600, textAlign: 'right' }}>{value || '—'}</span>
    </div>
  );
}

export default async function AssetCardPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!['admin', 'manager'].includes((session?.role || '').split(':')[0])) redirect('/dashboard/warehouse');

  const [asset] = await db.select().from(schema.assets).where(eq(schema.assets.id, params.id));

  if (!asset) {
    return (
      <div className="card">
        <div className="empty-state">Оборудование не найдено. Стикер устарел или запись удалена.</div>
        <div className="action-bar"><Link href="/dashboard/assets" className="btn">К описи</Link></div>
      </div>
    );
  }

  const st = STATUS[asset.status || 'in_use'] || STATUS.in_use;

  return (
    <div className="grid" style={{ maxWidth: 520 }}>
      <div>
        <h1 className="page-title">{asset.name}</h1>
        <p className="page-subtitle">Карточка основного средства</p>
      </div>

      <section className="card">
        <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 800, display: 'inline-block', padding: '4px 12px', borderRadius: 8, background: 'var(--accent-soft)', color: 'var(--accent)', marginBottom: 12 }}>
          {asset.invNumber}
        </div>
        <div style={{ display: 'inline-block', marginLeft: 8, padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 700, color: st.color }}>
          {st.label}
        </div>

        <Row label="Категория" value={asset.category} />
        <Row label="Дата прихода" value={asset.commissioningDate} />
        <Row label="Первоначальная стоимость" value={money(asset.initialCost)} />
        <Row label="Количество" value={asset.quantity} />
        <Row label="Локация" value={asset.location} />
        <Row label="МОЛ (ответственный)" value={asset.responsiblePerson} />
        <Row label="Серийный / код" value={asset.serialNumber} />
        {asset.lastInventoriedAt && (
          <Row label="Последняя инвентаризация" value={new Date(asset.lastInventoriedAt).toLocaleDateString('ru-RU')} />
        )}

        {asset.notes && (
          <div style={{ marginTop: 16, fontSize: 13, color: 'var(--text-muted)', background: 'var(--surface-muted)', padding: 12, borderRadius: 10 }}>
            📝 {asset.notes}
          </div>
        )}
      </section>

      <div className="action-bar">
        <Link href="/dashboard/assets" className="btn">← К описи</Link>
      </div>
    </div>
  );
}
