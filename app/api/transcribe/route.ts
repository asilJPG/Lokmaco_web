import { requireSession } from '@/lib/auth-session';

export const dynamic = 'force-dynamic';
// Распознавание минуты речи занимает 2–5 с, плюс мобильная загрузка тела.
export const maxDuration = 60;

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
// Мультимодальная модель со входом audio. Проверено по /api/v1/models:
// у gemini-2.5-flash в input_modalities есть audio, и на русско-узбекской
// диктовке накладной она отвечает за ~1.5 с.
const AUDIO_MODEL = process.env.OPENROUTER_AUDIO_MODEL || 'google/gemini-2.5-flash';

// 90 с моно 16 кГц PCM ≈ 2.9 МБ — держимся ниже лимита тела запроса Vercel (4.5 МБ).
const MAX_AUDIO_BYTES = 4 * 1024 * 1024;

// ⚠️ Запрет на выдумывание — не вежливая формальность, а главное требование.
// Проверено: на записи без речи (чистый синус) модель уверенно возвращала
// выдуманную накладную с поставщиком, датой и шестью позициями с ценами.
// Такой ответ выглядит правдоподобно, и человек его не заподозрит.
const NOTHING = 'НЕТ_РЕЧИ';

const PROMPT = `Ты расшифровываешь голосовую диктовку приходной накладной в ресторане в Узбекистане.
Речь русская, с узбекскими словами и названиями продуктов — передавай их как слышишь.

ГЛАВНОЕ ПРАВИЛО: пиши ТОЛЬКО те слова, которые реально слышны в записи.
Никогда не додумывай позиции, поставщиков, даты и цены, которых не было в аудио.
Если в записи нет разборчивой речи (тишина, шум, музыка, гудок) — ответь ровно ${NOTHING} и ничего больше.
Если часть слов не разобрал — так и напиши «(неразборчиво)» вместо них, но не подставляй правдоподобные.

Числа записывай цифрами без пробелов и точек внутри числа (шестьсот тысяч → 600000).
Каждую позицию накладной — с новой строки.
В ответе только распознанный текст, без пояснений и разметки.`;

/**
 * Речь → текст. Текст потом уходит в тот же `/api/iiko/parse`, что и
 * вставленный руками, — отдельного «голосового парсера» нет намеренно:
 * распознанное сначала показывается человеку на правку.
 */
/**
 * Похоже ли это на речь.
 *
 * ⚠️ Нужно потому, что мультимодальная модель на записи без речи не молчит, а
 * ВЫДУМЫВАЕТ правдоподобную накладную — с поставщиком, датой и позициями.
 * Проверено вживую на чистом синусе: вернулись «Огурцы свежие, 10 килограмм»
 * и ещё пять позиций, которых в записи не было. Запретить это промптом до
 * конца не удалось, поэтому такой звук до модели просто не доходит.
 *
 * Признак речи — не громкость, а её ИЗМЕНЧИВОСТЬ: у речи есть слоги и паузы,
 * поэтому энергия по кадрам скачет. У тишины, ровного тона и гула она почти
 * постоянна.
 */
function looksLikeSpeech(wav: Uint8Array): boolean {
  // 44 байта — заголовок WAV, дальше 16-битные сэмплы.
  const samples = new Int16Array(wav.buffer, wav.byteOffset + 44, Math.floor((wav.byteLength - 44) / 2));
  if (samples.length < 16000 * 0.3) return false; // короче 0.3 с — не диктовка

  const frame = 400; // 25 мс при 16 кГц
  const energies: number[] = [];
  for (let i = 0; i + frame <= samples.length; i += frame) {
    let sum = 0;
    for (let j = i; j < i + frame; j++) sum += samples[j] * samples[j];
    energies.push(Math.sqrt(sum / frame));
  }
  if (energies.length < 8) return false;

  const mean = energies.reduce((a, b) => a + b, 0) / energies.length;
  if (mean < 120) return false; // тишина

  const sd = Math.sqrt(energies.reduce((a, e) => a + (e - mean) ** 2, 0) / energies.length);
  // Коэффициент вариации: у речи обычно > 0.4, у ровного тона и белого шума — около нуля.
  return sd / mean > 0.35;
}

export async function POST(req: Request) {
  await requireSession();

  if (!OPENROUTER_API_KEY) {
    return Response.json({ error: 'OPENROUTER_API_KEY не задан' }, { status: 500 });
  }

  // Тело приходит как multipart с полем `audio` (см. VoiceInput). Раньше здесь
  // читался сырой arrayBuffer — в WAV попадали служебные байты multipart,
  // из-за чего проверка на речь пропускала даже тишину.
  let buf: ArrayBuffer;
  const contentType = req.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    const file = form.get('audio');
    if (!(file instanceof File)) return Response.json({ error: 'Файл записи не передан' }, { status: 400 });
    buf = await file.arrayBuffer();
  } else {
    buf = await req.arrayBuffer();
  }
  if (buf.byteLength === 0) return Response.json({ error: 'Пустая запись' }, { status: 400 });
  if (buf.byteLength > MAX_AUDIO_BYTES) {
    return Response.json({ error: 'Запись слишком длинная — говори короче' }, { status: 413 });
  }

  // Клиент всегда шлёт WAV (см. lib/audio.ts): это единственный формат,
  // который получается собрать одинаково во всех браузерах и который
  // OpenRouter принимает без оговорок.
  if (!looksLikeSpeech(new Uint8Array(buf))) {
    return Response.json(
      { error: 'В записи не слышно речи — говори ближе к микрофону и попробуй ещё раз' },
      { status: 422 }
    );
  }

  const data = Buffer.from(buf).toString('base64');

  let aiRes: Response;
  try {
    aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: AUDIO_MODEL,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: PROMPT },
              { type: 'input_audio', input_audio: { data, format: 'wav' } },
            ],
          },
        ],
        temperature: 0,
      }),
    });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'OpenRouter fetch failed' }, { status: 502 });
  }

  if (!aiRes.ok) {
    console.error('[transcribe] OpenRouter', aiRes.status, (await aiRes.text()).slice(0, 300));
    return Response.json({ error: 'Сервис распознавания недоступен' }, { status: 502 });
  }

  const aiData = await aiRes.json();
  const text: string = (aiData?.choices?.[0]?.message?.content || '').trim();
  if (!text || text.toUpperCase().includes(NOTHING)) {
    return Response.json({ error: 'Речь не распознана — говори ближе к микрофону и попробуй ещё раз' }, { status: 422 });
  }

  return Response.json({ text });
}
