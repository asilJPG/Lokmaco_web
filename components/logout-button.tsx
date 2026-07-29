'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      type="button"
      onClick={logout}
      disabled={busy}
      className="btn btn--sm"
    >
      {busy ? 'Выход…' : 'Выйти'}
    </button>
  );
}
