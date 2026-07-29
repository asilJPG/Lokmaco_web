'use client';

import { useState } from 'react';

export function Copyable({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  if (!value) return <span>—</span>;
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }
  return (
    <button
      type="button"
      onClick={copy}
      title={copied ? 'Скопировано' : 'Скопировать'}
      style={{
        background: 'transparent',
        border: 'none',
        color: 'inherit',
        font: 'inherit',
        padding: 0,
        cursor: 'pointer',
        textDecoration: copied ? 'none' : 'underline dotted transparent',
        textUnderlineOffset: 3,
        transition: 'color 120ms, text-decoration-color 120ms',
      }}
      onMouseEnter={(e) => { (e.currentTarget.style as any).textDecorationColor = 'currentColor'; }}
      onMouseLeave={(e) => { (e.currentTarget.style as any).textDecorationColor = 'transparent'; }}
    >
      {label ?? value} {copied && <span style={{ color: 'var(--success)', marginLeft: 4 }}>✓</span>}
    </button>
  );
}
