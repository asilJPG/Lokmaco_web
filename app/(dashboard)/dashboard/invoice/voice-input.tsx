'use client';

import { useEffect, useRef, useState } from 'react';
import { MAX_RECORDING_SECONDS, isRecordingSupported, startRecording, type Recorder } from '@/lib/audio';

/**
 * Диктовка накладной.
 *
 * Распознанный текст НЕ уходит в парсер сам: он попадает в то же поле, что и
 * набранный руками, и человек его правит. Речь распознаётся с ошибками, а на
 * выходе — документ в бухгалтерию; молча доверять распознаванию нельзя.
 */
export function VoiceInput({ onText, disabled }: { onText: (text: string) => void; disabled?: boolean }) {
  const [supported, setSupported] = useState(true);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<Recorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Проверяем в эффекте, а не при рендере: на сервере navigator нет, и
  // несовпадение разметки уронило бы гидрацию.
  useEffect(() => { setSupported(isRecordingSupported()); }, []);

  // Уход со страницы во время записи должен глушить микрофон: отдельного
  // cancel у рекордера нет, поэтому останавливаем и выбрасываем результат.
  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    recorderRef.current?.stop().catch(() => {});
  }, []);

  function stopTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setSeconds(0);
  }

  async function begin() {
    setError(null);
    try {
      const rec = await startRecording(() => { void finish(); });
      recorderRef.current = rec;
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось включить микрофон');
    }
  }

  async function finish() {
    const rec = recorderRef.current;
    if (!rec) return;
    recorderRef.current = null;
    setRecording(false);
    stopTimer();
    setBusy(true);
    try {
      const blob = await rec.stop();
      const form = new FormData();
      form.append('audio', blob, 'voice.webm');
      const res = await fetch('/api/transcribe', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok || !data.text) {
        setError(data.error || 'Не удалось распознать речь');
        return;
      }
      onText(String(data.text).trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка распознавания');
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    recorderRef.current?.stop().catch(() => {});
    recorderRef.current = null;
    setRecording(false);
    stopTimer();
  }

  if (!supported) {
    return (
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '8px 0 0' }}>
        Этот браузер не даёт записывать звук — набери текст руками.
      </p>
    );
  }

  return (
    <div style={{ marginTop: 8 }}>
      {!recording ? (
        <button type="button" className="btn" onClick={begin} disabled={disabled || busy}>
          {busy ? '⏳ Распознаю…' : '🎤 Записать голосом'}
        </button>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="rec-dot" aria-hidden="true" />
          <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
            {String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}
          </span>
          <button type="button" className="btn btn--primary btn--sm" onClick={finish}>⏹ Готово</button>
          <button type="button" className="btn btn--sm" onClick={cancel}>Отмена</button>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            максимум {MAX_RECORDING_SECONDS} сек
          </span>
        </div>
      )}
      {error && <div className="banner banner--error" style={{ marginTop: 8 }}>{error}</div>}
      {!recording && !busy && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '6px 0 0' }}>
          Наговори позиции подряд: «помидоры пятьдесят кило шестьсот тысяч». Текст появится в поле выше — проверь его перед распознаванием позиций.
        </p>
      )}
    </div>
  );
}
