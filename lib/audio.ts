/**
 * Запись голоса в браузере → WAV 16 кГц моно.
 *
 * Почему не `webkitSpeechRecognition`: он есть не везде (Firefox, часть
 * Android-вебвью, встроенные браузеры мессенджеров — а снабженец открывает
 * ссылку именно оттуда), а там, где есть, узнаёт русско-узбекскую смесь с
 * названиями продуктов заметно хуже и не даёт подсказать ему словарь.
 *
 * Почему не `MediaRecorder`: формат у него разный по платформам (Chrome —
 * webm/opus, Safari — mp4/aac), и мы бы зависели от того, какие контейнеры
 * согласится принять модель. Здесь мы сами собираем WAV: он собирается
 * одинаково везде, где вообще есть getUserMedia, и принимается без оговорок.
 *
 * 16 кГц моно — то, что нужно распознавалке, и вчетверо меньше байт, чем
 * дефолтные 44.1 кГц: на мобильном интернете это разница между «отправилось»
 * и «крутится».
 */

export const TARGET_SAMPLE_RATE = 16000;

/** Дальше запись сама останавливается: минута с лишним диктовки — это уже 3 МБ и потолок тела запроса. */
export const MAX_RECORDING_SECONDS = 90;

export function isRecordingSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const hasMedia = Boolean(navigator.mediaDevices?.getUserMedia);
  const hasAudioCtx = Boolean(window.AudioContext || (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext);
  return hasMedia && hasAudioCtx;
}

export type Recorder = {
  /** Останавливает запись, глушит микрофон и отдаёт готовый WAV. */
  stop: () => Promise<Blob>;
  /** Сколько секунд уже записано — для таймера на кнопке. */
  elapsed: () => number;
};

export async function startRecording(onAutoStop?: () => void): Promise<Recorder> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  // iOS отдаёт контекст в состоянии suspended, пока его не разбудить жестом —
  // мы уже внутри обработчика клика, так что resume здесь сработает.
  if (ctx.state === 'suspended') await ctx.resume();

  const source = ctx.createMediaStreamSource(stream);
  // ScriptProcessor устарел, но AudioWorklet требует отдельного файла-модуля по
  // URL, а этот узел есть во всех браузерах, включая Safari на iOS.
  const node = ctx.createScriptProcessor(4096, 1, 1);
  const chunks: Float32Array[] = [];
  let length = 0;
  let stopped = false;
  const startedAt = Date.now();

  node.onaudioprocess = (e) => {
    if (stopped) return;
    const input = e.inputBuffer.getChannelData(0);
    chunks.push(new Float32Array(input));
    length += input.length;
  };
  source.connect(node);
  // Без подключения к destination узел не тикает в Chrome. Громкость нулевая,
  // иначе микрофон будет слышно в динамике.
  const mute = ctx.createGain();
  mute.gain.value = 0;
  node.connect(mute);
  mute.connect(ctx.destination);

  function teardown() {
    stopped = true;
    node.onaudioprocess = null;
    try { source.disconnect(); node.disconnect(); mute.disconnect(); } catch { /* уже отключено */ }
    stream.getTracks().forEach((t) => t.stop());
    void ctx.close();
  }

  const stop = async (): Promise<Blob> => {
    if (timer) clearTimeout(timer);
    const rate = ctx.sampleRate;
    teardown();
    const merged = new Float32Array(length);
    let offset = 0;
    for (const c of chunks) { merged.set(c, offset); offset += c.length; }
    return encodeWav(downsample(merged, rate, TARGET_SAMPLE_RATE), TARGET_SAMPLE_RATE);
  };

  let timer: ReturnType<typeof setTimeout> | null = null;
  if (onAutoStop) timer = setTimeout(onAutoStop, MAX_RECORDING_SECONDS * 1000);

  return { stop, elapsed: () => Math.floor((Date.now() - startedAt) / 1000) };
}

/** Линейное усреднение соседних сэмплов: для речи этого достаточно, а кода — десять строк. */
function downsample(input: Float32Array, from: number, to: number): Float32Array {
  if (to >= from) return input;
  const ratio = from / to;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(Math.floor((i + 1) * ratio), input.length);
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    out[i] = end > start ? sum / (end - start) : 0;
  }
  return out;
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // моно
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // байт в секунду
  view.setUint16(32, 2, true); // выравнивание блока
  view.setUint16(34, 16, true); // бит на сэмпл
  writeStr(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([view], { type: 'audio/wav' });
}
