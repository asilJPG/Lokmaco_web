import { getAssetById } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const fmtMoney = (amount) => {
  if (amount === null || amount === undefined || amount === "") return "—";
  return new Intl.NumberFormat("ru-RU").format(Math.round(Number(amount) || 0)) + " сум";
};

const STATUS = {
  in_use: { label: "🟢 В эксплуатации", color: "#10b981" },
  repair: { label: "🟡 В ремонте", color: "#f59e0b" },
  in_stock: { label: "🔵 На складе", color: "#3b82f6" },
  written_off: { label: "🔴 Списан", color: "#ef4444" },
  sold: { label: "⚪ Продан", color: "#6b7280" },
};

export default async function AssetPublicPage({ params }) {
  const asset = await getAssetById(params.id);

  const wrap = {
    minHeight: "100vh",
    background: "#0f172a",
    color: "#e2e8f0",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    padding: "24px 16px",
  };

  if (!asset) {
    return (
      <div style={wrap}>
        <div style={{ maxWidth: 440, width: "100%", textAlign: "center", background: "#1e293b", borderRadius: 16, padding: 32, border: "1px solid #334155" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>❓</div>
          <h1 style={{ fontSize: 20, margin: "0 0 8px 0" }}>Оборудование не найдено</h1>
          <p style={{ color: "#94a3b8", fontSize: 14, margin: 0 }}>
            Стикер устарел или запись была удалена из базы. Инв. код: <b>{params.id}</b>
          </p>
        </div>
      </div>
    );
  }

  const st = STATUS[asset.status] || STATUS.in_use;
  const invNum = asset.inv_number || `EQ-${String(asset.id).slice(0, 6)}`;

  const row = (label, value) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "12px 0", borderBottom: "1px solid #334155" }}>
      <span style={{ color: "#94a3b8", fontSize: 14 }}>{label}</span>
      <span style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 600, textAlign: "right" }}>{value || "—"}</span>
    </div>
  );

  return (
    <div style={wrap}>
      <div style={{ maxWidth: 440, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 1 }}>🍩 Lokma &amp; Co</div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Карточка основного средства</div>
        </div>

        <div style={{ background: "#1e293b", borderRadius: 16, padding: 24, border: "1px solid #334155" }}>
          <div style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 800, color: "#818cf8", background: "#312e81", display: "inline-block", padding: "4px 12px", borderRadius: 8, marginBottom: 12 }}>
            {invNum}
          </div>

          <h1 style={{ fontSize: 22, margin: "0 0 6px 0", color: "#fff" }}>{asset.name}</h1>

          <div style={{ display: "inline-block", padding: "4px 12px", borderRadius: 20, fontSize: 13, fontWeight: 700, background: st.color + "22", color: st.color, marginBottom: 16 }}>
            {st.label}
          </div>

          <div>
            {row("Категория", asset.category)}
            {row("Дата прихода", asset.commissioning_date)}
            {row("Первоначальная стоимость", fmtMoney(asset.initial_cost))}
            {row("Количество", asset.quantity)}
            {row("Локация", asset.location)}
            {row("МОЛ (ответственный)", asset.responsible_person)}
            {row("Серийный / код", asset.serial_number)}
            {asset.last_inventoried_at &&
              row("Последняя инвентаризация", new Date(asset.last_inventoried_at).toLocaleDateString("ru-RU"))}
          </div>

          {asset.notes && (
            <div style={{ marginTop: 16, fontSize: 13, color: "#94a3b8", background: "#0f172a", padding: 12, borderRadius: 10 }}>
              📝 {asset.notes}
            </div>
          )}
        </div>

        <div style={{ textAlign: "center", fontSize: 11, color: "#475569", marginTop: 16 }}>
          Отсканировано с инвентарного стикера · {new Date().toLocaleDateString("ru-RU")}
        </div>
      </div>
    </div>
  );
}
