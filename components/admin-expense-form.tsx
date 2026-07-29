'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function AdminExpenseForm({ defaultDate, defaultFilialId }: { defaultDate: string; defaultFilialId: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(defaultDate);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/admin-expense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, name, amount: Number(amount), filialId: defaultFilialId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || 'Ошибка');
      } else {
        setName('');
        setAmount('');
        setOpen(false);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn btn--primary btn--sm" onClick={() => setOpen(true)}>
        + Добавить расход из сейфа
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="card" style={{ background: 'var(--surface-muted)', borderStyle: 'dashed' }}>
      <div className="card__title">
        <span className="card__title-text">➕ Новый расход из сейфа</span>
        <button type="button" className="btn btn--sm btn--ghost" onClick={() => setOpen(false)}>Отмена</button>
      </div>
      <div className="grid grid--auto">
        <div className="field">
          <label className="field__label">Дата</label>
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="field">
          <label className="field__label">Название</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="ЗП, аренда, бозорлик…" />
        </div>
        <div className="field">
          <label className="field__label">Сумма</label>
          <input type="number" inputMode="numeric" className="input input--number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
          <span className="field__hint" style={{ textAlign: 'right', visibility: (parseFloat(amount) || 0) >= 1000 ? 'visible' : 'hidden' }}>
            = {(parseFloat(amount) || 0).toLocaleString('ru-RU')} сум
          </span>
        </div>
      </div>
      {err && <div className="banner banner--error" style={{ marginTop: 12 }}>{err}</div>}
      <button type="submit" className="btn btn--primary" disabled={busy || !name || !amount} style={{ marginTop: 12 }}>
        {busy ? 'Сохранение…' : 'Сохранить'}
      </button>
    </form>
  );
}

export function DeleteExpenseButton({ id }: { id: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function del() {
    if (!confirm('Удалить расход?')) return;
    setBusy(true);
    try {
      await fetch(`/api/admin-expense?id=${id}`, { method: 'DELETE' });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className="btn btn--danger btn--icon" onClick={del} disabled={busy} title="Удалить">×</button>
  );
}
