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

    // Prepare a compact list of product names and IDs for matching
    const sampleCandidates = (candidateList || []).slice(0, 400).map(p => ({
      id: p.id,
      name: p.name,
      group: p.groupName || ""
    }));

    const systemPrompt = `Ты — AI-помощник кладовщика в кафе-кондитерской Lokmaco (Узбекистан, Ташкент).
Твоя задача — внимательно посмотреть на присланную фотографию товара/ингредиента/упаковки и определить, что это за продукт.
Затем сопоставить его с базой номенклатуры iiko и вернуть ТОП-3 наиболее подходящих товара из предоставленного списка.

Если точного совпадения нет, подбери 3 самых близких по смыслу и назначению товара из списка.
Также верни ключевое поисковое слово на русском языке (search_keyword).

Отвечай СТРОГО в формате JSON без markdown-разметки:
{
  "detected_item": "Краткое распознанное описание предмета на фото на русском",
  "search_keyword": "Слово для текстового поиска по каталогу (например: Клубника, Сыр, Сливки, Молоко, Коробка, Сахар)",
  "matched_product_ids": ["id1", "id2", "id3"],
  "explanation": "Почему выбраны эти товары"
}`;

    const userPrompt = `Список доступных товаров на складе (id, name, group):\n${JSON.stringify(sampleCandidates.slice(0, 250))}\n\nПожалуйста, определи товар на фото и выбери подходящие ID.`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openRouterKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://lokmaco.uz",
        "X-Title": "Lokmaco Warehouse",
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-001",
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
        max_tokens: 500,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[AI Vision Error]", response.status, errText);
      return Response.json({
        success: false,
        error: "Ошибка AI распознавания",
        detected_item: "",
        search_keyword: "",
        matched_product_ids: [],
      });
    }

    const resData = await response.json();
    const content = resData.choices?.[0]?.message?.content || "{}";
    
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
  } catch (err) {
    console.error("[/api/iiko/ai-recognize-product]", err);
    return Response.json({ error: err.message || "Внутренняя ошибка AI" }, { status: 500 });
  }
}
