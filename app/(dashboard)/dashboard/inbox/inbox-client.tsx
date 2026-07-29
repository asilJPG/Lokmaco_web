'use client';

import { useEffect, useState } from 'react';

type Item = { product_id: string; product_name: string; quantity: number; unit: string; received_quantity?: number | null };
type Pending = {
  id: string;
  creatorName: string | null;
  storeFromName: string | null;
  storeToName: string | null;
  items: Item[];
  comment: string | null;
  receiverComment: string | null;
  status: string;
  createdAt: string;
};
type Bucket = { incoming: Pending[]; returned: Pending[]; outgoing: Pending[] };

export function InboxClient() {
  const [data, setData] = useState<Bucket>({ incoming: [], returned: [], outgoing: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/iiko/pending-transfer');
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'fetch failed');
      setData(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'fetch failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function act(p: Pending, action: string, payload?: { items?: Item[]; receiver_comment?: string }) {
    const res = await fetch('/api/iiko/pending-transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id, action, ...payload }),
    });
    const text = await res.text();
    let data: any = {};
    try { data = text ? JSON.parse(text) : {}; } catch {}
    if (!res.ok) return alert(data.error || `Ошибка ${res.status}: ${text.slice(0, 200)}`);
    await load();
  }

  if (loading) return <div className="card"><div className="empty-state">Загрузка…</div></div>;
  if (error) return <div className="banner banner--error">{error}</div>;

  return (
    <div className="grid">
      {data.incoming.length > 0 && (
        <Section title={`📥 Входящие (${data.incoming.length})`}>
          {data.incoming.map((p) => (
            <IncomingCard key={p.id} p={p} onAct={(action, payload) => act(p, action, payload)} />
          ))}
        </Section>
      )}
      {data.returned.length > 0 && (
        <Section title={`↩️ Возвращены тебе с изменениями (${data.returned.length})`}>
          {data.returned.map((p) => (
            <ReturnedCard key={p.id} p={p} onAct={(action) => act(p, action)} />
          ))}
        </Section>
      )}
      {data.outgoing.length > 0 && (
        <Section title={`📤 Отправленные, ждут ответа (${data.outgoing.length})`}>
          {data.outgoing.map((p) => (
            <OutgoingCard key={p.id} p={p} />
          ))}
        </Section>
      )}
      {data.incoming.length === 0 && data.returned.length === 0 && data.outgoing.length === 0 && (
        <div className="card"><div className="empty-state">Активных подтверждений нет</div></div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card" style={{ padding: 0 }}>
      <div style={{ padding: '14px 16px', background: 'var(--surface-muted)', borderRadius: 'var(--radius) var(--radius) 0 0', fontWeight: 700, fontSize: 14 }}>{title}</div>
      <div style={{ padding: 16, display: 'grid', gap: 12 }}>{children}</div>
    </section>
  );
}

function Header({ p }: { p: Pending }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
      <div>
        <div style={{ fontWeight: 600 }}>{p.storeFromName} → {p.storeToName}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>от {p.creatorName} · {new Date(p.createdAt).toLocaleString('ru-RU')}</div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{p.status}</div>
    </div>
  );
}

function ItemsTable({ items }: { items: Item[] }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 8 }}>
      <tbody>
        {items.map((it, i) => (
          <tr key={i} style={{ borderTop: i ? '1px solid var(--border)' : 'none' }}>
            <td style={{ padding: '6px 0' }}>{it.product_name}</td>
            <td style={{ padding: '6px 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{it.quantity} {it.unit}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function IncomingCard({ p, onAct }: { p: Pending; onAct: (action: string, payload?: { items?: Item[]; receiver_comment?: string }) => void }) {
  const [editing, setEditing] = useState(false);
  const [items, setItems] = useState<Item[]>(p.items.map((it) => ({ ...it, received_quantity: it.quantity })));
  const [rc, setRc] = useState('');

  return (
    <div className="card" style={{ borderColor: 'var(--accent)', borderStyle: 'solid' }}>
      <Header p={p} />
      {p.comment && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>💬 {p.comment}</div>}
      {!editing ? <ItemsTable items={p.items} /> : (
        <div className="grid" style={{ marginTop: 8 }}>
          {items.map((it, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 8, alignItems: 'center' }}>
              <div style={{ fontSize: 13 }}>{it.product_name}</div>
              <input type="number" inputMode="decimal" className="input input--inline input--number" value={it.received_quantity ?? ''} onChange={(e) => setItems(items.map((x, j) => j === i ? { ...x, received_quantity: parseFloat(e.target.value) || 0 } : x))} />
            </div>
          ))}
          <textarea className="textarea" rows={2} value={rc} onChange={(e) => setRc(e.target.value)} placeholder="Комментарий получателя" />
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        {!editing ? (
          <>
            <button type="button" className="btn btn--primary btn--sm" onClick={() => onAct('approve_by_receiver')}>✅ Принять как есть</button>
            <button type="button" className="btn btn--sm" onClick={() => setEditing(true)}>✎ Изменить количество</button>
            <button type="button" className="btn btn--danger btn--sm" onClick={() => { const c = prompt('Причина отказа?'); if (c !== null) onAct('reject_by_receiver', { receiver_comment: c }); }}>✕ Отклонить</button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn--primary btn--sm" onClick={() => onAct('modify_by_receiver', { items, receiver_comment: rc })}>↻ Вернуть с изменениями</button>
            <button type="button" className="btn btn--sm" onClick={() => setEditing(false)}>Отмена</button>
          </>
        )}
      </div>
    </div>
  );
}

function ReturnedCard({ p, onAct }: { p: Pending; onAct: (action: string) => void }) {
  return (
    <div className="card" style={{ borderColor: 'var(--warning)', borderStyle: 'solid' }}>
      <Header p={p} />
      {p.receiverComment && <div className="banner banner--warn" style={{ marginTop: 8 }}>💬 Получатель: {p.receiverComment}</div>}
      <ItemsTable items={p.items} />
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn--primary btn--sm" onClick={() => onAct('approve_by_creator')}>✅ Принять изменения</button>
        <button type="button" className="btn btn--danger btn--sm" onClick={() => onAct('reject_by_creator')}>✕ Отклонить и отменить</button>
      </div>
    </div>
  );
}

function OutgoingCard({ p }: { p: Pending }) {
  return (
    <div className="card">
      <Header p={p} />
      <ItemsTable items={p.items} />
      {p.comment && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>💬 {p.comment}</div>}
    </div>
  );
}
