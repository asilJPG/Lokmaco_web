/**
 * Сжатие фото на телефоне перед отправкой.
 *
 * Снимок с камеры весит 3–8 МБ. Отправлять его как есть нельзя дважды: на
 * мобильном интернете загрузка тянется минуту и рвётся, а тело запроса упрётся
 * в лимит платформы. 1600px по длинной стороне и jpeg 0.8 дают 150–400 КБ —
 * этого хватает, чтобы прочитать рукописную накладную с фото.
 */

const MAX_SIDE = 1600;
const QUALITY = 0.8;

export async function compressImage(file: File): Promise<File> {
  const bitmap = await loadBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, w, h);
  if ('close' in bitmap && typeof bitmap.close === 'function') bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
  // Если canvas по какой-то причине не отдал blob — лучше отправить оригинал,
  // чем потерять фото: размер всё равно проверит сервер.
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  // createImageBitmap сам разворачивает EXIF-ориентацию — иначе фото с телефона
  // ложится боком. В Safari его может не быть, там падаем на <img>.
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    } catch {
      /* ниже запасной путь */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Не удалось прочитать изображение'));
      img.src = url;
    });
  } finally {
    // Отзываем в микротаске после onload — до этого браузер ещё читает по url.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
