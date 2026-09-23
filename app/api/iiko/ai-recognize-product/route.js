import { withIikoSession, iikoGetJson } from "@/lib/iiko";

export const dynamic = "force-dynamic";

// Helper: Normalize Russian/Uzbek/English words (lowercase, ё->е, remove punctuation)
function normalizeStr(str) {
  return String(str || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Common warehouse equipment/non-consumable words to penalize when recognizing ingredients
const UTENSIL_PENALTY_WORDS = [
  "мясорубка", "молоток", "нож", "доска", "гастроемкость", "чомич",
  "лопатка", "венчик", "блендер", "миксер", "весы", "корзина для",
  "ведро", "швабра", "дозатор", "диспенсер", "термометр", "щипцы"
];

// Rich restaurant & warehouse synonyms dictionary (Russian, Uzbek, Turkish, English, Brand names)
const COMPREHENSIVE_SYNONYMS = {
  // Картофель / Картошка
  "картофель": ["картошка", "картоф", "картош", "бэби", "беби", "чери", "черри", "фри", "деревенская", "маленькая"],
  "картошка": ["картофель", "картоф", "картош", "бэби", "беби", "чери", "черри", "фри", "деревенская", "маленькая"],
  "фри": ["картошка фри", "картофель фри", "french fries"],

  // Помидоры / Томаты
  "помидор": ["помидоры", "томат", "томаты", "чери", "черри", "маленькие"],
  "помидоры": ["помидор", "томат", "томаты", "чери", "черри"],
  "томат": ["томаты", "помидор", "помидоры", "чери", "черри", "паста", "кетчуп"],
  "черри": ["чери", "помидор", "картошка", "бэби", "маленькая"],
  "чери": ["черри", "помидор", "картошка", "бэби", "маленькая"],

  // Молочка / Сыры / Сливки
  "молоко": ["сгущенка", "сгущенное", "кокосовое", "пастеризованное", "молоко", "сливки"],
  "сгущенка": ["сгущенное", "молоко сгущенное", "варенка", "сгущенка"],
  "сливки": ["сливки", "шанти", "bavetti", "баветти", "взбитые", "пенка", "фрима", "cream", "parmalat"],
  "шанти": ["сливки", "баветти", "bavetti", "крем"],
  "сыр": ["моцарелла", "motsarella", "cremette", "kremetti", "креметти", "творожный", "пармезан", "сулугуни", "strachatella", "страчателла", "фета", "чеддер", "сваля", "гурман", "сырники"],
  "cremette": ["kremetti", "креметти", "творожный", "сыр", "хохланд", "hochland"],
  "kremetti": ["cremette", "креметти", "творожный", "сыр", "хохланд"],
  "моцарелла": ["motsarella", "mozzarella", "сыр"],

  // Масла / Жиры
  "масло": ["подсолнечное", "растительное", "фритюрное", "фресок", "fresco", "сливочное", "маргарин", "щедрое лето", "шедрое", "оливковое"],
  "фритюрное": ["масло", "фресок", "fresco", "растительное", "подсолнечное"],
  "маргарин": ["шедрое", "щедрое лето", "сливочное", "масло"],

  // Бакалея / Выпечка / Десерты
  "разрыхлитель": ["кабартма", "kabartma", "пекарский", "порошок"],
  "кабартма": ["разрыхлитель", "kabartma", "порошок"],
  "мука": ["пшеничная", "в/с", "первый сорт", "макфа", "хлопья"],
  "крахмал": ["кукурузный", "картофельный"],
  "сахар": ["песок", "рафинад", "пудра", "тростниковый"],
  "ванилин": ["ваниль", "ванильный"],
  "какао": ["шоколад", "порошок", "какао-порошок"],
  "шоколад": ["шоколадный", "молочный", "темный", "белый", "callebaut", "колип", "топинг", "дропсы"],
  "тапиока": ["тапиока", "bubble", "бабл", "шарики"],

  // Фрукты / Ягоды
  "клубника": ["ягода", "клубника", "замороженная", "свежая"],
  "малина": ["ягода", "малина"],
  "голубика": ["ягода", "голубика"],
  "банан": ["бананы"],
  "лимон": ["лайм", "лимоны"],
  "апельсин": ["апельсины", "цитрус"],
  "яблоко": ["яблоки"],

  // Мясо / Птица
  "курица": ["куриное", "филе", "грудка", "цыпленок", "кур", "бедро", "крылья", "птица", "пф"],
  "филе": ["куриное", "кур", "рыба", "грудка"],
  "мясо": ["говядина", "баранина", "фарш", "мачетте", "стейк", "вырезка"],

  // Упаковка / Хозтовары / Расходники (включая UZ/TR термины)
  "перчатки": ["перчатка", "нитрил", "нитриловые", "черные", "прозрачные", "галактика", "мехли", "киммат", "розовый"],
  "перчатка": ["перчатки", "нитрил", "черные", "прозрачные", "галактика", "мехли", "киммат"],
  "салфетки": ["салфетка", "elma", "эльма", "бумажные", "влажные", "дисп", "horeca", "hermetic"],
  "салфетка": ["салфетки", "elma", "бумажные", "диспенсер"],
  "стакан": ["стаканчик", "bubble", "кофе", "мороженое", "z96", "крышка", "манжет", "крафт"],
  "стаканчик": ["стакан", "bubble", "кофе", "мороженое", "z96"],
  "коробка": ["бокс", "вафли", "панкейк", "котта", "кичкина", "love", "ланчбокс", "упаковка"],
  "пакет": ["фасовочный", "майка", "крафт", "п/э"],
  "трубочки": ["соломка", "соломинка", "трубка", "черные", "bubble"],
};

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

    // If candidate list wasn't provided, fetch live goods from iiko directly
    if (!candidateList || candidateList.length === 0) {
      try {
        candidateList = await withIikoSession(async (token) => {
          const [data, groups] = await Promise.all([
            iikoGetJson("v2/entities/products/list?includeDeleted=false", token),
            iikoGetJson("v2/entities/products/group/list?includeDeleted=false", token).catch(() => []),
          ]);
          const groupMap = {};
          (groups || []).forEach((g) => { if (g && g.id) groupMap[g.id] = g.name; });
          return (data || [])
            .filter((p) => (p.type === "GOODS" || p.type === "PREPARED") && !p.deleted)
            .map((p) => ({
              id: p.id,
              name: p.name,
              group: groupMap[p.parent] || "",
              mainUnit: p.mainUnit || "шт",
            }));
        });
      } catch (e) {
        console.warn("[ai-recognize-product] Could not load iiko goods fallback:", e.message);
      }
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

    const systemPrompt = `Ты — эксперт-товаровед сети кафе Lokmaco (Ташкент).
Твоя задача — точно распознать товар/ингредиент/упаковку на фотографии склада ресторана и предоставить все возможные ключевые слова, синонимы, словоформы и кулинарные термины (на русском, узбекском, турецком и латинице), как они могут называться в номенклатуре iiko.

Примеры наименований в нашей iiko:
- Овощи: "Помидор", "Помидор чери", "Картошка", "Картошка маленькая (чери)", "Картошка фри", "Лук зеленый"
- Молочка/Сыры: "Сыр Kremetti творожный", "Сыр Motsarella 40%", "Сливочное масло", "Сгущенное молоко", "Молоко 3,2%", "Сливки 27%", "Шанти Баветти"
- Масла: "Масло подсолнечное", "Фритюрное масло фресок", "Маргарин шедрое лето(сливочное масло)"
- Бакалея/Десерты: "Кабартма", "Кукурузный крахмал", "Шоколад молочный", "Тапиока классическая", "Ванилин"
- Упаковка/Расходники: "Перчатка черные", "Мехли перчатка киммат", "Перчатки прозрачные", "Бумажные салфетки Elma", "Коробка вафли", "Коробка I U котта", "Коробка I U кичкина", "Стакан BUBBLE"

ОБЯЗАТЕЛЬНО верни валидный JSON без markdown:
{
  "detected_item": "Полное физическое описание предмета (например: Помидоры черри свежие / Сыр творожный Cremette / Картофель бэби / Разрыхлитель теста Кабартма / Перчатки нитриловые черные)",
  "short_name": "Главное базовое слово (например: Помидор / Картошка / Сыр / Масло / Сливки / Перчатки / Коробка / Салфетки / Кабартма / Мука)",
  "keywords": ["массив", "из", "8-15", "синонимов", "и", "терминов", "включая", "бренды", "и", "узбекские", "слова"],
  "category": "Овощи/Молочка/Сыры/Масла/Бакалея/Мясо/Упаковка/Напитки/Десерты",
  "is_equipment": false
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
                  { type: "text", text: "Определи продукт/товар на фото и верни JSON со всеми синонимами для iiko:" },
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
            max_tokens: 400,
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
    const rawKeywords = Array.isArray(aiParsed.keywords) ? aiParsed.keywords : [];
    const isEquipment = Boolean(aiParsed.is_equipment);

    // 1. Build rich token and stem pool
    const tokenSet = new Set();
    const stemSet = new Set();

    const processWord = (raw) => {
      const norm = normalizeStr(raw);
      if (!norm) return;
      norm.split(/\s+/).forEach((w) => {
        if (w.length >= 2) {
          tokenSet.add(w);
          if (w.length >= 4) {
            stemSet.add(w.slice(0, 4));
            stemSet.add(w.slice(0, 5));
          }
        }
      });
    };

    processWord(detectedItem);
    processWord(shortName);
    rawKeywords.forEach(processWord);

    // 2. Expand with COMPREHENSIVE_SYNONYMS
    Array.from(tokenSet).forEach((t) => {
      for (const [key, synList] of Object.entries(COMPREHENSIVE_SYNONYMS)) {
        if (t.includes(key) || key.includes(t)) {
          synList.forEach(processWord);
        }
      }
    });

    const allTokens = Array.from(tokenSet);
    const allStems = Array.from(stemSet);
    const normShortName = normalizeStr(shortName);
    const normDetected = normalizeStr(detectedItem);

    // 3. Intelligent Scoring against all candidates
    const scored = (candidateList || []).map((p) => {
      const pNameNorm = normalizeStr(p.name);
      const pGroupNorm = normalizeStr(p.group || p.groupName);
      let score = 0;

      // Penalize utensils/equipment if we are recognizing food ingredients
      if (!isEquipment) {
        for (const badW of UTENSIL_PENALTY_WORDS) {
          if (pNameNorm.includes(badW)) {
            score -= 200;
            break;
          }
        }
      }

      // Exact name matches
      if (pNameNorm === normShortName || pNameNorm === normDetected) {
        score += 300;
      } else if (pNameNorm.startsWith(normShortName) && normShortName.length >= 3) {
        score += 150;
      } else if (pNameNorm.includes(normShortName) && normShortName.length >= 3) {
        score += 100;
      }

      // Token matches
      const pWords = pNameNorm.split(/\s+/);
      for (const token of allTokens) {
        if (token.length < 3) continue;

        if (pWords.includes(token)) {
          // Exact full word match in product name
          score += 45;
        } else if (pNameNorm.includes(token)) {
          // Substring match in product name
          score += 25;
        }

        if (pGroupNorm && pGroupNorm.includes(token)) {
          score += 15;
        }
      }

      // Stem matching (catches word forms: помидор/помидоры, картошка/картофельный, салфетка/салфетки)
      for (const stem of allStems) {
        if (stem.length >= 4 && pNameNorm.includes(stem)) {
          score += 18;
        }
      }

      return { id: p.id, name: p.name, score };
    });

    // Filter to positive scores and sort descending
    const positiveMatches = scored
      .filter((s) => s.score >= 40)
      .sort((a, b) => b.score - a.score);

    // Return top 8 logical matches
    const topMatches = positiveMatches.slice(0, 8);

    // Determine the cleanest, most representative search keyword for catalog filtering
    let searchKeyword = normShortName;
    if (searchKeyword.includes("картоф") || searchKeyword.includes("картош")) {
      searchKeyword = "картош";
    } else if (searchKeyword.includes("помидор") || searchKeyword.includes("томат")) {
      searchKeyword = "помидор";
    } else if (searchKeyword.includes("перчат")) {
      searchKeyword = "перчат";
    } else if (searchKeyword.includes("салфет")) {
      searchKeyword = "салфет";
    } else if (searchKeyword.includes("сыр")) {
      searchKeyword = "сыр";
    } else if (searchKeyword.includes("молок") || searchKeyword.includes("сгущен")) {
      searchKeyword = "молок";
    } else if (searchKeyword.includes("масл")) {
      searchKeyword = "масл";
    } else if (searchKeyword.includes("коробк")) {
      searchKeyword = "коробк";
    } else if (searchKeyword.includes("стакан")) {
      searchKeyword = "стакан";
    } else if (topMatches.length > 0 && normShortName.length < 3) {
      searchKeyword = normalizeStr(topMatches[0].name).split(/\s+/)[0] || "";
    }

    return Response.json({
      success: true,
      detected_item: detectedItem,
      short_name: shortName,
      search_keyword: searchKeyword,
      matched_product_ids: topMatches.map((m) => m.id),
      brand: aiParsed.brand || "",
    });
  } catch (err) {
    console.error("[/api/iiko/ai-recognize-product]", err);
    return Response.json({ error: err.message || "Внутренняя ошибка AI" }, { status: 500 });
  }
}

