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
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null);
  const [failed, setFailed] = useState<{ id: string; error: string }[]>([]);

  // `ready` only gates the very first render. Re-loading after an action must
  // not unmount the list: swapping the whole tree for a spinner loses the
  // scroll position and reads as a page reload.
  async function load() {
    setError(null);
    try {
      const res = await fetch('/api/iiko/pending-transfer');
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'fetch failed');
      setData(j);
      // Обработанные исчезают из списка — снимаем их и с отметок.
      const alive = new Set<string>([...j.incoming, ...j.returned, ...j.outgoing].map((x: Pending) => x.id));
      setSelected((cur) => new Set([...cur].filter((id) => alive.has(id))));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'fetch failed');
    } finally {
      setReady(true);
    }
  }

  useEffect(() => { load(); }, []);

  async function act(p: Pending, action: string, payload?: { items?: Item[]; receiver_comment?: string }) {
    if (busyId) return;
    setBusyId(p.id);
    setToast(null);
    try {
      const res = await fetch('/api/iiko/pending-transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: p.id, action, ...payload }),
      });
      const text = await res.text();
      let body: any = {};
      try { body = text ? JSON.parse(text) : {}; } catch {}
      if (!res.ok) {
        setToast({ ok: false, text: body.error || `Ошибка ${res.status}: ${text.slice(0, 200)}` });
        return;
      }
      setToast({ ok: true, text: ACTION_DONE[action] || 'Готово' });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  function toggle(id: string) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  /**
   * Массовый приём. Отправляем один запрос со списком id — сервер обрабатывает
   * их по одному, поэтому падение на третьем не отменяет первые два и не
   * мешает остальным. Что не прошло — показываем поимённо, а не «ошибка».
   */
  async function approveSelected() {
    const ids = [...selected];
    if (ids.length === 0 || bulk) return;
    setToast(null);
    setFailed([]);
    setBulk({ done: 0, total: ids.length });
    try {
      const res = await fetch('/api/iiko/pending-transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, action: 'approve_by_receiver' }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast({ ok: false, text: j.error || `Ошибка ${res.status}` });
        return;
      }
      const bad = (j.results || []).filter((r: any) => !r.ok);
      setFailed(bad.map((r: any) => ({ id: r.id, error: r.error || 'не удалось' })));
      setToast({
        ok: bad.length === 0,
        text: bad.length === 0
          ? `Принято перемещений: ${j.ok}. Документы ушли в iiko.`
          : `Принято ${j.ok} из ${ids.length}. Не прошло: ${bad.length} — смотри ниже.`,
      });
      await load();
    } finally {
      setBulk(null);
    }
  }

  if (!ready) return <div className="card"><div className="empty-state">Загрузка…</div></div>;

  const empty = data.incoming.length === 0 && data.returned.length === 0 && data.outgoing.length === 0;

  return (
    <div className="grid">
      {error && <div className="banner banner--error">{error}</div>}
      {toast && <div className={`banner ${toast.ok ? 'banner--success' : 'banner--error'}`}>{toast.text}</div>}
      {failed.length > 0 && (
        <div className="banner banner--warn">
          <div>
            <strong>Не удалось принять:</strong>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {failed.map((f) => {
                const doc = data.incoming.find((p) => p.id === f.id);
                return <li key={f.id}>{doc ? `${doc.storeFromName} → ${doc.storeToName}` : f.id.slice(0, 8)}: {f.error}</li>;
              })}
            </ul>
          </div>
        </div>
      )}
      {data.incoming.length > 0 && (
        <Section
          title={`📥 Входящие (${data.incoming.length})`}
          action={
            <label className="bulk-select-all">
              <input
                type="checkbox"
                checked={selected.size > 0 && data.incoming.every((p) => selected.has(p.id))}
                onChange={(e) => setSelected(e.target.checked ? new Set(data.incoming.map((p) => p.id)) : new Set())}
              />
              Выбрать все
            </label>
          }
        >
          {data.incoming.map((p) => (
            <IncomingCard
              key={p.id}
              p={p}
              busy={busyId === p.id || !!bulk}
              selected={selected.has(p.id)}
              onToggle={() => toggle(p.id)}
              onAct={(action, payload) => act(p, action, payload)}
            />
          ))}
        </Section>
      )}
      {selected.size > 0 && (
        <div className="action-bar">
          <span className="bulk-count" style={{ fontSize: 13, color: 'var(--text-muted)' }}>Выбрано: {selected.size}</span>
          <button type="button" className="btn btn--sm" onClick={() => setSelected(new Set())} disabled={!!bulk}>Снять</button>
          <button type="button" className="btn btn--primary action-bar__btn" onClick={approveSelected} disabled={!!bulk}>
            {bulk ? `Принимаю… ${bulk.total} шт.` : `✅ Принять выбранные (${selected.size})`}
          </button>
        </div>
      )}
      {data.returned.length > 0 && (
        <Section title={`↩️ Возвращены тебе с изменениями (${data.returned.length})`}>
          {data.returned.map((p) => (
            <ReturnedCard key={p.id} p={p} busy={busyId === p.id} onAct={(action) => act(p, action)} />
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
      {empty && <div className="card"><div className="empty-state">Активных подтверждений нет</div></div>}
    </div>
  );
}

const ACTION_DONE: Record<string, string> = {
  approve_by_receiver: 'Принято, документ ушёл в iiko',
  modify_by_receiver: 'Возвращено отправителю с изменениями',
  reject_by_receiver: 'Отклонено',
  approve_by_creator: 'Изменения приняты, документ ушёл в iiko',
  reject_by_creator: 'Перемещение отменено',
};

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="card" style={{ padding: 0 }}>
      <div style={{ padding: '14px 16px', background: 'var(--surface-muted)', borderRadius: 'var(--radius) var(--radius) 0 0', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span>{title}</span>
        {action}
      </div>
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

function IncomingCard({ p, busy, selected, onToggle, onAct }: {
  p: Pending; busy: boolean; selected: boolean; onToggle: () => void;
  onAct: (action: string, payload?: { items?: Item[]; receiver_comment?: string }) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [items, setItems] = useState<Item[]>(p.items.map((it) => ({ ...it, received_quantity: it.quantity })));
  const [rc, setRc] = useState('');

  return (
    <div className="card" data-selected={selected || undefined} style={{ borderColor: selected ? 'var(--accent)' : 'var(--accent)', borderStyle: 'solid' }}>
      <label className="bulk-check">
        <input type="checkbox" checked={selected} onChange={onToggle} disabled={busy} />
        <span>Отметить для массового приёма</span>
      </label>
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
            <button type="button" className="btn btn--primary btn--sm" disabled={busy} onClick={() => onAct('approve_by_receiver')}>{busy ? 'Отправка…' : '✅ Принять как есть'}</button>
            <button type="button" className="btn btn--sm" disabled={busy} onClick={() => setEditing(true)}>✎ Изменить количество</button>
            <button type="button" className="btn btn--danger btn--sm" disabled={busy} onClick={() => { const c = prompt('Причина отказа?'); if (c !== null) onAct('reject_by_receiver', { receiver_comment: c }); }}>✕ Отклонить</button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn--primary btn--sm" disabled={busy} onClick={() => onAct('modify_by_receiver', { items, receiver_comment: rc })}>{busy ? 'Отправка…' : '↻ Вернуть с изменениями'}</button>
            <button type="button" className="btn btn--sm" disabled={busy} onClick={() => setEditing(false)}>Отмена</button>
          </>
        )}
      </div>
    </div>
  );
}

function ReturnedCard({ p, busy, onAct }: { p: Pending; busy: boolean; onAct: (action: string) => void }) {
  return (
    <div className="card" style={{ borderColor: 'var(--warning)', borderStyle: 'solid' }}>
      <Header p={p} />
      {p.receiverComment && <div className="banner banner--warn" style={{ marginTop: 8 }}>💬 Получатель: {p.receiverComment}</div>}
      <ItemsTable items={p.items} />
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn--primary btn--sm" disabled={busy} onClick={() => onAct('approve_by_creator')}>{busy ? 'Отправка…' : '✅ Принять изменения'}</button>
        <button type="button" className="btn btn--danger btn--sm" disabled={busy} onClick={() => onAct('reject_by_creator')}>✕ Отклонить и отменить</button>
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
