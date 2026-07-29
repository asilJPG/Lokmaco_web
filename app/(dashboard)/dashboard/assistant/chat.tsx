'use client';

import { useEffect, useRef, useState } from 'react';

type Msg = { role: 'user' | 'assistant'; content: string };

const SUGGESTIONS = [
  'Как прошёл прошлый месяц?',
  'Какие блюда съедают маржу?',
  'Сравни эту неделю с прошлой',
  'На что больше всего потратили?',
];

/** Very small Markdown subset: bold, headings, bullets, tables. */
function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n');
  const out: React.ReactNode[] = [];
  let table: string[][] = [];

  const flushTable = (key: number) => {
    if (table.length === 0) return;
    const [head, ...rows] = table;
    out.push(
      <div key={`t${key}`} style={{ overflowX: 'auto', margin: '8px 0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              {head.map((h, i) => (
                <th key={i} style={{ padding: '6px 8px', textAlign: i === 0 ? 'left' : 'right', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri}>
                {r.map((c, ci) => (
                  <td key={ci} style={{ padding: '6px 8px', textAlign: ci === 0 ? 'left' : 'right', borderBottom: '1px solid var(--border)', fontFamily: ci === 0 ? undefined : 'var(--font-num)', whiteSpace: 'nowrap' }}>
                    {inline(c)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    table = [];
  };

  function inline(s: string): React.ReactNode {
    const parts = s.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((p, i) =>
      p.startsWith('**') && p.endsWith('**') ? <b key={i}>{p.slice(2, -2)}</b> : <span key={i}>{p}</span>
    );
  }

  lines.forEach((line, i) => {
    const isTableRow = /^\s*\|.*\|\s*$/.test(line);
    if (isTableRow) {
      const cells = line.trim().slice(1, -1).split('|').map((c) => c.trim());
      // The |---|---| separator carries no data.
      if (!cells.every((c) => /^:?-+:?$/.test(c))) table.push(cells);
      return;
    }
    flushTable(i);

    if (!line.trim()) return;
    if (/^#{1,3}\s/.test(line)) {
      out.push(<div key={i} style={{ fontWeight: 700, marginTop: 10, marginBottom: 2 }}>{inline(line.replace(/^#{1,3}\s/, ''))}</div>);
    } else if (/^\s*[-*•]\s/.test(line)) {
      out.push(
        <div key={i} style={{ display: 'flex', gap: 8, marginTop: 2 }}>
          <span style={{ color: 'var(--text-faint)' }}>•</span>
          <span>{inline(line.replace(/^\s*[-*•]\s/, ''))}</span>
        </div>
      );
    } else {
      out.push(<div key={i} style={{ marginTop: 4 }}>{inline(line)}</div>);
    }
  });
  flushTable(lines.length);
  return out;
}

export function AssistantChat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [tool, setTool] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, tool]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;

    const next: Msg[] = [...messages, { role: 'user', content: q }];
    setMessages(next);
    setInput('');
    setBusy(true);
    setError(null);
    setTool(null);

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      });

      if (!res.ok || !res.body) {
        const text = await res.text();
        let msg = `Ошибка ${res.status}`;
        try { msg = JSON.parse(text).error || msg; } catch {}
        setError(msg);
        setBusy(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let answer = '';
      // The assistant bubble is appended once, then grown in place as deltas arrive.
      setMessages([...next, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() || '';

        for (const chunk of chunks) {
          const line = chunk.trim();
          if (!line.startsWith('data:')) continue;
          let ev: { type: string; text?: string; label?: string; message?: string };
          try { ev = JSON.parse(line.slice(5).trim()); } catch { continue; }

          if (ev.type === 'text' && ev.text) {
            answer += ev.text;
            setTool(null);
            setMessages([...next, { role: 'assistant', content: answer }]);
          } else if (ev.type === 'tool') {
            setTool(ev.label || 'Считаю…');
          } else if (ev.type === 'error') {
            setError(ev.message || 'Ошибка');
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось получить ответ');
    } finally {
      setBusy(false);
      setTool(null);
    }
  }

  return (
    <div className="grid" style={{ gap: 12 }}>
      {messages.length === 0 && (
        <section className="card">
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Спроси про свои цифры</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
            Ассистент сам сходит в iiko, посчитает и объяснит. Данные только читает — ничего не меняет.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" className="btn btn--sm" onClick={() => ask(s)}>{s}</button>
            ))}
          </div>
        </section>
      )}

      {messages.map((m, i) => (
        <div key={i} className={m.role === 'user' ? 'chat-msg chat-msg--user' : 'chat-msg'}>
          {m.role === 'user' ? m.content : renderMarkdown(m.content)}
        </div>
      ))}

      {tool && (
        <div className="chat-tool">
          <span className="chat-tool__spinner" /> {tool}
        </div>
      )}
      {busy && !tool && messages[messages.length - 1]?.role === 'user' && (
        <div className="chat-tool"><span className="chat-tool__spinner" /> Думаю…</div>
      )}
      {error && <div className="banner banner--error">{error}</div>}

      <div ref={endRef} />

      <form
        onSubmit={(e) => { e.preventDefault(); ask(input); }}
        style={{ display: 'flex', gap: 8, position: 'sticky', bottom: 0, background: 'var(--bg)', paddingTop: 8 }}
      >
        <input
          className="input"
          placeholder="Например: сколько заработали на прошлой неделе?"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
        />
        <button type="submit" className="btn btn--primary" disabled={busy || !input.trim()}>
          {busy ? '…' : 'Спросить'}
        </button>
        {messages.length > 0 && !busy && (
          <button type="button" className="btn" onClick={() => { setMessages([]); setError(null); }}>Очистить</button>
        )}
      </form>
    </div>
  );
}
