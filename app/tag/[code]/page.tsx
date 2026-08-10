import { normalizeTagCode } from '@/lib/asset-tags';

export const dynamic = 'force-dynamic';

/**
 * Страница, которую видит обычная камера телефона.
 *
 * ⚠️ Никаких данных об оборудовании здесь нет и быть не должно: наклейки висят
 * в зале и на кухне, их сканируют гости и линейный персонал, а стоимость
 * оборудования — не та информация, которую стоит показывать всем подряд.
 * Что это за предмет, видно только внутри сайта, после входа.
 */
export default function TagPublicPage({ params }: { params: { code: string } }) {
  const code = normalizeTagCode(params.code) || '—';

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f172a',
      color: '#e2e8f0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
    }}>
      <div style={{ textAlign: 'center', maxWidth: 360 }}>
        <div style={{ fontSize: 44, marginBottom: 14 }}>🏷</div>
        <div style={{ fontFamily: 'monospace', fontSize: 24, fontWeight: 700, letterSpacing: 1 }}>{code}</div>
        <div style={{ color: '#64748b', fontSize: 14, marginTop: 12, lineHeight: 1.6 }}>
          Инвентарная наклейка оборудования
        </div>
      </div>
    </div>
  );
}
