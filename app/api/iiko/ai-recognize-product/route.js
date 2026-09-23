/**
 * POST /api/iiko/ai-recognize-product
 * AI Vision product recognition with full-catalog fuzzy matching
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
        detected_item: "",
        search_keyword: "",
        matched_product_ids: [],
      });
    }

    const systemPrompt = `Ты — эксперт по распознаванию продуктов питания, напитков, ингредиентов и упаковки для кафе/ресторана Lokmaco.
Внимательно посмотри на фото товара (упаковка, этикетка, банка, коробка, фрукт, сыр, напиток и т.д.).
Определи точный продукт и верни валидный JSON БЕЗ markdown разметки:
{
  "detected_item": "Полное название на русском (например: Сгущенное молоко цельное с сахаром, Сливки Parmalat 33%, Сыр Моцарелла, Клубника свежая)",
  "short_name": "Короткое обиходное название (например: Сгущенка, Сливки, Моцарелла, Клубника, Коробка, Сахар)",
  "keywords": ["сгущенка", "сгущенное", "сгущенное молоко", "молоко сгущенка"],
  "brand": "Бренд (если есть, напр. Алексеевское, Parmalat, President)",
  "category_guess": "Овощи/Фрукты/Молочка/Бакалея/Мясо/Упаковка/Напитки"
}`;

    const modelsToTry = [
      "google/gemini-2.5-flash",
      "openai/gpt-4o-mini"
    ];

    let aiParsed = null;
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
                  { type: "text", text: "Определи продукт на фото и верни JSON:" },
                  {
                    type: "image_url",
                    image_url: {
                      url: base64Image,
                    },
                  },
                ],
              },
            ],
            temperature: 0.1,
            max_tokens: 300,
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          console.error(`[AI Vision] ${model} failed (${response.status}):`, errText);
          lastError = `${model}: ${response.status}`;
          continue;
        }

        const resData = await response.json();
        let content = resData.choices?.[0]?.message?.content || "{}";
        content = content.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/\s*```$/, "").trim();

        try {
          aiParsed = JSON.parse(content);
          if (aiParsed.detected_item || aiParsed.short_name) break;
        } catch (e) {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            aiParsed = JSON.parse(jsonMatch[0]);
            if (aiParsed.detected_item || aiParsed.short_name) break;
          }
        }
      } catch (e) {
        console.error(`[AI Vision Exception] ${model}:`, e);
        lastError = e.message;
      }
    }

    if (!aiParsed) {
      return Response.json({
        success: false,
        error: `Не удалось распознать изображение (${lastError})`,
        detected_item: "",
        search_keyword: "",
        matched_product_ids: [],
      });
    }

    // Full catalog matching across all candidate products
    const detectedItem = aiParsed.detected_item || aiParsed.short_name || "";
    const shortName = aiParsed.short_name || detectedItem;
    const keywords = Array.isArray(aiParsed.keywords) ? aiParsed.keywords : [shortName, detectedItem];

    // Score all products in candidateList
    const queryTokens = [
      ...detectedItem.toLowerCase().split(/[\s,.-]+/),
      ...shortName.toLowerCase().split(/[\s,.-]+/),
      ...keywords.flatMap(k => String(k).toLowerCase().split(/[\s,.-]+/)),
    ].filter(t => t.length >= 3);

    const scored = (candidateList || []).map((p) => {
      const pName = (p.name || "").toLowerCase();
      const pGroup = (p.groupName || "").toLowerCase();
      let score = 0;

      // 1. Exact string matches
      if (pName === shortName.toLowerCase() || pName === detectedItem.toLowerCase()) {
        score += 200;
      }
      if (pName.includes(shortName.toLowerCase())) {
        score += 90;
      }
      if (detectedItem.toLowerCase().includes(pName)) {
        score += 80;
      }

      // 2. Keyword exact matches
      for (const kw of keywords) {
        const kLow = String(kw).toLowerCase().trim();
        if (!kLow || kLow.length < 2) continue;
        if (pName.includes(kLow)) score += 60;
        if (pGroup.includes(kLow)) score += 20;
      }

      // 3. Token matches
      for (const token of queryTokens) {
        if (pName.includes(token)) {
          score += 35;
          if (pName.startsWith(token)) score += 20;
        }
        if (pGroup.includes(token)) score += 10;
      }

      // 4. Brand match bonus
      if (aiParsed.brand && pName.includes(aiParsed.brand.toLowerCase())) {
        score += 50;
      }

      return { id: p.id, name: p.name, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const topMatches = scored.filter(s => s.score >= 35).slice(0, 4);

    return Response.json({
      success: true,
      detected_item: detectedItem,
      short_name: shortName,
      search_keyword: shortName || keywords[0] || detectedItem,
      matched_product_ids: topMatches.map(m => m.id),
      brand: aiParsed.brand || "",
    });
  } catch (err) {
    console.error("[/api/iiko/ai-recognize-product]", err);
    return Response.json({ error: err.message || "Внутренняя ошибка AI" }, { status: 500 });
  }
}
