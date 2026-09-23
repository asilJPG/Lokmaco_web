/**
 * POST /api/iiko/ai-recognize-product
 * AI Vision product recognition with comprehensive synonyms and full-catalog multi-match
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

    const systemPrompt = `Ты — эксперт по распознаванию товаров склада и ингредиентов для ресторана-кафе Lokmaco (Ташкент).
Определи, что за продукт/ингредиент на фото (овощи, фрукты, мясо, молочка, бакалея, упаковка, соусы и т.д.).

ОБЯЗАТЕЛЬНО возвращай:
1. "detected_item": Точное описание предмета на русском (например: Картофель бэби / мини чери, Помидоры черри, Молоко сгущенное, Сливки 33%).
2. "short_name": Основное существительное (например: Картошка, Помидор, Сгущенка, Сливки, Масло, Мука).
3. "keywords": Массив из 3-6 синонимов и ключевых слов на русском, включая формы слова и разновидности (например: для картошки -> ["картошка", "картофель", "чери", "бэби", "деревенская", "фри"]).

Отвечай СТРОГО валидным JSON без markdown:
{
  "detected_item": "...",
  "short_name": "...",
  "keywords": ["...", "..."],
  "brand": "..."
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
                  { type: "text", text: "Определи продукт на фото и верни синонимы в JSON:" },
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

    const detectedItem = aiParsed.detected_item || aiParsed.short_name || "";
    const shortName = aiParsed.short_name || detectedItem;
    const rawKeywords = Array.isArray(aiParsed.keywords) ? aiParsed.keywords : [shortName, detectedItem];

    // Comprehensive synonym dictionary for restaurant warehouse items
    const SYNONYM_MAP = {
      "картофель": ["картошка", "картоф", "картош", "бэби", "чери", "фри", "деревенская"],
      "картошка": ["картофель", "картоф", "картош", "бэби", "чери", "фри", "деревенская"],
      "помидор": ["помидоры", "томат", "томаты", "чери", "черри"],
      "томат": ["томаты", "помидор", "помидоры", "чери", "черри"],
      "черри": ["чери", "помидор", "картошка", "бэби"],
      "чери": ["черри", "помидор", "картошка", "бэби"],
      "бэби": ["беби", "чери", "черри", "маленькая"],
      "молоко": ["сгущенка", "сгущенное", "молоко", "сливки"],
      "сгущенка": ["сгущенное", "молоко сгущенное", "варенка"],
      "сыр": ["моцарелла", "пармезан", "чеддер", "гауда", "сулугуни", "фета", "творог"],
      "клубника": ["ягода", "клубника", "голубика", "малина"],
      "масло": ["сливочное", "растительное", "подсолнечное", "оливковое", "масло"],
      "курица": ["цыпленок", "филе", "грудка", "крылья", "бедро", "куриное", "птица"],
      "мясо": ["говядина", "стейк", "вырезка", "фарш", "ягненок"],
    };

    const tokenSet = new Set();
    const addTokens = (str) => {
      String(str).toLowerCase().split(/[\s,.\-()"/]+/).forEach(t => {
        if (t.length >= 3) tokenSet.add(t);
      });
    };

    addTokens(detectedItem);
    addTokens(shortName);
    rawKeywords.forEach(addTokens);

    // Expand with synonym dictionary
    Array.from(tokenSet).forEach(t => {
      for (const [key, syns] of Object.entries(SYNONYM_MAP)) {
        if (t.includes(key) || key.includes(t)) {
          syns.forEach(s => tokenSet.add(s));
        }
      }
    });

    const allTokens = Array.from(tokenSet);

    // Score all products in candidateList
    const scored = (candidateList || []).map((p) => {
      const pName = (p.name || "").toLowerCase();
      const pGroup = (p.groupName || "").toLowerCase();
      let score = 0;

      // Direct exact match
      if (pName === shortName.toLowerCase() || pName === detectedItem.toLowerCase()) {
        score += 250;
      }
      if (pName.includes(shortName.toLowerCase())) {
        score += 100;
      }
      if (detectedItem.toLowerCase().includes(pName)) {
        score += 90;
      }

      // Token matching
      for (const token of allTokens) {
        if (pName.includes(token)) {
          score += 40;
          if (pName.startsWith(token)) score += 20;
          // Exact word match
          const words = pName.split(/[\s,.\-()"/]+/);
          if (words.includes(token)) score += 30;
        }
        if (pGroup.includes(token)) score += 15;
      }

      // Brand bonus
      if (aiParsed.brand && pName.includes(aiParsed.brand.toLowerCase())) {
        score += 60;
      }

      return { id: p.id, name: p.name, score };
    });

    scored.sort((a, b) => b.score - a.score);
    // Return top 5 matching varieties
    const topMatches = scored.filter(s => s.score >= 35).slice(0, 5);

    // Best primary search term
    let bestSearchTerm = shortName;
    if (shortName.toLowerCase().includes("картоф") || shortName.toLowerCase().includes("картош")) {
      bestSearchTerm = "картош";
    } else if (shortName.toLowerCase().includes("помидор") || shortName.toLowerCase().includes("томат")) {
      bestSearchTerm = "помидор";
    }

    return Response.json({
      success: true,
      detected_item: detectedItem,
      short_name: shortName,
      search_keyword: bestSearchTerm,
      matched_product_ids: topMatches.map(m => m.id),
      brand: aiParsed.brand || "",
    });
  } catch (err) {
    console.error("[/api/iiko/ai-recognize-product]", err);
    return Response.json({ error: err.message || "Внутренняя ошибка AI" }, { status: 500 });
  }
}
