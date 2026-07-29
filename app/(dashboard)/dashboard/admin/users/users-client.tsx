'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copyable } from '@/components/copy-button';

type User = {
  id: number;
  name: string;
  role: string;
  accessCode: string | null;
  tgId: number | null;
  lastLoginAt: Date | string | null;
  filialIds: number[];
  passkeyCount: number;
};

type Filial = { id: number; name: string };

const ROLES = ['admin', 'director', 'cashier', 'kitchen', 'manager'];

export function UsersClient({ users, filials, currentUserId }: { users: User[]; filials: Filial[]; currentUserId: number }) {
  const router = useRouter();
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const filteredUsers = q
    ? users.filter((u) => u.name.toLowerCase().includes(q) || u.role.toLowerCase().includes(q) || (u.accessCode || '').includes(q))
    : users;

  async function save(form: {
    id?: number;
    name: string;
    role: string;
    accessCode: string;
    tgId: string;
    filialIds: number[];
  }) {
    const body = {
      id: form.id,
      name: form.name,
      role: form.role,
      accessCode: form.accessCode || null,
      tgId: form.tgId ? Number(form.tgId) : null,
      filialIds: form.filialIds,
    };
    const res = await fetch('/api/admin/users', {
      method: form.id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) return alert(data.error || 'Ошибка');
    setEditing(null);
    router.refresh();
  }

  async function del(id: number) {
    if (!confirm('Удалить пользователя?')) return;
    const res = await fetch(`/api/admin/users?id=${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) return alert(data.error || 'Ошибка');
    router.refresh();
  }

  return (
    <div className="grid">
      {editing === 'new' ? (
        <UserForm filials={filials} onSubmit={save} onCancel={() => setEditing(null)} />
      ) : (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn--primary" onClick={() => setEditing('new')}>
            + Добавить пользователя
          </button>
          <input className="input" placeholder="Поиск по имени, роли или коду…" value={query} onChange={(e) => setQuery(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{filteredUsers.length} из {users.length}</span>
        </div>
      )}

      <section className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', background: 'var(--surface-muted)' }}>
                <th style={{ padding: '12px 14px', textAlign: 'left' }}>Имя</th>
                <th style={{ padding: '12px 14px', textAlign: 'left' }}>Роль</th>
                <th style={{ padding: '12px 14px', textAlign: 'left' }}>Код</th>
                <th style={{ padding: '12px 14px', textAlign: 'left' }}>Филиалы</th>
                <th style={{ padding: '12px 14px', textAlign: 'left' }}>Passkey</th>
                <th style={{ padding: '12px 14px', textAlign: 'left' }}>Последний вход</th>
                <th style={{ padding: '12px 14px', width: 100 }}></th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u.id}>
                  {editing === u.id ? (
                    <td colSpan={7} style={{ padding: 16 }}>
                      <UserForm initial={u} filials={filials} onSubmit={save} onCancel={() => setEditing(null)} />
                    </td>
                  ) : (
                    <>
                      <td style={{ padding: '12px 14px', borderTop: '1px solid var(--border)' }}>
                        {u.name} {u.id === currentUserId && <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>(вы)</span>}
                      </td>
                      <td style={{ padding: '12px 14px', borderTop: '1px solid var(--border)', color: 'var(--text-muted)' }}>{u.role}</td>
                      <td style={{ padding: '12px 14px', borderTop: '1px solid var(--border)', fontFamily: 'monospace' }}>{u.accessCode ? <Copyable value={u.accessCode} /> : '—'}</td>
                      <td style={{ padding: '12px 14px', borderTop: '1px solid var(--border)' }}>
                        {u.filialIds.length === 0 ? <span style={{ color: 'var(--text-faint)' }}>—</span> : u.filialIds.map((fid) => filials.find((f) => f.id === fid)?.name || fid).join(', ')}
                      </td>
                      <td style={{ padding: '12px 14px', borderTop: '1px solid var(--border)' }}>{u.passkeyCount}</td>
                      <td style={{ padding: '12px 14px', borderTop: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 12 }}>
                        {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('ru-RU') : '—'}
                      </td>
                      <td style={{ padding: '12px 14px', borderTop: '1px solid var(--border)' }}>
                        <button type="button" className="btn btn--sm" onClick={() => setEditing(u.id)}>✎</button>
                        {u.id !== currentUserId && (
                          <button type="button" className="btn btn--sm btn--danger" onClick={() => del(u.id)} style={{ marginLeft: 4 }}>×</button>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={7} className="empty-state">Пользователей нет</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function UserForm({ initial, filials, onSubmit, onCancel }: {
  initial?: User;
  filials: Filial[];
  onSubmit: (f: { id?: number; name: string; role: string; accessCode: string; tgId: string; filialIds: number[] }) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name || '');
  const [role, setRole] = useState(initial?.role || 'cashier');
  const [accessCode, setAccessCode] = useState(initial?.accessCode || '');
  const [tgId, setTgId] = useState(initial?.tgId ? String(initial.tgId) : '');
  const [filialIds, setFilialIds] = useState<number[]>(initial?.filialIds || []);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await onSubmit({ id: initial?.id, name, role, accessCode, tgId, filialIds });
    } finally {
      setBusy(false);
    }
  }

  function toggleFilial(id: number) {
    setFilialIds((arr) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]));
  }

  return (
    <form onSubmit={submit} className="card" style={{ background: 'var(--surface-muted)', borderStyle: 'dashed' }}>
      <div className="card__title">
        <span className="card__title-text">{initial ? `✎ Редактирование: ${initial.name}` : '➕ Новый пользователь'}</span>
      </div>
      <div className="grid grid--2">
        <div className="field">
          <label className="field__label">Имя *</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="field">
          <label className="field__label">Роль</label>
          <select className="select" value={role.split(':')[0]} onChange={(e) => setRole(e.target.value + (role.includes(':') ? ':' + role.split(':')[1] : ''))}>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="field__label">Код доступа</label>
          <input className="input" value={accessCode} onChange={(e) => setAccessCode(e.target.value)} placeholder="мин. 4 символа" />
        </div>
        <div className="field">
          <label className="field__label">Telegram ID</label>
          <input className="input" type="number" value={tgId} onChange={(e) => setTgId(e.target.value)} placeholder="опционально" />
        </div>
      </div>
      <div className="field" style={{ marginTop: 12 }}>
        <label className="field__label">Доступные филиалы</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {filials.map((f) => (
            <label key={f.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: '1px solid var(--border-strong)', borderRadius: 8, background: filialIds.includes(f.id) ? 'var(--accent)' : 'var(--surface)', color: filialIds.includes(f.id) ? '#fff' : 'var(--text)', cursor: 'pointer', fontSize: 13 }}>
              <input type="checkbox" checked={filialIds.includes(f.id)} onChange={() => toggleFilial(f.id)} style={{ display: 'none' }} />
              {f.name}
            </label>
          ))}
          {filials.length === 0 && <span style={{ color: 'var(--text-faint)', fontSize: 13 }}>Сначала создай филиал</span>}
        </div>
      </div>
      <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
        <button type="submit" className="btn btn--primary" disabled={busy || !name}>{busy ? 'Сохранение…' : 'Сохранить'}</button>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>Отмена</button>
      </div>
    </form>
  );
}
