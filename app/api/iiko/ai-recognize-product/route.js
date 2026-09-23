/**
 * POST /api/iiko/ai-recognize-product
 * AI Vision product recognition for incoming goods
 */

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let base64Image = "";
    let candidateList = [];

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file");
      const candidatesRaw = formData.get("candidates");
      if (candidatesRaw) {
        try { candidateList = JSON.parse(candidatesRaw); } catch (e) {}
      }
      if (file && typeof file === "object" && file.arrayBuffer) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const mimeType = file.type || "image/jpeg";
        base64Image = `data:${mimeType};base64,${buffer.toString("base64")}`;
      }
    } else {
      const json = await req.json().catch(() => ({}));
      base64Image = json.image || "";
      candidateList = json.candidates || [];
    }

    if (!base64Image) {
      return Response.json({ error: "Изображение не предоставлено" }, { status: 400 });
    }

    const openRouterKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterKey) {
      return Response.json({
        success: true,
        detected_name: "Не удалось подключить AI ключ",
        search_keyword: "",
        matches: [],
      });
    }

    // Compact list of products for matching
    const sampleCandidates = (candidateList || []).slice(0, 300).map(p => ({
      id: p.id,
      name: p.name,
      group: p.groupName || ""
    }));

    const systemPrompt = `Ты — AI-помощник кладовщика в кафе-кондитерской Lokmaco (Узбекистан, Ташкент).
Твоя задача — определить, какой товар/ингредиент/упаковка изображен на фотографии, и найти 1-3 самых подходящих совпадений в номенклатуре склада iiko.

Отвечай СТРОГО валидным JSON объектом (без кавычек markdown, без \`\`\`json):
{
  "detected_item": "Название распознанного товара на русском (например: Клубника свежая, Сливки 33%, Сыр Моцарелла, Пакет крафтовый)",
  "search_keyword": "Основное поисковое слово на русском (например: Клубника)",
  "matched_product_ids": ["id1", "id2"],
  "explanation": "Краткое пояснение"
}`;

    const userPrompt = `Список доступных товаров на складе (id, name, group):\n${JSON.stringify(sampleCandidates.slice(0, 200))}\n\nПожалуйста, определи продукт на фото и выбери подходящие ID.`;

    const modelsToTry = [
      "google/gemini-2.5-flash",
      "openai/gpt-4o-mini"
    ];

    let lastError = "";
    for (const model of modelsToTry) {
      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openRouterKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://lokmaco.uz",
            "X-Title": "Lokmaco Warehouse Vision",
          },
          body: JSON.stringify({
            model: model,
            messages: [
              { role: "system", content: systemPrompt },
              {
                role: "user",
                content: [
                  { type: "text", text: userPrompt },
                  {
                    type: "image_url",
                    image_url: {
                      url: base64Image,
                    },
                  },
                ],
              },
            ],
            temperature: 0.2,
            max_tokens: 400,
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          console.error(`[AI Vision Error] Model ${model} failed with ${response.status}:`, errText);
          lastError = `${model}: ${response.status}`;
          continue;
        }

        const resData = await response.json();
        let content = resData.choices?.[0]?.message?.content || "{}";
        
        // Strip markdown code fences if present
        content = content.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/\s*```$/, "").trim();

        let parsed = {};
        try {
          parsed = JSON.parse(content);
        } catch (e) {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0]);
          }
        }

        return Response.json({
          success: true,
          detected_item: parsed.detected_item || "",
          search_keyword: parsed.search_keyword || "",
          matched_product_ids: parsed.matched_product_ids || [],
          explanation: parsed.explanation || "",
        });
      } catch (e) {
        console.error(`[AI Vision Exception] ${model}:`, e);
        lastError = e.message;
      }
    }

    return Response.json({
      success: false,
      error: `Не удалось распознать товар (${lastError})`,
      detected_item: "",
      search_keyword: "",
      matched_product_ids: [],
    });
  } catch (err) {
    console.error("[/api/iiko/ai-recognize-product]", err);
    return Response.json({ error: err.message || "Внутренняя ошибка AI" }, { status: 500 });
  }
}
