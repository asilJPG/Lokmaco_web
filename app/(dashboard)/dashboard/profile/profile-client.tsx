'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { startRegistration } from '@simplewebauthn/browser';

type Passkey = { id: string; createdAt: string | Date; worksHere: boolean; rpId: string | null };

export function ProfileClient({ passkeys }: { passkeys: Passkey[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function registerPasskey() {
    setBusy(true);
    setMsg(null);
    try {
      const optionsRes = await fetch('/api/auth/passkey/register/options', { method: 'POST' });
      if (!optionsRes.ok) throw new Error(await optionsRes.text());
      const options = await optionsRes.json();

      const attestation = await startRegistration({ optionsJSON: options });

      const verifyRes = await fetch('/api/auth/passkey/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attestation),
      });
      const data = await verifyRes.json();
      if (!verifyRes.ok || !data.verified) throw new Error(data.error || 'Не удалось зарегистрировать');
      setMsg({ ok: true, text: 'Устройство привязано' });
      router.refresh();
    } catch (e) {
      const text = e instanceof Error ? e.message : 'Ошибка';
      setMsg({ ok: false, text });
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('Удалить это устройство?')) return;
    setBusy(true);
    try {
      await fetch(`/api/auth/passkey/delete?id=${id}`, { method: 'DELETE' });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <div className="card__title">
        <span className="card__title-text">🔐 Устройства для входа (Touch ID / Face ID)</span>
        <button type="button" className="btn btn--primary btn--sm" onClick={registerPasskey} disabled={busy}>
          {busy ? '…' : '+ Привязать это устройство'}
        </button>
      </div>

      {msg && (
        <div className={`banner ${msg.ok ? 'banner--success' : 'banner--error'}`} style={{ marginBottom: 12 }}>
          {msg.text}
        </div>
      )}

      {passkeys.length === 0 ? (
        <div className="empty-state">Нет привязанных устройств. Привяжи это устройство — потом входи без кода.</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase' }}>
              <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>ID</th>
              <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Привязано</th>
              <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Работает здесь</th>
              <th style={{ padding: '8px', width: 40, borderBottom: '1px solid var(--border)' }}></th>
            </tr>
          </thead>
          <tbody>
            {passkeys.map((p) => (
              <tr key={p.id}>
                <td style={{ padding: '8px', borderBottom: '1px solid var(--border)', fontFamily: 'monospace', color: 'var(--text-muted)', fontSize: 12 }}>{p.id.slice(0, 8)}…</td>
                <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>{new Date(p.createdAt).toLocaleString('ru-RU')}</td>
                <td style={{ padding: '8px', borderBottom: '1px solid var(--border)', color: p.worksHere ? 'var(--success)' : 'var(--text-muted)' }}>
                  {p.worksHere ? 'да' : p.rpId ? `нет · ${p.rpId}` : 'нет · старый сайт'}
                </td>
                <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>
                  <button type="button" className="btn btn--danger btn--icon" onClick={() => remove(p.id)} disabled={busy}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
