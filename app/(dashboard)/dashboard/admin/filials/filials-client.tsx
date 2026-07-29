'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Filial = {
  id: number;
  name: string;
  iikoServer: string | null;
  iikoOrgId: string | null;
  iikoLogin: string | null;
  iikoPasswordEnc: string | null;
  iikoWebUrl: string | null;
  iikoWebLogin: string | null;
  iikoWebPasswordEnc: string | null;
  timezone: string;
};

type FormState = {
  id?: number;
  name: string;
  timezone: string;
  iikoServer: string;
  iikoOrgId: string;
  iikoLogin: string;
  iikoPassword: string;
  iikoWebUrl: string;
  iikoWebLogin: string;
  iikoWebPassword: string;
};

export function FilialsClient({ filials }: { filials: Filial[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<number | 'new' | null>(null);

  async function save(form: FormState) {
    const res = await fetch('/api/admin/filials', {
      method: form.id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) return alert(data.error || 'Ошибка');
    setEditing(null);
    router.refresh();
  }

  async function del(id: number) {
    if (!confirm('Удалить филиал? Это удалит и все связанные данные.')) return;
    const res = await fetch(`/api/admin/filials?id=${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) return alert(data.error || 'Ошибка');
    router.refresh();
  }

  return (
    <div className="grid">
      {editing === 'new' ? (
        <FilialForm onSubmit={save} onCancel={() => setEditing(null)} />
      ) : (
        <button type="button" className="btn btn--primary" onClick={() => setEditing('new')} style={{ alignSelf: 'flex-start' }}>
          + Добавить филиал
        </button>
      )}

      <div className="grid grid--2">
        {filials.map((f) => (
          editing === f.id ? (
            <div key={f.id} style={{ gridColumn: '1 / -1' }}>
              <FilialForm initial={f} onSubmit={save} onCancel={() => setEditing(null)} />
            </div>
          ) : (
            (() => {
              const xmlOk = !!(f.iikoServer && f.iikoLogin && f.iikoPasswordEnc);
              const webOk = !!(f.iikoWebUrl && f.iikoWebLogin && f.iikoWebPasswordEnc);
              const allOk = xmlOk && webOk;
              const status = allOk ? { bg: '#dcfce7', fg: '#166534', icon: '●', text: 'Готов' } : (xmlOk || webOk) ? { bg: '#fef3c7', fg: '#92400e', icon: '●', text: 'Частично' } : { bg: '#fee2e2', fg: '#991b1b', icon: '●', text: 'Не настроен' };
              return (
            <div key={f.id} className="card">
              <div className="card__title">
                <span className="card__title-text">🏢 {f.name}
                  <span style={{ marginLeft: 8, padding: '2px 10px', borderRadius: 999, background: status.bg, color: status.fg, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {status.icon} {status.text}
                  </span>
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button type="button" className="btn btn--sm" onClick={() => setEditing(f.id)}>✎</button>
                  <button type="button" className="btn btn--sm btn--danger" onClick={() => del(f.id)}>×</button>
                </div>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', display: 'grid', gap: 4 }}>
                <div>TZ: <code>{f.timezone}</code></div>
                <div>iiko org: <code>{f.iikoOrgId || '—'}</code></div>
                <div>iiko server: <code>{f.iikoServer || '—'}</code></div>
                <div>iiko login: <code>{f.iikoLogin || '—'}</code> {f.iikoPasswordEnc ? '🔒' : ''}</div>
                <div>iikoWeb url: <code>{f.iikoWebUrl || '—'}</code></div>
                <div>iikoWeb login: <code>{f.iikoWebLogin || '—'}</code> {f.iikoWebPasswordEnc ? '🔒' : ''}</div>
              </div>
            </div>
              );
            })()
          )
        ))}
        {filials.length === 0 && <div className="empty-state">Филиалов пока нет</div>}
      </div>
    </div>
  );
}

function FilialForm({ initial, onSubmit, onCancel }: { initial?: Filial; onSubmit: (f: FormState) => Promise<void>; onCancel: () => void }) {
  const [form, setForm] = useState<FormState>({
    id: initial?.id,
    name: initial?.name || '',
    timezone: initial?.timezone || 'Asia/Tashkent',
    iikoServer: initial?.iikoServer || '',
    iikoOrgId: initial?.iikoOrgId || '',
    iikoLogin: initial?.iikoLogin || '',
    iikoPassword: '',
    iikoWebUrl: initial?.iikoWebUrl || '',
    iikoWebLogin: initial?.iikoWebLogin || '',
    iikoWebPassword: '',
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try { await onSubmit(form); } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="card" style={{ background: 'var(--surface-muted)', borderStyle: 'dashed' }}>
      <div className="card__title"><span className="card__title-text">{initial ? `✎ ${initial.name}` : '➕ Новый филиал'}</span></div>

      <div className="grid grid--2">
        <div className="field">
          <label className="field__label">Название *</label>
          <input className="input" value={form.name} onChange={set('name')} required />
        </div>
        <div className="field">
          <label className="field__label">Timezone</label>
          <input className="input" value={form.timezone} onChange={set('timezone')} />
        </div>
      </div>

      <h3 style={{ marginTop: 20, marginBottom: 8, fontSize: 13, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>iiko Server (XML API)</h3>
      <div className="grid grid--2">
        <div className="field">
          <label className="field__label">URL сервера</label>
          <input className="input" value={form.iikoServer} onChange={set('iikoServer')} placeholder="https://server:port" />
        </div>
        <div className="field">
          <label className="field__label">Organization ID</label>
          <input className="input" value={form.iikoOrgId} onChange={set('iikoOrgId')} placeholder="UUID" />
        </div>
        <div className="field">
          <label className="field__label">Login</label>
          <input className="input" value={form.iikoLogin} onChange={set('iikoLogin')} />
        </div>
        <div className="field">
          <label className="field__label">Password {initial && <span className="field__hint">(пусто = не менять)</span>}</label>
          <input className="input" type="password" value={form.iikoPassword} onChange={set('iikoPassword')} />
        </div>
      </div>

      <h3 style={{ marginTop: 20, marginBottom: 8, fontSize: 13, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>iikoWeb (JSON API)</h3>
      <div className="grid grid--2">
        <div className="field">
          <label className="field__label">URL</label>
          <input className="input" value={form.iikoWebUrl} onChange={set('iikoWebUrl')} placeholder="https://xxx.iikoweb.ru" />
        </div>
        <div className="field" />
        <div className="field">
          <label className="field__label">Login</label>
          <input className="input" value={form.iikoWebLogin} onChange={set('iikoWebLogin')} />
        </div>
        <div className="field">
          <label className="field__label">Password {initial && <span className="field__hint">(пусто = не менять)</span>}</label>
          <input className="input" type="password" value={form.iikoWebPassword} onChange={set('iikoWebPassword')} />
        </div>
      </div>

      <div style={{ marginTop: 20, display: 'flex', gap: 8 }}>
        <button type="submit" className="btn btn--primary" disabled={busy || !form.name}>{busy ? 'Сохранение…' : 'Сохранить'}</button>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>Отмена</button>
      </div>
    </form>
  );
}
