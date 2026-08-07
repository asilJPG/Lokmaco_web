import { requireSession } from '@/lib/auth-session';
import { canAccess } from '@/lib/access';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * «Проверить почту сейчас».
 *
 * Gmail не умеет толкать письма на сайт, а фоновый таймер в Apps Script чаще
 * раза в минуту не запускается. Стоять минуту у принтера — ровно то, чего мы
 * избегаем, поэтому кнопка зовёт скрипт напрямую: он забирает письмо и
 * отправляет скан немедленно.
 *
 * Секрет уходит в параметре, но наружу не светится: запрос делает сервер,
 * а не браузер. Из клиента адрес скрипта и секрет не видны вовсе.
 */
export async function POST() {
  const session = await requireSession();
  if (!canAccess(session.role, 'invoice')) {
    return Response.json({ error: 'Доступ запрещен для вашей роли' }, { status: 403 });
  }

  const url = process.env.GMAIL_SCRIPT_URL;
  const secret = process.env.INBOUND_SCAN_SECRET;
  if (!url || !secret) {
    // Не ошибка: почтовый мост может быть просто не настроен, а очередь при
    // этом работает — сканы приедут по таймеру.
    return Response.json({ ok: false, configured: false });
  }

  try {
    const res = await fetch(`${url}?secret=${encodeURIComponent(secret)}`, {
      // Apps Script отвечает редиректом на googleusercontent — идём за ним.
      redirect: 'follow',
      cache: 'no-store',
      signal: AbortSignal.timeout(45_000),
    });
    const text = await res.text();
    let data: { ok?: boolean; sent?: number; error?: string } = {};
    try { data = JSON.parse(text); } catch { /* скрипт мог вернуть HTML ошибки */ }

    if (!res.ok || data.ok === false) {
      console.error('[scans/refresh] Apps Script', res.status, text.slice(0, 300));
      return Response.json({ ok: false, configured: true, error: data.error || `Скрипт ответил ${res.status}` }, { status: 502 });
    }
    return Response.json({ ok: true, configured: true, sent: Number(data.sent) || 0 });
  } catch (e) {
    return Response.json(
      { ok: false, configured: true, error: e instanceof Error ? e.message : 'Скрипт не ответил' },
      { status: 502 }
    );
  }
}
