export const dynamic = "force-dynamic";

/**
 * Раньше здесь была полная карточка ОС — со стоимостью и МОЛ. Страница
 * открывается по QR со старых стикеров, то есть её видит любой, кто навёл
 * камеру: гость, курьер, линейный сотрудник. Показывать им стоимость
 * оборудования незачем, поэтому данные убраны.
 *
 * Что это за предмет, теперь смотрят на сайте: «Основные средства» →
 * «Найти по QR».
 */
export default function AssetPublicPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        color: "#e2e8f0",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 360 }}>
        <div style={{ fontSize: 44, marginBottom: 14 }}>🏷</div>
        <div style={{ fontSize: 15, color: "#94a3b8", lineHeight: 1.6 }}>
          Инвентарная наклейка оборудования
        </div>
      </div>
    </div>
  );
}
