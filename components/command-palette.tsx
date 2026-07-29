'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Item = { href: string; label: string; icon: string; group: string; adminOnly?: boolean };

const ITEMS: Item[] = [
  { href: '/dashboard', label: 'Главная', icon: '🏠', group: 'Навигация' },
  { href: '/dashboard/assistant', label: 'Ассистент', icon: '✨', group: 'Навигация', adminOnly: true },
  { href: '/dashboard/cashier', label: 'Закрыть смену', icon: '🧾', group: 'Смена' },
  { href: '/dashboard/inbox', label: 'Подтверждения', icon: '📨', group: 'Смена' },
  { href: '/dashboard/history', label: 'История смен', icon: '🗂️', group: 'Смена' },
  { href: '/dashboard/balances', label: 'Остатки', icon: '📦', group: 'Склад' },
  { href: '/dashboard/transfer', label: 'Перемещение', icon: '🔄', group: 'Склад' },
  { href: '/dashboard/invoice', label: 'Приход накладной', icon: '🚚', group: 'Склад' },
  { href: '/dashboard/inventory', label: 'Инвентаризация', icon: '📋', group: 'Склад' },
  { href: '/dashboard/production', label: 'Приготовление', icon: '🍳', group: 'Склад' },
  { href: '/dashboard/documents', label: 'Документы iiko', icon: '📑', group: 'Склад' },
  { href: '/dashboard/iiko-analytics', label: 'Обзор и продажи', icon: '📊', group: 'Аналитика' },
  { href: '/dashboard/menu-analytics', label: 'Меню и food cost', icon: '🍽', group: 'Аналитика' },
  { href: '/dashboard/menu-analytics?tab=prices', label: 'Закупки и цены', icon: '🏷', group: 'Аналитика' },
  { href: '/dashboard/reconciliation', label: 'Сверка с кассой', icon: '🧮', group: 'Аналитика', adminOnly: true },
  { href: '/dashboard/safe', label: 'Сейф', icon: '💰', group: 'Финансы' },
  { href: '/dashboard/wages', label: 'Зарплаты', icon: '👥', group: 'Финансы' },
  { href: '/dashboard/pnl', label: 'P&L', icon: '📈', group: 'Финансы' },
  { href: '/dashboard/profile', label: 'Профиль', icon: '🙂', group: 'Настройки' },
  { href: '/dashboard/admin/users', label: 'Пользователи', icon: '👤', group: 'Настройки', adminOnly: true },
  { href: '/dashboard/admin/filials', label: 'Филиалы', icon: '🏢', group: 'Настройки', adminOnly: true },
];

function fuzzyMatch(haystack: string, needle: string): boolean {
  if (!needle) return true;
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase().trim();
  if (h.includes(n)) return true;
  // simple subsequence match
  let i = 0;
  for (const ch of h) {
    if (ch === n[i]) i++;
    if (i === n.length) return true;
  }
  return false;
}

export function CommandPalette({ isAdmin }: { isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [enabled, setEnabled] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 769px) and (pointer: fine)');
    const update = () => setEnabled(mql.matches);
    update();
    mql.addEventListener?.('change', update);
    return () => mql.removeEventListener?.('change', update);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, enabled]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const filtered = useMemo(() => {
    return ITEMS.filter((it) => (!it.adminOnly || isAdmin) && fuzzyMatch(it.label + ' ' + it.group, query));
  }, [query, isAdmin]);

  useEffect(() => {
    if (active >= filtered.length) setActive(0);
  }, [filtered.length, active]);

  if (!enabled || !open) return null;

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={() => setOpen(false)}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(2px)',
        zIndex: 100,
        display: 'flex',
        justifyContent: 'center',
        paddingTop: 'min(15vh, 120px)',
        padding: '15vh 16px 16px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 560,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-md)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '70vh',
        }}
      >
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'var(--text-faint)' }}>🔎</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, filtered.length - 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              else if (e.key === 'Enter') { e.preventDefault(); const it = filtered[active]; if (it) go(it.href); }
            }}
            placeholder="Перейти к разделу…"
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 15,
              color: 'var(--text)',
            }}
          />
          <kbd style={{ fontSize: 11, color: 'var(--text-faint)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px' }}>esc</kbd>
        </div>
        <div style={{ overflowY: 'auto', padding: 6 }}>
          {filtered.length === 0 ? (
            <div className="empty-state">Ничего не найдено</div>
          ) : (
            filtered.map((it, i) => (
              <button
                key={it.href}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(it.href)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  width: '100%',
                  padding: '10px 12px',
                  border: 'none',
                  background: i === active ? 'var(--surface-muted)' : 'transparent',
                  borderRadius: 'var(--radius-sm)',
                  textAlign: 'left',
                  color: 'var(--text)',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 18, width: 22, textAlign: 'center' }}>{it.icon}</span>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{it.label}</span>
                <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{it.group}</span>
              </button>
            ))
          )}
        </div>
        <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-faint)', display: 'flex', gap: 12, justifyContent: 'space-between' }}>
          <span>↑↓ выбор · ↵ перейти</span>
          <span>⌘K открыть</span>
        </div>
      </div>
    </div>
  );
}
