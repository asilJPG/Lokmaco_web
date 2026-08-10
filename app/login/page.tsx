'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { startAuthentication } from '@simplewebauthn/browser';

export default function LoginPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [pkLoading, setPkLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/access-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || 'Ошибка входа');
      else {
        router.push('/dashboard');
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  async function loginPasskey() {
    setPkLoading(true);
    setError(null);
    try {
      const optionsRes = await fetch('/api/auth/passkey/login/options', { method: 'POST' });
      if (!optionsRes.ok) throw new Error('Не удалось получить опции');
      const options = await optionsRes.json();
      const assertion = await startAuthentication({ optionsJSON: options });
      const verifyRes = await fetch('/api/auth/passkey/login/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assertion),
      });
      const data = await verifyRes.json();
      if (!verifyRes.ok || !data.verified) throw new Error(data.error || 'Не удалось войти');
      router.push('/dashboard');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setPkLoading(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 16, background: 'var(--bg)' }}>
      <div className="card" style={{ width: 360, maxWidth: '100%' }}>
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>Lokmaco</h1>
        <p className="page-subtitle" style={{ marginBottom: 20 }}>Войди в систему</p>

        <button type="button" className="btn" onClick={loginPasskey} disabled={pkLoading || loading} style={{ width: '100%', marginBottom: 16, padding: '12px' }}>
          🔐 {pkLoading ? 'Подтвердите на устройстве…' : 'Войти через Face ID / Touch ID'}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0 16px', color: 'var(--text-faint)', fontSize: 12 }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span>или код</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        <form onSubmit={submit}>
          <div className="field">
            <input
              autoFocus
              type="password"
              // ⚠️ Не `inputMode="numeric"`. Пока коды были из четырёх цифр,
              // цифровая клавиатура экономила пару касаний; с буквенным кодом
              // она просто не даёт войти с телефона — на буквы не переключиться.
              autoComplete="current-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="код"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="input"
              style={{ fontSize: 18, padding: '14px 16px', textAlign: 'center', letterSpacing: 4 }}
            />
          </div>
          {error && <div className="banner banner--error" style={{ marginTop: 12 }}>{error}</div>}
          <button type="submit" disabled={loading || code.length < 4} className="btn btn--primary" style={{ width: '100%', marginTop: 16 }}>
            {loading ? 'Проверка…' : 'Войти'}
          </button>
        </form>
      </div>
    </main>
  );
}
