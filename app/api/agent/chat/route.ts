import Anthropic from '@anthropic-ai/sdk';
import { requireSession } from '@/lib/auth-session';
import { getCurrentFilialIds } from '@/lib/current-filial';
import { resolveIikoCreds } from '@/lib/filial-iiko';
import { db, schema } from '@/db/client';
import { eq } from 'drizzle-orm';
import { TOOLS, TOOL_LABELS, runTool } from '@/lib/agent/tools';
import { buildSystemPrompt } from '@/lib/agent/prompt';

export const dynamic = 'force-dynamic';
// 60 с — потолок бесплатного плана Vercel. Больше указывать нельзя: сборка
// падает с «maxDuration must be between 1 and 60». Если перейдёте на Pro,
// здесь можно поднять до 300.
export const maxDuration = 60;

const MODEL = 'claude-opus-5';
const MAX_ITERATIONS = 12;

export async function POST(request: Request) {
  const session = await requireSession();
  if (session.role.split(':')[0] !== 'admin') {
    return Response.json({ error: 'Доступ только для администратора' }, { status: 403 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: 'ANTHROPIC_API_KEY не задан в переменных окружения' }, { status: 500 });
  }

  const filialIds = await getCurrentFilialIds();
  if (filialIds.length === 0) return Response.json({ error: 'Филиал не выбран' }, { status: 400 });
  const filialId = filialIds[0];

  let body: { messages?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Некорректный JSON' }, { status: 400 });
  }

  const history = Array.isArray(body?.messages) ? body.messages : [];
  if (history.length === 0) return Response.json({ error: 'Пустая история сообщений' }, { status: 400 });

  const { xml: creds } = await resolveIikoCreds(filialId);
  const [filial] = await db.select({ name: schema.filials.name }).from(schema.filials).where(eq(schema.filials.id, filialId)).limit(1);

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        } catch {
          // Поток уже закрыт клиентом — молча выходим.
        }
      };

      // Наружу уходят только role+text; tool_use/tool_result живут внутри
      // одного запроса и в историю клиента не попадают.
      const messages: Anthropic.MessageParam[] = (history as { role?: string; content?: unknown }[])
        .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.content)
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: String(m.content) }));

      try {
        for (let i = 0; i < MAX_ITERATIONS; i++) {
          const iterStream = client.messages.stream({
            model: MODEL,
            max_tokens: 32000,
            system: [{ type: 'text', text: buildSystemPrompt(filial?.name), cache_control: { type: 'ephemeral' } }],
            tools: TOOLS as Anthropic.Tool[],
            messages,
          });

          iterStream.on('text', (delta) => send({ type: 'text', text: delta }));

          const message = await iterStream.finalMessage();

          const toolUses = message.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
          if (toolUses.length === 0) break;

          for (const t of toolUses) send({ type: 'tool', label: TOOL_LABELS[t.name] || `Вызываю ${t.name}` });

          messages.push({ role: 'assistant', content: message.content });

          // Инструменты бьют в iiko OLAP — гоняем параллельно, иначе три разреза
          // подряд это три минуты ожидания.
          const results: Anthropic.ToolResultBlockParam[] = await Promise.all(
            toolUses.map(async (t) => ({
              type: 'tool_result' as const,
              tool_use_id: t.id,
              content: JSON.stringify(await runTool(t.name, t.input, creds)),
            }))
          );
          messages.push({ role: 'user', content: results });

          if (i === MAX_ITERATIONS - 1) {
            send({ type: 'error', message: 'Достигнут лимит шагов. Задай вопрос точнее, пожалуйста.' });
          }
        }
        send({ type: 'done' });
      } catch (e) {
        console.error('[agent/chat]', e);
        const status = (e as { status?: number })?.status;
        const msg =
          status === 401 ? 'Неверный ANTHROPIC_API_KEY.'
          : status === 429 ? 'Превышен лимит запросов к Claude API, попробуй через минуту.'
          : e instanceof Error ? e.message : String(e);
        send({ type: 'error', message: msg });
        send({ type: 'done' });
      } finally {
        try {
          controller.close();
        } catch {
          // Уже закрыт.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
