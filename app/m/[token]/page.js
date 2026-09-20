export const dynamic = "force-dynamic";

/**
 * Что видит человек, наведя на QR руководителя обычную камеру.
 *
 * Ни имени, ни лимита, ни остатка: код носят с собой, его может отсканировать
 * кто угодно. Данные отдаются только внутри сайта, кассиру под его сессией.
 */
export default function ManagerQrPage() {
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
      <div style={{ textAlign: "center", maxWidth: 340 }}>
        <div style={{ fontSize: 44, marginBottom: 14 }}>🍽</div>
        <div style={{ fontSize: 16, fontWeight: 600 }}>Код для обедов</div>
        <div style={{ color: "#64748b", fontSize: 14, marginTop: 10, lineHeight: 1.6 }}>
          Покажите этот код кассиру
        </div>
      </div>
    </div>
  );
}
