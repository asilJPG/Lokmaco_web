/**
 * POST /api/iiko/parse
 *
 * Mirrors bot.py parse_with_ai() exactly:
 *   1. Load products from iiko
 *   2. Send to OpenRouter with same prompt (including total-sum logic)
 *   3. Local matching: find product_id by name (exact → partial → word overlap)
 *   4. Return [{product_id, product_name, quantity, unit, price}]
 *
 * Body: { text: "помидоры 50кг 600000\nлук 30 кг 150000" }
 */

import { withIikoSession, iikoGetJson } from "@/lib/iiko";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "google/gemma-4-27b-it:free";

export async function POST(request) {
  try {
    const { text } = await request.json();
    if (!text?.trim()) {
      return Response.json({ error: "No text" }, { status: 400 });
    }

    // 1. Load products from iiko
    const products = await withIikoSession(async (token) => {
      const data = await iikoGetJson("v2/entities/products/list", token);
      if (!data) return [];
      return data
        .filter((p) => p.type === "GOODS")
        .map((p) => ({ id: p.id, name: p.name, type: p.type, mainUnit: p.mainUnit }));
    });

    if (!products.length) {
      return Response.json({ error: "No products from iiko" }, { status: 500 });
    }

    // 2. Send to OpenRouter (exact same prompt as bot.py)
    const namesStr = products.map((p) => p.name).join(", ");
    const prompt = `Ты парсер накладных. Распарси текст, сматчи с товарами из списка. Нет цены — 0. Нет единицы — угадай.
ВАЖНО: если пользователь указал число после количества — это ОБЩАЯ СУММА за весь товар, НЕ цена за единицу. Раздели сумму на количество чтобы получить price.
Пример: "помидоры 50кг 600000" → quantity=50, price=12000 (600000/50)
Пример: "молоко 10л 450000" → quantity=10, price=45000 (450000/10)
ТЕКСТ: ${text}
ТОВАРЫ: ${namesStr}
ОТВЕТ JSON массив без markdown: [{"product_name":"точное название из списка","quantity":50,"unit":"кг","price":12000}]`;

    const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
      }),
    });

    if (!aiRes.ok) {
      return Response.json({ error: "OpenRouter API error" }, { status: 502 });
    }

    const aiData = await aiRes.json();
    let content = aiData.choices?.[0]?.message?.content?.trim() || "";

    // Strip markdown fences (same as bot.py)
    if (content.startsWith("```")) content = content.split("\n").slice(1).join("\n");
    if (content.endsWith("```")) content = content.slice(0, -3);

    let items;
    try {
      items = JSON.parse(content.trim());
    } catch {
      return Response.json({ error: "AI returned invalid JSON", raw: content }, { status: 422 });
    }

    // 3. Local matching — exact same logic as bot.py
    for (const item of items) {
      const aiName = (item.product_name || "").toLowerCase().trim();
      let bestMatch = null;
      let bestScore = 0;

      for (const p of products) {
        const pName = p.name.toLowerCase().trim();

        // Exact match
        if (aiName === pName) {
          bestMatch = p;
          break;
        }

        // Partial match
        let score = 0;
        if (aiName.includes(pName) || pName.includes(aiName)) {
          score = aiName.length / Math.max(pName.length, 1);
        } else {
          // Word overlap
          const aiWords = new Set(aiName.split(/\s+/));
          const pWords = new Set(pName.split(/\s+/));
          const common = [...aiWords].filter((w) => pWords.has(w));
          if (common.length > 0) {
            const union = new Set([...aiWords, ...pWords]);
            score = common.length / Math.max(union.size, 1);
          }
        }

        if (score > bestScore) {
          bestScore = score;
          bestMatch = p;
        }
      }

      if (bestMatch) {
        item.product_id = bestMatch.id;
        item.product_name = bestMatch.name;
      } else {
        item.product_id = "";
      }
    }

    return Response.json(items);
  } catch (e) {
    console.error("[/api/iiko/parse]", e.message);
    return Response.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
