import jpeg from "jpeg-js";
import jsQR from "jsqr";
import { parseFiscalQr } from "./fiscal-receipt.js";

/**
 * Чтение QR налоговой с готового JPEG — на сервере.
 *
 * В браузере то же самое делает `readReceiptQr` через canvas. На сервере
 * canvas и sharp нет (и тянуть нативный модуль ради этого не стали), поэтому
 * JPEG раскладывается в пиксели чистым JS-декодером. Фото в хранилище уже
 * сжаты браузером до 1600 px, так что декодировать приходится немного.
 */

// Потолок памяти декодера: чужой гигантский файл не должен класть функцию.
// Меньше 256 нельзя: на 128 декодер отбрасывал кадры выше ~2000×2700 — а
// именно такими бывают оригиналы, если сжатие в браузере не сработало.
const MAX_DECODE_MB = 256;

/** Усредняет блоки пикселей — уменьшение «как canvas», без ступенек. */
function boxDownscale(src, w, h, tw, th) {
  const out = new Uint8ClampedArray(tw * th * 4);
  const xr = w / tw;
  const yr = h / th;
  for (let y = 0; y < th; y++) {
    const y0 = Math.floor(y * yr);
    const y1 = Math.min(h, Math.max(y0 + 1, Math.floor((y + 1) * yr)));
    for (let x = 0; x < tw; x++) {
      const x0 = Math.floor(x * xr);
      const x1 = Math.min(w, Math.max(x0 + 1, Math.floor((x + 1) * xr)));
      let r = 0, g = 0, b = 0, n = 0;
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * w + xx) * 4;
          r += src[i]; g += src[i + 1]; b += src[i + 2]; n++;
        }
      }
      const o = (y * tw + x) * 4;
      out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = 255;
    }
  }
  return out;
}

/** Признаёт JPEG по сигнатуре, а не по заявленному типу — тип присылает клиент. */
export function isJpeg(buffer) {
  return buffer?.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

/**
 * Ищет QR налоговой на JPEG и возвращает реквизиты чека или null.
 * Не бросает: битый файл — это просто «не нашли».
 */
export function readReceiptQrFromJpeg(buffer) {
  if (!isJpeg(buffer)) return null;

  let img;
  try {
    img = jpeg.decode(buffer, { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: MAX_DECODE_MB });
  } catch {
    return null;
  }

  const { width, height, data } = img;
  const longest = Math.max(width, height);

  // Как и в браузере: то, что побольше, и то, что поменьше — на уменьшенном
  // кадре мелкий код иногда читается лучше, чем на полном.
  const sides = [1600, 1000].filter((side, i, all) => {
    const eff = Math.min(side, longest);
    return all.findIndex((x) => Math.min(x, longest) === eff) === i;
  });

  for (const side of sides) {
    const scale = Math.min(1, side / longest);
    const tw = Math.max(1, Math.round(width * scale));
    const th = Math.max(1, Math.round(height * scale));
    const pixels = scale === 1 ? data : boxDownscale(data, width, height, tw, th);

    const code = jsQR(new Uint8ClampedArray(pixels.buffer, pixels.byteOffset, pixels.length), tw, th, {
      inversionAttempts: "dontInvert",
    });
    if (code?.data) {
      const receipt = parseFiscalQr(code.data);
      if (receipt) return receipt;
    }
  }
  return null;
}
