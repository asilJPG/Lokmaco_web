import { getTagByCode, getLocations } from "@/lib/supabase";
import { normalizeTagCode } from "@/lib/asset-tags";

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
  archived: { label: "📦 Нет в iiko", color: "#94a3b8" },
};

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

const card = {
  maxWidth: 440,
  width: "100%",
  background: "#1e293b",
  borderRadius: 16,
  padding: 28,
  border: "1px solid #334155",
};

/**
 * Что видит человек, наведя на наклейку обычную камеру телефона.
 * Наклейка может быть ещё не привязана — это нормальное состояние,
 * а не ошибка: пачку клеят заранее, привязывают потом.
 */
export default async function TagPublicPage({ params }) {
  const code = normalizeTagCode(params.code);

  if (!code) {
    return (
      <div style={wrap}>
        <div style={{ ...card, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>❓</div>
          <h1 style={{ fontSize: 20, margin: 0 }}>Неизвестный код</h1>
        </div>
      </div>
    );
  }

  const tag = await getTagByCode(code);

  if (!tag) {
    return (
      <div style={wrap}>
        <div style={{ ...card, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>❓</div>
          <h1 style={{ fontSize: 20, margin: "0 0 8px 0" }}>Наклейка не найдена</h1>
          <p style={{ color: "#94a3b8", fontSize: 14, margin: 0 }}>
            Кода <b>{code}</b> нет в системе. Возможно, наклейка из другой партии.
          </p>
        </div>
      </div>
    );
  }

  if (!tag.asset) {
    return (
      <div style={wrap}>
        <div style={{ ...card, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏷</div>
          <h1 style={{ fontSize: 22, margin: "0 0 6px 0", fontFamily: "monospace" }}>{code}</h1>
          <div
            style={{
              display: "inline-block",
              padding: "6px 14px",
              borderRadius: 999,
              background: "rgba(245,158,11,.15)",
              color: "#f59e0b",
              fontSize: 13,
              fontWeight: 700,
              margin: "8px 0 16px",
            }}
          >
            Свободная наклейка
          </div>
          <p style={{ color: "#94a3b8", fontSize: 14, margin: 0, lineHeight: 1.6 }}>
            К этой наклейке ещё не привязано оборудование. Откройте сайт →
            «Основные средства» → «Наклейки» и отсканируйте её, чтобы указать,
            на чём она наклеена.
          </p>
        </div>
      </div>
    );
  }

  const asset = tag.asset;
  const st = STATUS[asset.status] || STATUS.in_use;

  const locations = asset.location_id ? await getLocations() : [];
  const place =
    locations.find((l) => l.id === asset.location_id)?.name || asset.location || "—";

  const row = (label, value) => (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 16,
        padding: "12px 0",
        borderBottom: "1px solid #334155",
      }}
    >
      <span style={{ color: "#94a3b8", fontSize: 13 }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 600, textAlign: "right" }}>{value || "—"}</span>
    </div>
  );

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🏷</div>
          <h1 style={{ fontSize: 20, margin: "0 0 6px 0" }}>{asset.name}</h1>
          <div style={{ fontFamily: "monospace", color: "#94a3b8", fontSize: 13 }}>{code}</div>
          <div
            style={{
              display: "inline-block",
              padding: "5px 12px",
              borderRadius: 999,
              background: `${st.color}22`,
              color: st.color,
              fontSize: 12,
              fontWeight: 700,
              marginTop: 10,
            }}
          >
            {st.label}
          </div>
        </div>

        <div>
          {row("Место", place)}
          {row("Инв. №", asset.inv_number)}
          {row("Категория", asset.category)}
          {row("Дата ввода", asset.commissioning_date)}
          {row("Стоимость", fmtMoney(asset.initial_cost))}
          {row("МОЛ", asset.responsible_person)}
          {row(
            "Инвентаризация",
            asset.last_inventoried_at ? String(asset.last_inventoried_at).slice(0, 10) : "не проводилась"
          )}
        </div>

        <div style={{ marginTop: 18, fontSize: 11, color: "#64748b", textAlign: "center" }}>
          Наклейку привязал: {tag.bound_by || "—"}
          {tag.bound_at ? ` · ${String(tag.bound_at).slice(0, 10)}` : ""}
        </div>
      </div>
    </div>
  );
}
