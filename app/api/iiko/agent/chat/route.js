import Anthropic from "@anthropic-ai/sdk";
import { TOOLS, TOOL_LABELS, runTool } from "@/lib/agent/tools";
import { buildSystemPrompt } from "@/lib/agent/prompt";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MODEL = "claude-opus-5";
const MAX_ITERATIONS = 12;

export async function POST(request) {
  const userId = request.headers.get("x-user-id");
  const userRole = request.headers.get("x-user-role") || "";
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [baseRole] = userRole.split(":");
  if (baseRole !== "admin") {
    return Response.json({ error: "Доступ только для администратора" }, { status: 403 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY не задан в переменных окружения" },
      { status: 500 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const history = Array.isArray(body?.messages) ? body.messages : [];
  if (history.length === 0) {
    return Response.json({ error: "Пустая история сообщений" }, { status: 400 });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        } catch {
          // поток уже закрыт клиентом — молча выходим
        }
      };

      // Собираем историю в формат API. Из клиента приходит только role+text;
      // tool_use/tool_result блоки живут внутри одного запроса и наружу не уходят.
      const messages = history
        .filter((m) => m && (m.role === "user" || m.role === "assistant") && m.content)
        .map((m) => ({ role: m.role, content: String(m.content) }));

      try {
        for (let i = 0; i < MAX_ITERATIONS; i++) {
          const iterStream = client.messages.stream({
            model: MODEL,
            max_tokens: 32000,
            thinking: { type: "adaptive" },
            system: [
              {
                type: "text",
                text: buildSystemPrompt(),
                cache_control: { type: "ephemeral" },
              },
            ],
            tools: TOOLS,
            messages,
          });

          iterStream.on("text", (delta) => send({ type: "text", text: delta }));

          const message = await iterStream.finalMessage();

          if (message.stop_reason === "refusal") {
            send({ type: "error", message: "Модель отклонила запрос." });
            break;
          }

          const toolUses = message.content.filter((b) => b.type === "tool_use");
          if (toolUses.length === 0) break;

          for (const t of toolUses) {
            send({ type: "tool", label: TOOL_LABELS[t.name] || `Вызываю ${t.name}` });
          }

          messages.push({ role: "assistant", content: message.content });

          // Инструменты бьют в iiko OLAP — гоняем параллельно, иначе три разреза
          // подряд это три минуты ожидания
          const results = await Promise.all(
            toolUses.map(async (t) => ({
              type: "tool_result",
              tool_use_id: t.id,
              content: JSON.stringify(await runTool(t.name, t.input)),
            }))
          );

          messages.push({ role: "user", content: results });

          if (i === MAX_ITERATIONS - 1) {
            send({
              type: "error",
              message: "Достигнут лимит шагов. Задай вопрос уже, пожалуйста.",
            });
          }
        }

        send({ type: "done" });
      } catch (e) {
        console.error("[agent/chat] error:", e);
        const msg =
          e?.status === 401
            ? "Неверный ANTHROPIC_API_KEY."
            : e?.status === 429
              ? "Превышен лимит запросов к Claude API, попробуй через минуту."
              : String(e?.message || e);
        send({ type: "error", message: msg });
        send({ type: "done" });
      } finally {
        try {
          controller.close();
        } catch {
          // уже закрыт
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
