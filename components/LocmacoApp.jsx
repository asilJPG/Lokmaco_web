"use client";
import { useState, useEffect, useRef } from "react";

const FALLBACK_SUPPLIERS = [
  { id: "16c6e655-945c-4002-a117-934749aea133", name: "Корпоративная карта" },
  { id: "3bdcfdbb-e66c-4b16-9025-03dedb7905fa", name: "Наличные" },
  { id: "4268b082-79b2-4df6-8335-4b6b2e610f37", name: "Оплата по счету" },
];

const FALLBACK_STORES = [
  { id: "1239d270-1bbe-f64f-b7ea-5f00518ef508", name: "Основной склад" },
  { id: "6be6e519-c4d8-4461-9333-7810062486ed", name: "Кухня главная" },
  { id: "c1a132f0-5a33-4f0b-a47b-5b6d8f381c9f", name: "Бар" },
  { id: "0cf0f2c5-891c-412c-8ab7-7b2bacdd2b01", name: "Посуда" },
  { id: "9101f69e-ab51-44b6-8c1a-f80e84d8eec3", name: "Хоз товары" },
  { id: "2e9688bb-5130-4188-94a5-7a850e1d9f55", name: "Заготовочный цех" },
  { id: "41fc6872-f84c-4fbd-ab67-a25eb9f8d353", name: "Зал" },
  { id: "0e7c3f59-e55d-427f-895f-f24e2f106fbc", name: "Кухня подвал" },
];

const STORE_ICONS = {
  "1239d270-1bbe-f64f-b7ea-5f00518ef508": "🏭",
  "6be6e519-c4d8-4461-9333-7810062486ed": "👨‍🍳",
  "c1a132f0-5a33-4f0b-a47b-5b6d8f381c9f": "🍸",
  "0cf0f2c5-891c-412c-8ab7-7b2bacdd2b01": "🍽",
  "9101f69e-ab51-44b6-8c1a-f80e84d8eec3": "🧰",
  "2e9688bb-5130-4188-94a5-7a850e1d9f55": "🥣",
  "41fc6872-f84c-4fbd-ab67-a25eb9f8d353": "🛋",
  "0e7c3f59-e55d-427f-895f-f24e2f106fbc": "🛖",
};

const API = {
  async get(ep) {
    try {
      const r = await fetch(`/api/iiko${ep}`);
      const data = await r.json().catch(() => null);
      if (!r.ok) {
        return { success: false, error: data?.error || `Error ${r.status}` };
      }
      return data;
    } catch (e) {
      console.error(`API GET ${ep}:`, e);
      return { success: false, error: e.message };
    }
  },
  async post(ep, body) {
    try {
      const r = await fetch(`/api/iiko${ep}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json().catch(() => null);
      if (!r.ok) {
        return { success: false, error: data?.error || `Error ${r.status}` };
      }
      return data;
    } catch (e) {
      console.error(`API POST ${ep}:`, e);
      return { success: false, error: e.message };
    }
  },
  async delete(ep) {
    try {
      const r = await fetch(`/api/iiko${ep}`, {
        method: "DELETE",
      });
      const data = await r.json().catch(() => null);
      if (!r.ok) {
        return { success: false, error: data?.error || `Error ${r.status}` };
      }
      return data;
    } catch (e) {
      console.error(`API DELETE ${ep}:`, e);
      return { success: false, error: e.message };
    }
  },
  async put(ep, body) {
    try {
      const r = await fetch(`/api/iiko${ep}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json().catch(() => null);
      if (!r.ok) {
        return { success: false, error: data?.error || `Error ${r.status}` };
      }
      return data;
    } catch (e) {
      console.error(`API PUT ${ep}:`, e);
      return { success: false, error: e.message };
    }
  },
  getProducts() {
    return this.get("/products");
  },
  getSuppliers() {
    return this.get("/suppliers");
  },
  getStores() {
    return this.get("/stores");
  },
  getBalances() {
    return this.get("/balances");
  },
  createInvoice(data) {
    return this.post("/invoice", data);
  },
  createService(data) {
    return this.post("/services", data);
  },
  createTransfer(data) {
    return this.post("/transfer", data);
  },
  getPendingTransfers(tgId, storeId) {
    return this.get(`/transfer?tg_id=${tgId}&store_id=${storeId || ""}`);
  },
  createProduction(data) {
    return this.post("/production", data);
  },
  createWriteoff(data) {
    return this.post("/writeoff", data);
  },
  getAccounts() {
    return this.get("/accounts");
  },
  getEmployees() {
    return this.get("/employees");
  },
  getActiveEmployees(date) {
    return this.get(`/employees/active?date=${date}`);
  },
  createEmployee(data) {
    return this.post("/employees", data);
  },
  updateEmployee(data) {
    return this.put("/employees", data);
  },
  deleteEmployee(id) {
    return this.delete(`/employees?id=${id}`);
  },
  createInventory(data) {
    return this.post("/inventory", data);
  },
  createCash(data) {
    return this.post("/cash", data);
  },
  getHistory() {
    return this.get("/history");
  },
  getIikoDocuments() {
    return this.get("/documents");
  },
  getIikoDocumentDetail(id, type) {
    return this.get(`/documents/detail?id=${id}&type=${type}`);
  },
  login(code) {
    return this.post("/login", { code });
  },
  getPasskeyRegisterOptions(user) {
    return this.post("/auth/passkey/register/options", { user });
  },
  verifyPasskeyRegister(body) {
    return this.post("/auth/passkey/register/verify", body);
  },
  getPasskeyLoginOptions() {
    return this.post("/auth/passkey/login/options", {});
  },
  verifyPasskeyLogin(body) {
    return this.post("/auth/passkey/login/verify", body);
  },
};

const fmt = (n) => new Intl.NumberFormat("ru-RU").format(Math.round(n));
const fmtPrice = (n) => fmt(n) + " сум";

const I = {
  box: (
    <svg
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  ),
  inbox: (
    <svg
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      viewBox="0 0 24 24"
    >
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" />
    </svg>
  ),
  transfer: (
    <svg
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      viewBox="0 0 24 24"
    >
      <path d="m7 7 10 10" />
      <path d="M17 7v10H7" />
    </svg>
  ),
  inventory: (
    <svg
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      viewBox="0 0 24 24"
    >
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  cash: (
    <svg
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      viewBox="0 0 24 24"
    >
      <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
      <line x1="12" y1="18" x2="12" y2="18" />
      <path d="M17 9H7" />
    </svg>
  ),
  search: (
    <svg
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      viewBox="0 0 24 24"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  ),
  plus: (
    <svg
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      viewBox="0 0 24 24"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  trash: (
    <svg
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      viewBox="0 0 24 24"
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  ),
  send: (
    <svg
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      viewBox="0 0 24 24"
    >
      <path d="m22 2-7 20-4-9-9-4z" />
      <path d="m22 2-11 11" />
    </svg>
  ),
  x: (
    <svg
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      viewBox="0 0 24 24"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  ),
  loader: (
    <svg
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      viewBox="0 0 24 24"
      style={{ animation: "spin 1s linear infinite" }}
    >
      <path d="M21 12a9 9 0 11-6.219-8.56" />
    </svg>
  ),
  refresh: (
    <svg
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      viewBox="0 0 24 24"
    >
      <path d="M21 12a9 9 0 00-9-9 9.75 9.75 0 00-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 009 9 9.75 9.75 0 006.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </svg>
  ),
  arrow: (
    <svg
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      viewBox="0 0 24 24"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  ),
  history: (
    <svg
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  analytics: (
    <svg
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      viewBox="0 0 24 24"
    >
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  cooking: (
    <svg
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <path d="M6 18h12M12 2v4M5 8h14c0 4.4-3.6 8-8 8s-8-3.6-8-8z" />
    </svg>
  ),
  users: (
    <svg
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zm14 10v-2a4 4 0 00-3-3.87m-4-12a4 4 0 010 7.75" />
    </svg>
  ),
  edit: (
    <svg
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  ),
  home: (
    <svg
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  more: (
    <svg
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="6" cy="12" r="1.5" />
      <circle cx="18" cy="12" r="1.5" />
    </svg>
  ),
};

function PieChart({ data, total, revenue, onSelectCategory }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  if (!data || data.length === 0 || !total) return null;

  const validData = data.filter((item) => item.amount > 0);
  if (validData.length === 0) return null;

  // Output everything as is from iiko
  const chartData = [...validData];

  let accumulatedAngle = 360;

  const COLORS = [
    "#6366f1",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#ec4899",
    "#06b6d4",
    "#14b8a6",
    "#84cc16",
    "#a855f7",
    "#f97316",
    "#64748b",
  ];

  const segments = chartData.map((item, idx) => {
    const percentage = (item.amount / total) * 100;
    const percentageOfRevenue = revenue > 0 ? (item.amount / revenue) * 100 : 0;
    const angle = (item.amount / total) * 360;
    const startAngle = accumulatedAngle - angle;
    accumulatedAngle -= angle;

    return {
      name: item.name,
      amount: item.amount,
      percentage,
      percentageOfRevenue,
      startAngle,
      angle,
      color: COLORS[idx % COLORS.length],
    };
  });

  const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY + radius * Math.sin(angleInRadians),
    };
  };

  const getDonutSlicePath = (x, y, innerRadius, outerRadius, startAngle, endAngle) => {
    let actualEndAngle = endAngle;
    if (endAngle - startAngle >= 359.99) {
      actualEndAngle = startAngle + 359.9;
    }

    const startOuter = polarToCartesian(x, y, outerRadius, actualEndAngle);
    const endOuter = polarToCartesian(x, y, outerRadius, startAngle);
    const startInner = polarToCartesian(x, y, innerRadius, actualEndAngle);
    const endInner = polarToCartesian(x, y, innerRadius, startAngle);

    const largeArcFlag = actualEndAngle - startAngle <= 180 ? "0" : "1";

    return [
      `M ${startOuter.x} ${startOuter.y}`,
      `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 0 ${endOuter.x} ${endOuter.y}`,
      `L ${endInner.x} ${endInner.y}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 1 ${startInner.x} ${startInner.y}`,
      "Z",
    ].join(" ");
  };

  const CX = 220;
  const CY = 200;
  const R_outer = 145;
  const R_inner = 105;

  const activeSegment = hoveredIndex !== null ? segments[hoveredIndex] : null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: "40px",
        width: "100%",
        flexWrap: "wrap",
        padding: "20px 0",
      }}
    >
      {/* Donut SVG container */}
      <div
        style={{
          flex: "1 1 350px",
          maxWidth: "400px",
          position: "relative",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <svg
          viewBox="0 0 440 400"
          style={{
            width: "100%",
            height: "auto",
            display: "block",
          }}
        >
          <defs>
            <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="6" stdDeviation="8" floodOpacity="0.12" />
            </filter>
          </defs>

          {/* Central Backdrop for Donut text */}
          <circle cx={CX} cy={CY} r={R_inner - 2} fill="var(--bg-card, #ffffff)" filter="url(#shadow)" />

          {/* Render Donut Slices */}
          {segments.map((seg, idx) => {
            const isHovered = hoveredIndex === idx;
            const midAngle = seg.startAngle + seg.angle / 2;
            const shiftDistance = isHovered ? 8 : 0;
            const shiftX =
              Math.cos(((midAngle - 90) * Math.PI) / 180.0) * shiftDistance;
            const shiftY =
              Math.sin(((midAngle - 90) * Math.PI) / 180.0) * shiftDistance;

            let finalEndAngle = seg.startAngle + seg.angle;
            if (seg.angle >= 359.9) {
              finalEndAngle = seg.startAngle + 359.99;
            }

            const path = getDonutSlicePath(
              CX,
              CY,
              R_inner,
              R_outer,
              seg.startAngle,
              finalEndAngle
            );

            // Calculate outer label coordinates (radius R_outer + 15)
            const labelPos = polarToCartesian(CX, CY, R_outer + 15, midAngle);
            let textAnchor = "middle";
            let dx = 0;
            let dy = 0;

            if (midAngle >= 15 && midAngle < 165) {
              textAnchor = "start";
              dx = 4;
            } else if (midAngle >= 195 && midAngle < 345) {
              textAnchor = "end";
              dx = -4;
            } else {
              textAnchor = "middle";
              dy = midAngle >= 165 && midAngle < 195 ? 12 : -4;
            }

            return (
              <g
                key={idx}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                style={{
                  cursor: "default",
                  transform: `translate(${shiftX}px, ${shiftY}px)`,
                  transition: "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              >
                <title>
                  {seg.name}: {fmtPrice(seg.amount)} ({seg.percentage.toFixed(1)}%)
                </title>

                <path
                  d={path}
                  fill={seg.color}
                  opacity={hoveredIndex === null || isHovered ? 1 : 0.75}
                  style={{
                    transition: "opacity 0.2s ease",
                  }}
                />

                {/* Floating Outer label for % of Revenue */}
                <text
                  x={labelPos.x + dx}
                  y={labelPos.y + dy}
                  textAnchor={textAnchor}
                  fill={seg.color}
                  opacity={isHovered ? 1 : 0}
                  style={{
                    fontSize: "11px",
                    fontWeight: 800,
                    transition: "opacity 0.2s ease",
                    pointerEvents: "none",
                  }}
                >
                  {seg.percentageOfRevenue.toFixed(1)}% выр.
                </text>
              </g>
            );
          })}

          {/* Donut Center Information Text */}
          {activeSegment === null ? (
            <g style={{ pointerEvents: "none" }}>
              <text
                x={CX}
                y={CY - 15}
                textAnchor="middle"
                fill="var(--text-muted)"
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                Всего расходов
              </text>
              <text
                x={CX}
                y={CY + 20}
                textAnchor="middle"
                fill="var(--text-main)"
                style={{
                  fontSize: "24px",
                  fontWeight: 800,
                }}
              >
                {fmtPrice(total)}
              </text>
            </g>
          ) : (
            <g style={{ pointerEvents: "none" }}>
              <text
                x={CX}
                y={CY - 35}
                textAnchor="middle"
                fill="var(--text-muted)"
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                Расход по счету
              </text>
              <text
                x={CX}
                y={CY - 5}
                textAnchor="middle"
                fill={activeSegment.color}
                style={{
                  fontSize: "15px",
                  fontWeight: 800,
                }}
              >
                {activeSegment.name.length > 20
                  ? activeSegment.name.slice(0, 18) + "..."
                  : activeSegment.name}
              </text>
              <text
                x={CX}
                y={CY + 30}
                textAnchor="middle"
                fill="var(--text-main)"
                style={{
                  fontSize: "22px",
                  fontWeight: 800,
                }}
              >
                {fmtPrice(activeSegment.amount)}
              </text>
              <text
                x={CX}
                y={CY + 55}
                textAnchor="middle"
                fill="var(--text-muted)"
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                }}
              >
                {activeSegment.percentage.toFixed(1)}% от расходов
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Right side: Modern interactive legend */}
      <div
        style={{
          flex: "1 1 350px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          maxHeight: "380px",
          overflowY: "auto",
          paddingRight: "5px",
        }}
      >
        {segments.map((seg, idx) => {
          const isHovered = hoveredIndex === idx;
          return (
            <div
              key={idx}
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
              onClick={() => onSelectCategory && onSelectCategory(seg.name)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                borderRadius: "12px",
                background: isHovered ? "var(--color-primary-glow)" : "transparent",
                border: isHovered
                  ? "1px solid var(--color-primary)"
                  : "1px solid var(--border-color)",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                <div
                  style={{
                    width: "12px",
                    height: "12px",
                    borderRadius: "50%",
                    backgroundColor: seg.color,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: "13.5px",
                    fontWeight: isHovered ? 700 : 500,
                    color: isHovered ? "var(--color-primary)" : "var(--text-main)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {seg.name}
                </span>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0, marginLeft: "10px" }}>
                <span
                  style={{
                    fontSize: "14px",
                    fontWeight: 800,
                    color: "var(--text-main)",
                    display: "block",
                  }}
                >
                  {fmtPrice(seg.amount)}
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "var(--text-muted)",
                  }}
                >
                  {seg.percentage.toFixed(1)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function LocmacoApp() {
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [loginCode, setLoginCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [regOptions, setRegOptions] = useState(null);
  const [loginOptions, setLoginOptions] = useState(null);

  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("locmaco_theme");
    if (savedTheme === "dark") {
      setDarkMode(true);
    }
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add("dark-theme");
    } else {
      document.body.classList.remove("dark-theme");
    }
  }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode((prev) => {
      const next = !prev;
      localStorage.setItem("locmaco_theme", next ? "dark" : "light");
      return next;
    });
  };

  const [tab, setTab] = useState("menu");
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState(FALLBACK_SUPPLIERS);
  const [stores, setStores] = useState(FALLBACK_STORES);
  const [productsLoading, setProductsLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const webAuthnRef = useRef(null);
  const toastTimeoutRef = useRef(null);

  useEffect(() => {
    import("@simplewebauthn/browser")
      .then((mod) => {
        webAuthnRef.current = mod;
      })
      .catch((err) => console.error("Error preloading webauthn module:", err));
  }, []);

  // Pre-fetch WebAuthn options to satisfy iOS Safari's strict synchronous gesture rules
  useEffect(() => {
    if (loggedInUser && loggedInUser.id) {
      API.getPasskeyRegisterOptions({
        id: loggedInUser.id,
        name: loggedInUser.name,
      }).then((options) => {
        if (!options.error) {
          setRegOptions(options);
        }
      }).catch(err => console.error("Error prefetching register options:", err));
    } else {
      setRegOptions(null);
    }
  }, [loggedInUser]);

  useEffect(() => {
    API.getPasskeyLoginOptions().then((options) => {
      if (!options.error) {
        setLoginOptions(options);
      }
    }).catch(err => console.error("Error prefetching login options:", err));
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem("user");
    if (saved) {
      try {
        const u = JSON.parse(saved);
        const rawRole = u.role || "";
        const [baseRole, storeId] = rawRole.split(":");
        setLoggedInUser({
          ...u,
          baseRole: baseRole || "",
          storeId: storeId || null,
        });
      } catch (_e) {
        sessionStorage.removeItem("user");
      }
    }
  }, []);

  const performLogout = (reason = "manual") => {
    sessionStorage.removeItem("user");
    setLoggedInUser(null);
    setLoginCode("");
    fetch("/api/iiko/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    }).catch((err) => {
      console.error("Failed server logout:", err);
    });
  };

  useEffect(() => {
    if (!loggedInUser || loggedInUser.baseRole !== "director") return;

    let timeoutId = null;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Screen locked or tab minimized. Start 20s logout timer
        timeoutId = setTimeout(() => {
          performLogout("visibility");
        }, 20000); // 20 seconds
      } else {
        // User came back. Cancel the timer
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [loggedInUser]);

  useEffect(() => {
    if (!loggedInUser || loggedInUser.baseRole !== "director") return;

    let idleTimeoutId = null;
    const IDLE_TIME_LIMIT = 5 * 60 * 1000; // 5 minutes in ms

    const resetIdleTimer = () => {
      if (idleTimeoutId) {
        clearTimeout(idleTimeoutId);
      }
      idleTimeoutId = setTimeout(() => {
        performLogout("idle");
      }, IDLE_TIME_LIMIT);
    };

    const events = ["mousemove", "mousedown", "keypress", "touchstart", "scroll"];
    resetIdleTimer();

    events.forEach((evt) => {
      window.addEventListener(evt, resetIdleTimer);
    });

    return () => {
      if (idleTimeoutId) {
        clearTimeout(idleTimeoutId);
      }
      events.forEach((evt) => {
        window.removeEventListener(evt, resetIdleTimer);
      });
    };
  }, [loggedInUser]);

  const loadData = async () => {
    setProductsLoading(true);
    const [p, sup, st] = await Promise.all([
      API.getProducts(),
      API.getSuppliers(),
      API.getStores(),
    ]);
    if (p && Array.isArray(p) && p.length > 0) {
      setProducts(p);
    } else if (p && p.error) {
      showToast(p.error, "error");
    }
    if (sup && Array.isArray(sup) && sup.length > 0) {
      setSuppliers(sup);
    } else if (sup && sup.error) {
      showToast(sup.error, "error");
    }
    if (st && Array.isArray(st) && st.length > 0) {
      setStores(st);
    } else if (st && st.error) {
      showToast(st.error, "error");
    }
    setProductsLoading(false);
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    const res = await API.getHistory();
    if (res && res.success && Array.isArray(res.history)) {
      setHistory(res.history);
    } else {
      showToast(res?.error || "Не удалось загрузить историю операций", "error");
    }
    setHistoryLoading(false);
  };

  useEffect(() => {
    if (loggedInUser) {
      loadData();
      loadHistory();
    }
  }, [loggedInUser]);

  useEffect(() => {
    if (
      loggedInUser &&
      tab !== "menu" &&
      !hasAccess(loggedInUser.baseRole, tab)
    ) {
      setTab("menu");
    }
  }, [tab, loggedInUser]);

  const showToast = (msg, type = "success") => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToast({ msg, type });
    toastTimeoutRef.current = setTimeout(() => setToast(null), 2500);
  };

  const handleRegisterPasskey = async () => {
    if (!loggedInUser) {
      showToast("Вы должны быть авторизованы", "error");
      return;
    }
    
    let options = regOptions;
    if (!options) {
      showToast("Подготовка параметров устройства...", "info");
      options = await API.getPasskeyRegisterOptions({
        id: loggedInUser.id,
        name: loggedInUser.name,
      });

      if (options.error) {
        showToast(options.error, "error");
        return;
      }
    }

    try {
      if (!webAuthnRef.current) {
        showToast("Модуль биометрии еще загружается. Пожалуйста, подождите секунду и попробуйте снова.", "error");
        return;
      }

      const regResponse = await webAuthnRef.current.startRegistration(options);
      const verifyRes = await API.verifyPasskeyRegister(regResponse);

      if (verifyRes && verifyRes.verified) {
        showToast("Устройство успешно привязано к FaceID/TouchID!");
        // Refresh preloaded options
        API.getPasskeyRegisterOptions({
          id: loggedInUser.id,
          name: loggedInUser.name,
        }).then(setRegOptions).catch(() => {});
      } else {
        showToast(verifyRes?.error || "Ошибка привязки устройства", "error");
      }
    } catch (e) {
      console.error(e);
      if (e.name === "NotAllowedError") {
        showToast("Ошибка активации биометрии или регистрация отменена. Попробуйте еще раз.", "error");
      } else {
        showToast(`Биометрия не поддерживается или произошла ошибка: ${e.message}`, "error");
      }
    }
  };

  const handleLoginPasskey = async () => {
    try {
      setLoginLoading(true);
      setLoginError("");
      
      let options = loginOptions;
      if (!options) {
        options = await API.getPasskeyLoginOptions();
        if (options.error) {
          setLoginError(options.error);
          setLoginLoading(false);
          return;
        }
      }

      if (!webAuthnRef.current) {
        setLoginError("Модуль биометрии еще загружается. Пожалуйста, подождите.");
        setLoginLoading(false);
        return;
      }

      const authResponse = await webAuthnRef.current.startAuthentication(options);
      const verifyRes = await API.verifyPasskeyLogin(authResponse);

      setLoginLoading(false);

      if (verifyRes && verifyRes.verified && verifyRes.user) {
        const u = verifyRes.user;
        const rawRole = u.role || "";
        const [baseRole, storeId] = rawRole.split(":");
        const parsedUser = {
          ...u,
          baseRole: baseRole || "",
          storeId: storeId || null,
        };
        setLoggedInUser(parsedUser);
        sessionStorage.setItem("user", JSON.stringify(parsedUser));
        showToast(`Добро пожаловать, ${parsedUser.name}!`);
      } else {
        setLoginError(verifyRes?.error || "Ошибка проверки биометрии");
        // Refresh preloaded options on failure
        API.getPasskeyLoginOptions().then(setLoginOptions).catch(() => {});
      }
    } catch (e) {
      console.error(e);
      setLoginLoading(false);
      if (e.name === "NotAllowedError") {
        setLoginError("Авторизация отменена пользователем или ошибка активации FaceID");
      } else {
        setLoginError(`Ошибка входа по биометрии: ${e.message}`);
      }
      // Refresh preloaded options on failure
      API.getPasskeyLoginOptions().then(setLoginOptions).catch(() => {});
    }
  };

  const tabs = [
    { id: "incoming", label: "Приход", icon: I.inbox },
    { id: "services", label: "Услуги", icon: I.inventory },
    { id: "transfer", label: "Перемещение", icon: I.transfer },
    { id: "inventory", label: "Инвентаризация", icon: I.inventory },
    { id: "production", label: "Приготовление", icon: I.cooking },
    { id: "writeoff", label: "Списание", icon: I.trash },
    { id: "balances", label: "Остатки", icon: I.box },
    { id: "cash", label: "Касса", icon: I.cash },
    { id: "analytics", label: loggedInUser?.baseRole === "manager" ? "Мониторинг" : "Аналитика", icon: I.analytics },
    { id: "tax_report", label: "Налоговый отчет", icon: I.cash },
    { id: "employees", label: "Сотрудники", icon: I.users },
  ];

  const ROLE_NAMES = {
    admin: "Админ",
    director: "Руководитель",
    supplier: "Снабженец",
    kitchen: "Шеф-повар",
    prep_chef: "Смесь-повар",
    bar: "Бармен",
    cashier: "Кассир",
    manager: "Менеджер",
    hall: "Зал",
  };

  const hasAccess = (role, tabId) => {
    if (role === "admin") return true;
    switch (tabId) {
      case "incoming":
        return role === "supplier";
      case "services":
        return ["supplier", "director"].includes(role);
      case "transfer":
        return ["kitchen", "prep_chef", "bar", "supplier", "hall"].includes(role);
      case "inventory":
        return ["kitchen", "prep_chef", "bar", "supplier"].includes(role);
      case "production":
        return ["prep_chef", "bar"].includes(role);
      case "writeoff":
        return role === "bar";
      case "employees":
        return role === "admin";
      case "cash":
        return role === "cashier";
      case "analytics":
        return ["director", "manager"].includes(role);
      case "tax_report":
        return ["director"].includes(role);
      case "balances":
        return role !== "manager";
      default:
        return false;
    }
  };

  if (!loggedInUser) {
    const triggerLogin = async (code) => {
      setLoginLoading(true);
      setLoginError("");
      const res = await API.login(code);
      setLoginLoading(false);
      if (res && res.success && res.user) {
        const rawRole = res.user.role || "";
        const [baseRole, storeId] = rawRole.split(":");
        const parsedUser = {
          ...res.user,
          baseRole: baseRole || "",
          storeId: storeId || null,
        };
        setLoggedInUser(parsedUser);
        sessionStorage.setItem("user", JSON.stringify(parsedUser));
      } else {
        setLoginError(res?.error || "Неверный пароль");
        setLoginCode(""); // Clear password so they can re-type
      }
    };

    const handleLogin = async (e) => {
      if (e) e.preventDefault();
      if (!loginCode) {
        setLoginError("Введите пароль");
        return;
      }
      if (loginCode.length < 4) {
        setLoginError("Пароль должен быть не менее 4 символов");
        return;
      }
      await triggerLogin(loginCode);
    };

    return (
      <div
        style={{
          fontFamily: "Inter, system-ui, -apple-system, sans-serif",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg-app)",
          color: "var(--text-main)",
          padding: "20px",
          transition: "background-color 0.25s, color 0.25s",
        }}
      >
        <style>{`
          @keyframes spin { 100% { transform: rotate(360deg); } }
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-6px); }
            75% { transform: translateX(6px); }
          }
          .password-input:focus {
            border-color: var(--text-main) !important;
            box-shadow: 0 0 0 2px var(--color-primary-glow) !important;
          }
          .submit-btn {
            transition: all 0.2s ease !important;
          }
          .submit-btn:hover {
            opacity: 0.9 !important;
            transform: scale(0.98) !important;
          }
          .submit-btn:active {
            transform: scale(0.95) !important;
          }
          .passkey-btn {
            transition: all 0.2s ease !important;
          }
          .passkey-btn:hover {
            background: var(--bg-hover) !important;
            border-color: var(--border-color) !important;
          }
          .passkey-btn:active {
            transform: scale(0.98) !important;
          }
        `}</style>

        {/* Floating Theme Selector */}
        <div
          style={{
            position: "fixed",
            top: 20,
            right: 20,
            zIndex: 150,
          }}
        >
          <button
            onClick={toggleDarkMode}
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              borderRadius: "50%",
              width: 40,
              height: 40,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              color: darkMode ? "#fbbf24" : "#4b5563",
              transition: "all 0.2s",
            }}
            title={darkMode ? "Светлая тема" : "Темная тема"}
          >
            {darkMode ? (
              <svg
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
              >
                <circle cx="12" cy="12" r="5" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            ) : (
              <svg
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
              >
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
        </div>

        <div
          style={{
            maxWidth: 400,
            width: "100%",
            background: "var(--bg-card)",
            borderRadius: 24,
            border: "1px solid var(--border-color)",
            padding: "40px 30px",
            boxShadow: darkMode
              ? "0 8px 32px rgba(0, 0, 0, 0.4)"
              : "0 8px 32px rgba(0, 0, 0, 0.04)",
            textAlign: "center",
            transition: "background-color 0.25s, border-color 0.25s, box-shadow 0.25s",
          }}
        >
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: 16,
              background: darkMode ? "#ffffff" : "#09090b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: 24,
              color: darkMode ? "#09090b" : "#ffffff",
              margin: "0 auto 24px",
              border: "1px solid var(--border-color)",
              boxShadow: darkMode ? "0 4px 12px rgba(255, 255, 255, 0.05)" : "0 4px 12px rgba(0, 0, 0, 0.05)",
              transition: "all 0.25s ease",
            }}
          >
            L
          </div>
          <h2
            style={{
              margin: "0 0 8px",
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: "-0.5px",
            }}
          >
            The Lokmaco
          </h2>
          <p style={{ margin: "0 0 32px", fontSize: 13, color: "var(--text-muted)" }}>
            Введите пароль для входа
          </p>

          <form onSubmit={handleLogin}>
            <div style={{ position: "relative", marginBottom: loginError ? 12 : 24 }}>
              <input
                type={showPassword ? "text" : "password"}
                value={loginCode}
                onChange={(e) => {
                  setLoginError("");
                  setLoginCode(e.target.value);
                }}
                placeholder="Введите пароль"
                disabled={loginLoading}
                style={{
                  width: "100%",
                  padding: "16px 48px 16px 16px",
                  borderRadius: 12,
                  border: "1.5px solid var(--border-color)",
                  background: "var(--bg-input)",
                  color: "var(--text-main)",
                  fontSize: 16,
                  fontWeight: 500,
                  outline: "none",
                  transition: "all 0.2s ease",
                }}
                className="password-input"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: 14,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  padding: 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  outline: "none",
                }}
              >
                {showPassword ? (
                  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.43 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            </div>

            {loginError && (
              <div
                style={{
                  color: "var(--text-danger)",
                  fontSize: 13,
                  fontWeight: 500,
                  marginBottom: 20,
                  animation: "shake 0.3s ease",
                  textAlign: "center",
                }}
              >
                ⚠️ {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={loginLoading}
              className="submit-btn"
              style={{
                width: "100%",
                padding: "16px 20px",
                borderRadius: 12,
                background: "var(--text-main)",
                color: "var(--bg-card)",
                fontSize: 15,
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
                boxShadow: darkMode ? "0 4px 12px rgba(255, 255, 255, 0.05)" : "0 4px 12px rgba(0, 0, 0, 0.05)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                outline: "none",
                marginBottom: 20,
              }}
            >
              {loginLoading ? (
                <svg
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  viewBox="0 0 24 24"
                  style={{ animation: "spin 1s linear infinite" }}
                >
                  <path d="M21 12a9 9 0 11-6.219-8.56" />
                </svg>
              ) : (
                "Войти"
              )}
            </button>
            <button
              type="button"
              onClick={handleLoginPasskey}
              disabled={loginLoading}
              style={{
                width: "100%",
                padding: "14px 16px",
                borderRadius: 12,
                border: "1px solid var(--border-color)",
                background: "var(--bg-input)",
                color: "var(--text-main)",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                transition: "all 0.15s ease",
                marginTop: 10,
                outline: "none",
              }}
              className="passkey-btn"
            >
              <svg
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
                style={{ color: "var(--text-main)" }}
              >
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
              </svg>
              Войти по FaceID / TouchID
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Mobile navigation helper logic
  const allowedTabs = tabs.filter((t) => hasAccess(loggedInUser.baseRole, t.id));
  const showMore = allowedTabs.length > 4;
  const mobileNavItems = [];
  
  mobileNavItems.push({
    id: "menu",
    label: "Меню",
    icon: I.home
  });

  const maxTabsToShow = showMore ? 3 : 4;
  for (let i = 0; i < Math.min(allowedTabs.length, maxTabsToShow); i++) {
    mobileNavItems.push(allowedTabs[i]);
  }

  if (showMore) {
    mobileNavItems.push({
      id: "more",
      label: "Еще",
      icon: I.more,
      onClick: () => setTab("menu")
    });
  }

  const isItemActive = (item) => {
    if (item.id === "menu") return tab === "menu";
    if (item.id === "more") {
      return tab !== "menu" && !mobileNavItems.slice(0, -1).some(x => x.id === tab);
    }
    return tab === item.id;
  };

  return (
    <div
      className={darkMode ? "dark-theme" : ""}
      style={{
        fontFamily: "'DM Sans','Segoe UI',system-ui,sans-serif",
        minHeight: "100vh",
        background: "var(--bg-app)",
        color: "var(--text-main)",
        transition: "background 0.25s ease, color 0.25s ease",
        overflowX: "hidden",
      }}
    >
      <style>{`
        :root {
          --bg-app: #f9fafb;
          --bg-card: #ffffff;
          --bg-header: #ffffff;
          --text-main: #111827;
          --text-muted: #4b5563;
          --border-color: #e5e7eb;
          --bg-input: #ffffff;
          --bg-hover: #f3f4f6;
          --bg-pill: #f3f4f6;
          --text-pill: #4b5563;
          --color-primary: #2563eb;
          --color-primary-glow: rgba(37, 99, 235, 0.1);
          --bg-status-success: #d1fae5;
          --text-status-success: #065f46;
          --bg-status-neutral: #f3f4f6;
          --text-status-neutral: #4b5563;
          --text-success: #166534;
          --text-danger: #991b1b;
        }

        .dark-theme {
          --bg-app: #09090b;
          --bg-card: #18181b;
          --bg-header: #18181b;
          --text-main: #ffffff;
          --text-muted: #a1a1aa;
          --border-color: #27272a;
          --bg-input: #18181b;
          --bg-hover: #27272a;
          --bg-pill: #27272a;
          --text-pill: #ffffff;
          --color-primary: #3b82f6;
          --color-primary-glow: rgba(59, 130, 246, 0.15);
          --bg-status-success: rgba(16, 185, 129, 0.15);
          --text-status-success: #34d399;
          --bg-status-neutral: #27272a;
          --text-status-neutral: #cbd5e1;
          --text-success: #34d399;
          --text-danger: #f87171;
        }

        body.dark-theme {
          background-color: #09090b !important;
          color: #ffffff !important;
        }

        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeUp { from { opacity: 0; transform: translate(-50%, 10px); } to { opacity: 1; transform: translate(-50%, 0); } }
        @keyframes toastProgress { from { width: 100%; } to { width: 0%; } }
        @keyframes slideLeft { from { transform: translateX(100%); } to { transform: translateX(0); } }
        
        .mobile-nav {
          display: none !important;
        }
        
        @media (max-width: 767px) {
          .desktop-nav {
            display: none !important;
          }
          .mobile-nav {
            display: flex !important;
          }
        }
        .dashboard-card {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        .dashboard-card:hover {
          transform: translateY(-2px);
          border-color: var(--color-primary) !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05) !important;
        }
        .dashboard-card:active {
          transform: translateY(0);
        }
      `}</style>

      <header
        className="app-header"
        style={{
          background: "var(--bg-header)",
          borderBottom: "1px solid var(--border-color)",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div
          className="header-inner"
          style={{
            maxWidth: 1120,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: 60,
            padding: "0 20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 9,
                background: "linear-gradient(135deg,#2563eb,#818cf8)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: 15,
                color: "#fff",
              }}
            >
              L
            </div>
            <div>
              <div style={{ color: "var(--text-main)", fontWeight: 700, fontSize: 15 }}>
                The Lokmaco
              </div>
              <div
                style={{
                  color: "var(--text-muted)",
                  fontSize: 10,
                  letterSpacing: 0.6,
                  textTransform: "uppercase",
                }}
              >
                iiko warehouse
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="user-info-desktop" style={{ textAlign: "right" }}>
              <div style={{ color: "var(--text-main)", fontWeight: 600, fontSize: 13 }}>
                {loggedInUser.name}
              </div>
              <div
                style={{
                  color: "var(--text-muted)",
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                {(() => {
                  const baseName =
                    ROLE_NAMES[loggedInUser.baseRole] || loggedInUser.baseRole;
                  if (loggedInUser.storeId) {
                    const st = stores.find(
                      (s) => s.id === loggedInUser.storeId
                    );
                    if (st) return `${baseName} (${st.name})`;
                  }
                  return baseName;
                })()}
              </div>
            </div>
            <button
              onClick={handleRegisterPasskey}
              style={{
                background: "rgba(99, 102, 241, 0.12)",
                border: "1px solid rgba(99, 102, 241, 0.25)",
                borderRadius: 8,
                padding: "6px 10px",
                color: "#818cf8",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
                transition: "all 0.15s ease",
              }}
              title="Привязать FaceID/TouchID"
            >
              <span>🔑</span> <span className="hide-mobile">Привязать FaceID</span>
            </button>
            <button
              onClick={toggleDarkMode}
              style={{
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: 8,
                padding: "6px",
                color: darkMode ? "#fbbf24" : "#94a3b8",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.15s ease",
              }}
              title={darkMode ? "Светлая тема" : "Темная тема"}
            >
              {darkMode ? (
                <svg
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  viewBox="0 0 24 24"
                >
                  <circle cx="12" cy="12" r="5" />
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                </svg>
              ) : (
                <svg
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  viewBox="0 0 24 24"
                >
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>
            <button
              onClick={() => performLogout("manual")}
              style={{
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: 8,
                padding: "6px",
                color: "#f87171",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.15s ease",
              }}
              title="Выйти"
            >
              <svg
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <nav
        className="desktop-nav"
        style={{
          background: "var(--bg-card)",
          borderBottom: "1px solid var(--border-color)",
          position: "sticky",
          top: 60,
          zIndex: 90,
          display: tab === "menu" ? "none" : "block",
        }}
      >
        <div
          style={{
            maxWidth: 1120,
            margin: "0 auto",
            display: "flex",
            padding: "0 20px",
          }}
        >
          {tabs
            .filter((t) => hasAccess(loggedInUser.baseRole, t.id))
            .map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "12px 18px",
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: tab === t.id ? 700 : 500,
                  color: tab === t.id ? "var(--color-primary)" : "var(--text-muted)",
                  borderBottom:
                    tab === t.id
                      ? "2px solid var(--color-primary)"
                      : "2px solid transparent",
                }}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
        </div>
      </nav>

      {tab !== "menu" && (
        <div
          style={{ maxWidth: 1120, margin: "16px auto 0", padding: "0 20px" }}
        >
          <button
            onClick={() => setTab("menu")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 18px",
              borderRadius: 12,
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              fontSize: 13,
              fontWeight: 700,
              color: "#6366f1",
              cursor: "pointer",
              boxShadow: "0 4px 6px rgba(0,0,0,0.02)",
              transition: "all 0.15s ease",
            }}
          >
            ← Назад в меню
          </button>
        </div>
      )}

      <main
        className="app-main"
        style={{ maxWidth: 1120, margin: "0 auto", padding: "20px 20px 100px" }}
      >
        {tab === "menu" && (
          <div style={{ animation: "fadeIn .25s ease" }}>
            <h2
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: "var(--text-main)",
                marginBottom: 24,
                letterSpacing: "-0.5px",
              }}
            >
              Выберите операцию
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: 20,
              }}
            >
              {hasAccess(loggedInUser.baseRole, "incoming") && (
                <button
                  onClick={() => setTab("incoming")}
                  style={{
                    textAlign: "left",
                    padding: 24,
                    borderRadius: 12,
                    border: "1px solid var(--border-color)",
                    background: "var(--bg-card)",
                    color: "var(--text-main)",
                    cursor: "pointer",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                    outline: "none",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 16,
                  }}
                  className="dashboard-card"
                >
                  <div
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 8,
                      background: "var(--bg-pill)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 24,
                      flexShrink: 0,
                    }}
                  >
                    📥
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}
                    >
                      Приход накладных
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.4 }}>
                      Оформление новых поставок товаров в iiko
                    </div>
                  </div>
                </button>
              )}

              {hasAccess(loggedInUser.baseRole, "services") && (
                <button
                  onClick={() => setTab("services")}
                  style={{
                    textAlign: "left",
                    padding: 24,
                    borderRadius: 12,
                    border: "1px solid var(--border-color)",
                    background: "var(--bg-card)",
                    color: "var(--text-main)",
                    cursor: "pointer",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                    outline: "none",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 16,
                  }}
                  className="dashboard-card"
                >
                  <div
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 8,
                      background: "var(--bg-pill)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 24,
                      flexShrink: 0,
                    }}
                  >
                    🤝
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}
                    >
                      Акты приема услуг
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.4 }}>
                      Оформление актов приема услуг (доставка, авторасходы) в iiko
                    </div>
                  </div>
                </button>
              )}

              {hasAccess(loggedInUser.baseRole, "transfer") && (
                <button
                  onClick={() => setTab("transfer")}
                  style={{
                    textAlign: "left",
                    padding: 24,
                    borderRadius: 12,
                    border: "1px solid var(--border-color)",
                    background: "var(--bg-card)",
                    color: "var(--text-main)",
                    cursor: "pointer",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                    outline: "none",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 16,
                  }}
                  className="dashboard-card"
                >
                  <div
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 8,
                      background: "var(--bg-pill)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 24,
                      flexShrink: 0,
                    }}
                  >
                    🔁
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}
                    >
                      Перемещение
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.4 }}>
                      Внутреннее перемещение продуктов между складами
                    </div>
                  </div>
                </button>
              )}

              {hasAccess(loggedInUser.baseRole, "inventory") && (
                <button
                  onClick={() => setTab("inventory")}
                  style={{
                    textAlign: "left",
                    padding: 24,
                    borderRadius: 12,
                    border: "1px solid var(--border-color)",
                    background: "var(--bg-card)",
                    color: "var(--text-main)",
                    cursor: "pointer",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                    outline: "none",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 16,
                  }}
                  className="dashboard-card"
                >
                  <div
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 8,
                      background: "var(--bg-pill)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 24,
                      flexShrink: 0,
                    }}
                  >
                    📋
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}
                    >
                      Инвентаризация
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.4 }}>
                      Фактический пересчет остатков с автосохранением
                    </div>
                  </div>
                </button>
              )}

              {hasAccess(loggedInUser.baseRole, "production") && (
                <button
                  onClick={() => setTab("production")}
                  style={{
                    textAlign: "left",
                    padding: 24,
                    borderRadius: 12,
                    border: "1px solid var(--border-color)",
                    background: "var(--bg-card)",
                    color: "var(--text-main)",
                    cursor: "pointer",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                    outline: "none",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 16,
                  }}
                  className="dashboard-card"
                >
                  <div
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 8,
                      background: "var(--bg-pill)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 24,
                      flexShrink: 0,
                    }}
                  >
                    🍳
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}
                    >
                      Приготовление заготовок
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.4 }}>
                      Акт приготовления готовых заготовок/смесей в iiko
                    </div>
                  </div>
                </button>
              )}

              {hasAccess(loggedInUser.baseRole, "writeoff") && (
                <button
                  onClick={() => setTab("writeoff")}
                  style={{
                    textAlign: "left",
                    padding: 24,
                    borderRadius: 12,
                    border: "1px solid var(--border-color)",
                    background: "var(--bg-card)",
                    color: "var(--text-main)",
                    cursor: "pointer",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                    outline: "none",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 16,
                  }}
                  className="dashboard-card"
                >
                  <div
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 8,
                      background: "var(--bg-pill)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 24,
                      flexShrink: 0,
                    }}
                  >
                    🗑️
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}
                    >
                      Списание
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.4 }}>
                      Оформление актов списания продуктов и потерь в iiko
                    </div>
                  </div>
                </button>
              )}

              {hasAccess(loggedInUser.baseRole, "cash") && (
                <button
                  onClick={() => setTab("cash")}
                  style={{
                    textAlign: "left",
                    padding: 24,
                    borderRadius: 12,
                    border: "1px solid var(--border-color)",
                    background: "var(--bg-card)",
                    color: "var(--text-main)",
                    cursor: "pointer",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                    outline: "none",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 16,
                  }}
                  className="dashboard-card"
                >
                  <div
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 8,
                      background: "var(--bg-pill)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 24,
                      flexShrink: 0,
                    }}
                  >
                    💵
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}
                    >
                      Сдать кассу
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.4 }}>
                      Отчет кассовой смены и расходов для руководства
                    </div>
                  </div>
                </button>
              )}

              {hasAccess(loggedInUser.baseRole, "analytics") && (
                <button
                  onClick={() => setTab("analytics")}
                  style={{
                    textAlign: "left",
                    padding: 24,
                    borderRadius: 12,
                    border: "1px solid var(--border-color)",
                    background: "var(--bg-card)",
                    color: "var(--text-main)",
                    cursor: "pointer",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                    outline: "none",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 16,
                  }}
                  className="dashboard-card"
                >
                  <div
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 8,
                      background: "var(--bg-pill)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 24,
                      flexShrink: 0,
                    }}
                  >
                    {loggedInUser?.baseRole === "manager" ? "📈" : "📊"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}
                    >
                      {loggedInUser?.baseRole === "manager" ? "Мониторинг" : "Аналитика"}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.4 }}>
                      {loggedInUser?.baseRole === "manager"
                        ? "Лидеры продаж и статистика официантов"
                        : "P&L отчет, кассовая выручка и лидеры продаж"}
                    </div>
                  </div>
                </button>
              )}

              {hasAccess(loggedInUser.baseRole, "tax_report") && (
                <button
                  onClick={() => setTab("tax_report")}
                  style={{
                    textAlign: "left",
                    padding: 24,
                    borderRadius: 12,
                    border: "1px solid var(--border-color)",
                    background: "var(--bg-card)",
                    color: "var(--text-main)",
                    cursor: "pointer",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                    outline: "none",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 16,
                  }}
                  className="dashboard-card"
                >
                  <div
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 8,
                      background: "var(--bg-pill)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 24,
                      flexShrink: 0,
                    }}
                  >
                    🧾
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}
                    >
                      Налоговый отчет
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.4 }}>
                      Сверка официальной выручки (Humo/Uzcard) и налога 4%
                    </div>
                  </div>
                </button>
              )}

              {hasAccess(loggedInUser.baseRole, "employees") && (
                <button
                  onClick={() => setTab("employees")}
                  style={{
                    textAlign: "left",
                    padding: 24,
                    borderRadius: 12,
                    border: "1px solid var(--border-color)",
                    background: "var(--bg-card)",
                    color: "var(--text-main)",
                    cursor: "pointer",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                    outline: "none",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 16,
                  }}
                  className="dashboard-card"
                >
                  <div
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 8,
                      background: "var(--bg-pill)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 24,
                      flexShrink: 0,
                    }}
                  >
                    👥
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}
                    >
                      Сотрудники
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.4 }}>
                      Управление учетными записями персонала и правами
                    </div>
                  </div>
                </button>
              )}

              {hasAccess(loggedInUser.baseRole, "balances") && (
                <button
                  onClick={() => setTab("balances")}
                  style={{
                    textAlign: "left",
                    padding: 24,
                    borderRadius: 12,
                    border: "1px solid var(--border-color)",
                    background: "var(--bg-card)",
                    color: "var(--text-main)",
                    cursor: "pointer",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                    outline: "none",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 16,
                  }}
                  className="dashboard-card"
                >
                  <div
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 8,
                      background: "var(--bg-pill)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 24,
                      flexShrink: 0,
                    }}
                  >
                    📦
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}
                    >
                      Остатки на складе
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.4 }}>
                      Просмотр и контроль остатков товаров на складах
                    </div>
                  </div>
                </button>
              )}
            </div>
          </div>
        )}

        {tab === "incoming" && (
          <IncomingView
            products={products}
            suppliers={suppliers}
            stores={stores}
            showToast={showToast}
            loading={productsLoading}
            onRetry={loadData}
            loggedInUser={loggedInUser}
            loadHistory={loadHistory}
            history={history.filter((h) => h.action_type === "invoice")}
            historyLoading={historyLoading}
          />
        )}
        {tab === "services" && (
          <ServicesView
            stores={stores}
            suppliers={suppliers}
            showToast={showToast}
            loggedInUser={loggedInUser}
            loadHistory={loadHistory}
            history={history.filter((h) => h.action_type === "services")}
            historyLoading={historyLoading}
          />
        )}
        {tab === "transfer" && (
          <TransferView
            products={products}
            stores={stores}
            showToast={showToast}
            loading={productsLoading}
            onRetry={loadData}
            loggedInUser={loggedInUser}
            loadHistory={loadHistory}
            history={history.filter((h) => h.action_type === "transfer")}
            historyLoading={historyLoading}
          />
        )}
        {tab === "inventory" && (
          <InventoryView
            products={products}
            stores={stores}
            showToast={showToast}
            loading={productsLoading}
            onRetry={loadData}
            loggedInUser={loggedInUser}
            loadHistory={loadHistory}
            history={history.filter((h) => h.action_type === "inventory")}
            historyLoading={historyLoading}
          />
        )}
        {tab === "production" && (
          <ProductionView
            products={products}
            stores={stores}
            showToast={showToast}
            loading={productsLoading}
            onRetry={loadData}
            loggedInUser={loggedInUser}
            loadHistory={loadHistory}
            history={history.filter((h) => h.action_type === "production")}
            historyLoading={historyLoading}
          />
        )}
        {tab === "writeoff" && (
          <WriteoffView
            products={products}
            stores={stores}
            showToast={showToast}
            loading={productsLoading}
            onRetry={loadData}
            loggedInUser={loggedInUser}
            loadHistory={loadHistory}
            history={history.filter((h) => h.action_type === "writeoff")}
            historyLoading={historyLoading}
          />
        )}
        {tab === "cash" && (
          <CashView
            showToast={showToast}
            loggedInUser={loggedInUser}
            loadHistory={loadHistory}
            history={history.filter((h) => h.action_type === "cash")}
            historyLoading={historyLoading}
          />
        )}
        {tab === "analytics" && (
          <AnalyticsView
            showToast={showToast}
            history={history}
            historyLoading={historyLoading}
            loadHistory={loadHistory}
            loggedInUser={loggedInUser}
          />
        )}
        {tab === "tax_report" && (
          <TaxReportView
            showToast={showToast}
            loggedInUser={loggedInUser}
          />
        )}
        {tab === "employees" && (
          <EmployeesView
            stores={stores}
            showToast={showToast}
            loggedInUser={loggedInUser}
          />
        )}
        {tab === "balances" && (
          <BalancesView
            stores={stores}
            showToast={showToast}
            loggedInUser={loggedInUser}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <div
        className="mobile-nav"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          height: 64,
          background: "var(--bg-card)",
          borderTop: "1px solid var(--border-color)",
          boxShadow: "0 -4px 12px rgba(0,0,0,0.03)",
          zIndex: 150,
          alignItems: "center",
          justifyContent: "space-around",
          padding: "0 8px",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        {mobileNavItems.map((item) => {
          const active = isItemActive(item);
          return (
            <button
              key={item.id}
              onClick={item.onClick || (() => setTab(item.id))}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                background: "none",
                border: "none",
                padding: "6px 0",
                width: "60px",
                color: active
                  ? "var(--color-primary)"
                  : "var(--text-muted)",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              <div
                style={{
                  transform: active ? "scale(1.1)" : "scale(1)",
                  transition: "transform 0.2s ease",
                  marginBottom: 3,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {item.icon}
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: active ? 700 : 500,
                  transition: "color 0.2s ease",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  width: "100%",
                  textAlign: "center",
                }}
              >
                {item.label === "Инвентаризация" ? "Инвентарь" : item.label === "Приготовление" ? "Приготовл." : item.label}
              </span>
            </button>
          );
        })}
      </div>

      {toast && (
        <div
          onClick={() => setToast(null)}
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            background: toast.type === "error"
              ? "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)"
              : toast.type === "info"
              ? "linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)"
              : "linear-gradient(135deg, #10b981 0%, #059669 100%)",
            color: "#fff",
            padding: "12px 22px 14px",
            borderRadius: 14,
            fontSize: 13,
            fontWeight: 600,
            boxShadow: "0 8px 32px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.1) inset",
            zIndex: 300,
            animation: "fadeUp .25s cubic-bezier(0.16, 1, 0.3, 1)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 10,
            maxWidth: "90vw",
            backdropFilter: "blur(8px)",
            overflow: "hidden",
          }}
        >
          <span style={{ fontSize: 18, flexShrink: 0 }}>
            {toast.type === "error" ? "❌" : toast.type === "info" ? "ℹ️" : "✅"}
          </span>
          <span style={{ flex: 1, lineHeight: 1.4 }}>{toast.msg}</span>
          {/* Progress bar */}
          <div style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            height: 3,
            background: "rgba(255,255,255,0.35)",
            borderRadius: "0 0 14px 14px",
            animation: "toastProgress 2.5s linear forwards",
          }} />
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  IIKO HISTORY LIST — Live iiko documents tracker (incoming / transfers)
// ═══════════════════════════════════════════════════════════════

function IikoHistoryList({ type, showToast, stores = [], products = [] }) {
  const [docs, setDocs] = useState([]);

  const getStoreName = (storeIdOrObjOrName) => {
    if (!storeIdOrObjOrName) return "—";
    if (typeof storeIdOrObjOrName === "object") {
      if (storeIdOrObjOrName.name) return storeIdOrObjOrName.name;
      if (storeIdOrObjOrName.id) {
        const found = stores.find((s) => s.id === storeIdOrObjOrName.id);
        if (found) return found.name;
      }
      return "—";
    }
    if (typeof storeIdOrObjOrName === "string") {
      if (
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          storeIdOrObjOrName
        )
      ) {
        const found = stores.find((s) => s.id === storeIdOrObjOrName);
        return found ? found.name : "—";
      }
      return storeIdOrObjOrName;
    }
    return "—";
  };

  const getProductName = (it) => {
    const possibleName =
      it.productName ||
      (it.product && typeof it.product === "object" ? it.product.name : null) ||
      it.name;
    if (
      possibleName &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        possibleName
      )
    ) {
      return possibleName;
    }
    const pId =
      it.productId ||
      (it.product && typeof it.product === "string"
        ? it.product
        : it.product?.id || null);
    if (pId) {
      const found = products.find((p) => p.id === pId);
      if (found) return found.name;
    }
    return "Товар";
  };

  const getProductUnit = (it) => {
    const rawUnit =
      it.productUnitName || it.unitName || it.productUnit || it.unit || "";
    if (!rawUnit) return "шт";
    const unitMap = {
      "7ba81c3a-8de5-8f9d-fb9f-e39efcbc57cc": "кг",
      "69859c74-db72-b006-cba5-326cf6f4fc6e": "л",
      "cd19b5ea-1b32-a6e5-1df7-5d2784a0549a": "шт",
      "109fb602-70ad-473d-ba1f-f037b6e72887": "шт",
    };
    if (unitMap[rawUnit]) return unitMap[rawUnit];
    if (
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        rawUnit
      )
    ) {
      return "шт";
    }
    return rawUnit;
  };
  const [loading, setLoading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadIikoDocs = async () => {
    try {
      setLoading(true);
      const res = await API.getIikoDocuments();
      if (res && Array.isArray(res.data)) {
        // Filter by document type and remove deleted / storno documents
        const filtered = res.data.filter(
          (d) =>
            d.type === type &&
            d.status !== "DELETED" &&
            d.status !== "STORNO" &&
            !d.deleted
        );
        // Sort by date descending
        filtered.sort(
          (a, b) => new Date(b.dateIncoming) - new Date(a.dateIncoming)
        );
        setDocs(filtered);
      } else {
        showToast(res?.error || "Ошибка загрузки истории iiko", "error");
      }
    } catch (_e) {
      showToast("Ошибка сети при загрузке истории iiko", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIikoDocs();
  }, [type]);

  const loadDetails = async (doc) => {
    setSelectedDoc(doc);
    setDetailLoading(true);
    setDetailData(null);
    try {
      const res = await API.getIikoDocumentDetail(doc.id, type);
      if (res && res.data) {
        setDetailData(res.data);
      } else {
        showToast(
          res?.error || "Не удалось загрузить состав документа",
          "error"
        );
      }
    } catch (_e) {
      showToast("Ошибка при получении деталей документа", "error");
    } finally {
      setDetailLoading(false);
    }
  };

  const formatDateString = (dateStr) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (_e) {
      return dateStr;
    }
  };

  if (loading && docs.length === 0) {
    return <LoadingBlock text="Загрузка документов из iiko..." />;
  }

  return (
    <div style={{ animation: "fadeIn .25s ease" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <h3
          style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--text-muted)" }}
        >
          🚚 Документы в iiko за текущий месяц
        </h3>
        <button
          onClick={loadIikoDocs}
          style={{
            background: "none",
            border: "none",
            color: "#10b981",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          {I.refresh} Обновить iiko
        </button>
      </div>

      {docs.length === 0 ? (
        <div
          style={{
            padding: "30px 20px",
            textAlign: "center",
            background: "var(--bg-hover)",
            borderRadius: 12,
            border: "1px dashed var(--border-color)",
          }}
        >
          <div style={{ fontSize: 24, marginBottom: 8 }}>📦</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>
            Документов этого типа за текущий месяц в iiko не найдено.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {docs.map((doc) => {
            const isProcessed = doc.status === "PROCESSED";
            const date = formatDateString(doc.dateIncoming);

            return (
              <div
                key={doc.id}
                onClick={() => loadDetails(doc)}
                style={{
                  background: "var(--bg-card)",
                  borderRadius: 12,
                  border: "1px solid var(--border-color)",
                  padding: 14,
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  transition: "all 0.15s ease",
                  boxShadow: "0 2px 5px rgba(0,0,0,0.01)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#10b981";
                  e.currentTarget.style.boxShadow =
                    "0 4px 10px rgba(16, 185, 129, 0.05)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "";
                  e.currentTarget.style.boxShadow =
                    "0 2px 5px rgba(0,0,0,0.01)";
                }}
              >
                <div style={{ flex: 1 }}>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <span
                      style={{
                        padding: "2px 6px",
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 700,
                        background: isProcessed ? "var(--bg-status-success)" : "var(--bg-status-neutral)",
                        color: isProcessed ? "var(--text-status-success)" : "var(--text-status-neutral)",
                      }}
                    >
                      {doc.status}
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "var(--text-main)",
                      }}
                    >
                      № {doc.documentNumber || "—"}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 12,
                      marginTop: 6,
                      fontSize: 12,
                      color: "var(--text-muted)",
                    }}
                  >
                    {type === "INCOMING_INVOICE" ? (
                      <>
                        <span>
                          🏢 Поставщик:{" "}
                          <strong>{doc.supplierName || "—"}</strong>
                        </span>
                        <span>
                          📦 Склад:{" "}
                          <strong>
                            {getStoreName(
                              doc.storageTo ||
                                doc.storageToName ||
                                doc.storageName ||
                                doc.storage
                            )}
                          </strong>
                        </span>
                      </>
                    ) : type === "INVENTORY" ? (
                      <>
                        <span>
                          📦 Склад:{" "}
                          <strong>
                            {getStoreName(
                              doc.storage ||
                                doc.storageName ||
                                doc.storageTo ||
                                doc.storageToName
                            )}
                          </strong>
                        </span>
                      </>
                    ) : type === "PRODUCTION_DOCUMENT" ? (
                      <>
                        <span>
                          🏢 Склад:{" "}
                          <strong>
                            {getStoreName(
                              doc.accountTo ||
                                doc.storage ||
                                doc.storageName ||
                                doc.storageTo ||
                                doc.storageToName
                            )}
                          </strong>
                        </span>
                      </>
                    ) : (
                      <>
                        <span>
                          📤 Откуда:{" "}
                          <strong>
                            {getStoreName(
                              doc.storageFrom ||
                                doc.storageFromName ||
                                doc.storageFrom?.name
                            )}
                          </strong>
                        </span>
                        <span>
                          📥 Куда:{" "}
                          <strong>
                            {getStoreName(
                              doc.storageTo ||
                                doc.storageToName ||
                                doc.storageTo?.name
                            )}
                          </strong>
                        </span>
                      </>
                    )}
                  </div>
                  {doc.comment && (
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-muted)",
                        fontStyle: "italic",
                        marginTop: 4,
                      }}
                    >
                      💬 {doc.comment}
                    </div>
                  )}
                </div>

                <div style={{ textAlign: "right", marginLeft: 16 }}>
                  {type === "INCOMING_INVOICE" && doc.sum && (
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 800,
                        color: "#065f46",
                        marginBottom: 2,
                      }}
                    >
                      {fmtPrice(doc.sum)}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{date}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detailed Modal/Drawer */}
      {selectedDoc && (
        <div
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            background: "rgba(15, 23, 42, 0.4)",
            backdropFilter: "blur(4px)",
            display: "flex",
            justifyContent: "flex-end",
            zIndex: 250,
            animation: "fadeIn .25s ease",
          }}
          onClick={() => setSelectedDoc(null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 550,
              background: "var(--bg-card)",
              color: "var(--text-main)",
              borderLeft: "1px solid var(--border-color)",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              boxShadow: "-10px 0 30px rgba(0,0,0,0.1)",
              animation: "slideLeft .25s cubic-bezier(0.16, 1, 0.3, 1)",
              padding: 24,
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                borderBottom: "1px solid var(--border-color)",
                paddingBottom: 16,
                marginBottom: 20,
              }}
            >
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 4,
                  }}
                >
                  <span
                    style={{
                      padding: "3px 8px",
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      background:
                        type === "INCOMING_INVOICE"
                          ? "#ecfdf5"
                          : type === "INVENTORY"
                          ? "#fef3c7"
                          : type === "PRODUCTION_DOCUMENT"
                          ? "#ffedd5"
                          : "#e0e7ff",
                      color:
                        type === "INCOMING_INVOICE"
                          ? "#059669"
                          : type === "INVENTORY"
                          ? "#b45309"
                          : type === "PRODUCTION_DOCUMENT"
                          ? "#c2410c"
                          : "#4f46e5",
                    }}
                  >
                    {type === "INCOMING_INVOICE"
                      ? "Приходная накладная"
                      : type === "INVENTORY"
                      ? "Акт инвентаризации"
                      : type === "PRODUCTION_DOCUMENT"
                      ? "Акт приготовления"
                      : "Внутреннее перемещение"}
                  </span>
                  <span
                    style={{ fontSize: 14, fontWeight: 800, color: "var(--text-main)" }}
                  >
                    № {selectedDoc.documentNumber || "—"}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  📅 Дата:{" "}
                  <strong>{formatDateString(selectedDoc.dateIncoming)}</strong>
                </div>
              </div>
              <button
                onClick={() => setSelectedDoc(null)}
                style={{
                  background: "var(--bg-hover)",
                  border: "none",
                  borderRadius: "50%",
                  width: 32,
                  height: 32,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                }}
              >
                {I.x}
              </button>
            </div>

            {/* Document Meta Info */}
            <div
              style={{
                background: "var(--bg-hover)",
                borderRadius: 12,
                padding: 16,
                display: "flex",
                flexDirection: "column",
                gap: 8,
                marginBottom: 20,
                fontSize: 13,
              }}
            >
              {type === "INCOMING_INVOICE" ? (
                <>
                  <div
                    style={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <span style={{ color: "var(--text-muted)" }}>🏢 Поставщик:</span>
                    <span style={{ fontWeight: 600 }}>
                      {selectedDoc.supplierName || "—"}
                    </span>
                  </div>
                  <div
                    style={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <span style={{ color: "var(--text-muted)" }}>
                      📥 Склад получения:
                    </span>
                    <span style={{ fontWeight: 600 }}>
                      {getStoreName(
                        selectedDoc.storageTo ||
                          selectedDoc.storageToName ||
                          selectedDoc.storageName ||
                          selectedDoc.storage
                      )}
                    </span>
                  </div>
                  {selectedDoc.sum && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        borderTop: "1px dashed var(--border-color)",
                        paddingTop: 8,
                        marginTop: 4,
                      }}
                    >
                      <span style={{ color: "var(--text-muted)", fontWeight: 700 }}>
                        💵 Итоговая сумма:
                      </span>
                      <span style={{ fontWeight: 800, color: "#059669" }}>
                        {fmtPrice(selectedDoc.sum)}
                      </span>
                    </div>
                  )}
                </>
              ) : type === "INVENTORY" ? (
                <>
                  <div
                    style={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <span style={{ color: "var(--text-muted)" }}>📦 Склад:</span>
                    <span style={{ fontWeight: 600 }}>
                      {getStoreName(
                        selectedDoc.storage ||
                          selectedDoc.storageName ||
                          selectedDoc.storageTo ||
                          selectedDoc.storageToName
                      )}
                    </span>
                  </div>
                </>
              ) : type === "PRODUCTION_DOCUMENT" ? (
                <>
                  <div
                    style={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <span style={{ color: "var(--text-muted)" }}>🏢 Склад:</span>
                    <span style={{ fontWeight: 600 }}>
                      {getStoreName(
                        selectedDoc.accountTo ||
                          selectedDoc.storage ||
                          selectedDoc.storageName ||
                          selectedDoc.storageTo ||
                          selectedDoc.storageToName
                      )}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div
                    style={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <span style={{ color: "var(--text-muted)" }}>📤 Склад списания:</span>
                    <span style={{ fontWeight: 600 }}>
                      {getStoreName(
                        selectedDoc.storageFrom ||
                          selectedDoc.storageFromName ||
                          selectedDoc.storageFrom?.name
                      )}
                    </span>
                  </div>
                  <div
                    style={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <span style={{ color: "var(--text-muted)" }}>
                      📥 Склад получения:
                    </span>
                    <span style={{ fontWeight: 600 }}>
                      {getStoreName(
                        selectedDoc.storageTo ||
                          selectedDoc.storageToName ||
                          selectedDoc.storageTo?.name
                      )}
                    </span>
                  </div>
                </>
              )}
              {selectedDoc.comment && (
                <div
                  style={{
                    borderTop: "1px dashed #e2e8f0",
                    paddingTop: 8,
                    marginTop: 4,
                  }}
                >
                  <span style={{ color: "var(--text-muted)" }}>💬 Комментарий:</span>
                  <div
                    style={{
                      marginTop: 4,
                      fontStyle: "italic",
                      background: "var(--bg-card)",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--border-color)",
                    }}
                  >
                    {selectedDoc.comment}
                  </div>
                </div>
              )}
            </div>

            {/* Items Content */}
            <h4
              style={{
                margin: "0 0 10px",
                fontSize: 13,
                fontWeight: 700,
                color: "var(--text-muted)",
              }}
            >
              📦 Состав документа
            </h4>

            {detailLoading && <LoadingBlock text="Загрузка состава..." />}

            {!detailLoading && detailData && (
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    border: "1px solid var(--border-color)",
                    borderRadius: 12,
                    overflow: "hidden",
                  }}
                >
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 12,
                      textAlign: "left",
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          background: "var(--bg-hover)",
                          borderBottom: "1px solid var(--border-color)",
                        }}
                      >
                        <th
                          style={{
                            padding: "10px 14px",
                            fontWeight: 700,
                            color: "var(--text-muted)",
                          }}
                        >
                          Товар
                        </th>
                        <th
                          style={{
                            padding: "10px 14px",
                            fontWeight: 700,
                            color: "var(--text-muted)",
                            textAlign: "right",
                          }}
                        >
                          Кол-во
                        </th>
                        {type === "INCOMING_INVOICE" && (
                          <>
                            <th
                              style={{
                                padding: "10px 14px",
                                fontWeight: 700,
                                color: "var(--text-muted)",
                                textAlign: "right",
                              }}
                            >
                              Цена
                            </th>
                            <th
                              style={{
                                padding: "10px 14px",
                                fontWeight: 700,
                                color: "var(--text-muted)",
                                textAlign: "right",
                              }}
                            >
                              Сумма
                            </th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {detailData.items?.map((it, idx) => {
                        const qty = parseFloat(it.amount || it.count || 0);
                        const price = parseFloat(it.price || 0);
                        const sum = parseFloat(it.sum || qty * price || 0);

                        return (
                          <tr
                            key={idx}
                            style={{
                              borderBottom:
                                idx === detailData.items.length - 1
                                  ? "none"
                                  : "1px solid #f1f5f9",
                            }}
                          >
                            <td
                              style={{
                                padding: "10px 14px",
                                fontWeight: 600,
                                color: "var(--text-main)",
                              }}
                            >
                              {getProductName(it)}
                            </td>
                            <td
                              style={{
                                padding: "10px 14px",
                                fontWeight: 700,
                                color: "var(--text-main)",
                                textAlign: "right",
                              }}
                            >
                              {qty} {getProductUnit(it)}
                            </td>
                            {type === "INCOMING_INVOICE" && (
                              <>
                                <td
                                  style={{
                                    padding: "10px 14px",
                                    color: "var(--text-muted)",
                                    textAlign: "right",
                                  }}
                                >
                                  {fmtPrice(price)}
                                </td>
                                <td
                                  style={{
                                    padding: "10px 14px",
                                    fontWeight: 700,
                                    color: "#059669",
                                    textAlign: "right",
                                  }}
                                >
                                  {fmtPrice(sum)}
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  INCOMING — поставщик → склад → товары (поиск + кол-во + сумма) → провести
// ═══════════════════════════════════════════════════════════════

function IncomingView({
  products,
  suppliers,
  stores,
  showToast,
  loading,
  onRetry,
  loggedInUser,
  loadHistory,
  history,
  historyLoading,
}) {
  const [mode, setMode] = useState("idle");
  const [subTab, setSubTab] = useState("db_history");

  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    supplierId: "",
    supplierName: "",
    storeId: "",
    storeName: "",
    comment: "",
  });
  const [items, setItems] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const addItem = (p) => {
    setItems((prev) => [
      ...prev,
      {
        product_id: p.id,
        product_name: p.name,
        quantity: "",
        unit: p.mainUnit || "шт",
        totalPrice: "",
      },
    ]);
  };

  const updateItem = (idx, field, value) => {
    setItems((p) =>
      p.map((x, i) => (i === idx ? { ...x, [field]: value } : x))
    );
  };

  const handleSubmit = async () => {
    if (!form.supplierId || !form.storeId || items.length === 0) {
      showToast("Заполните все поля", "error");
      return;
    }
    const prepared = items
      .map((it) => {
        const qty = parseFloat(it.quantity) || 0;
        const total = parseFloat(it.totalPrice) || 0;
        const price = qty > 0 ? total / qty : 0;
        return {
          product_id: it.product_id,
          product_name: it.product_name,
          quantity: qty,
          unit: it.unit,
          price,
          total,
        };
      })
      .filter((it) => it.quantity > 0);
    if (prepared.length === 0) {
      showToast("Укажите количество", "error");
      return;
    }
    setSubmitting(true);
    const result = await API.createInvoice({
      supplier_id: form.supplierId,
      supplier_name: form.supplierName,
      store_id: form.storeId,
      store_name: form.storeName,
      items: prepared,
      comment: form.comment,
      user: {
        tg_id: loggedInUser.tg_id,
        name: loggedInUser.name,
        role: loggedInUser.role,
      },
    });
    setSubmitting(false);
    if (result?.success) {
      showToast("Накладная создана!");
      loadHistory();
      setMode("idle");
      setStep(0);
      setItems([]);
      setForm({
        supplierId: "",
        supplierName: "",
        storeId: "",
        storeName: "",
        comment: "",
      });
    } else showToast("Ошибка создания", "error");
  };

  const grandTotal = items.reduce(
    (s, i) => s + (parseFloat(i.totalPrice) || 0),
    0
  );

  return (
    <div style={{ animation: "fadeIn .25s ease" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
          Приходная накладная
        </h2>
        {mode === "idle" ? (
          <Btn
            onClick={() => {
              setMode("new");
              setStep(0);
            }}
          >
            {I.plus} Новый приход
          </Btn>
        ) : (
          <Btn
            outline
            onClick={() => {
              setMode("idle");
              setStep(0);
              setItems([]);
            }}
          >
            {I.x} Отмена
          </Btn>
        )}
      </div>
      {mode === "idle" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div className="horizontal-scroll-container" style={{ display: "flex", gap: 10, marginBottom: 12, marginTop: 4 }}>
            {[
              {
                id: "db_history",
                label: "📋 История сайта",
                grad: "linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)",
                text: "#0369a1",
              },
              {
                id: "iiko_history",
                label: "🌐 История iiko",
                grad: "linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)",
                text: "#4338ca",
              },
            ].map((sub) => (
              <button
                key={sub.id}
                onClick={() => setSubTab(sub.id)}
                style={{
                  padding: "9px 15px",
                  borderRadius: 10,
                  border: subTab === sub.id ? "none" : "1px solid var(--border-color)",
                  background: subTab === sub.id ? sub.grad : "var(--bg-card)",
                  color: subTab === sub.id ? sub.text : "var(--text-muted)",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                  boxShadow:
                    subTab === sub.id
                      ? "0 4px 10px rgba(99, 102, 241, 0.08)"
                      : "none",
                  transition: "all 0.15s ease",
                }}
              >
                {sub.label}
              </button>
            ))}
          </div>

          {subTab === "iiko_history" ? (
            <div>
              <IikoHistoryList
                type="INCOMING_INVOICE"
                showToast={showToast}
                stores={stores}
                products={products}
              />
            </div>
          ) : (
            <div>
              <HistoryList
                history={history.filter((act) => act.action_type === "invoice")}
                loading={historyLoading}
                onRefresh={loadHistory}
                emptyText="История приходов пуста"
                onRestore={(act) => {
                  if (act.details) {
                    setForm({
                      supplierId: act.details.supplier_id || "",
                      supplierName: act.details.supplier_name || "",
                      storeId: act.details.store_id || "",
                      storeName: act.details.store_name || "",
                      comment: act.details.comment || "",
                    });
                    setItems(
                      (act.details.items || []).map((it) => ({
                        product_id: it.product_id,
                        product_name: it.product_name,
                        quantity: it.quantity,
                        unit: it.unit || "шт",
                        totalPrice: it.price
                          ? String(it.price * it.quantity)
                          : "",
                      }))
                    );
                    setMode("new");
                    setStep(2);
                    showToast("Черновик успешно восстановлен!");
                  }
                }}
              />
            </div>
          )}
        </div>
      )}
      {mode === "new" && (
        <div
          style={{
            background: "var(--bg-card)",
            borderRadius: 14,
            border: "1px solid var(--border-color)",
            padding: 24,
          }}
        >
          <StepBar steps={["Поставщик", "Склад", "Товары"]} current={step} />

          {step === 0 && (
            <div>
              <label style={lbl}>Поставщик</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {suppliers.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setForm({
                        ...form,
                        supplierId: s.id,
                        supplierName: s.name,
                      });
                      setStep(1);
                    }}
                    style={storeBtn}
                  >
                    <span style={{ fontSize: 20 }}>🏢</span>
                    <div style={{ fontWeight: 600 }}>{s.name}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <div style={crumb}>✅ {form.supplierName}</div>
              <label style={lbl}>Склад</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {stores.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setForm({ ...form, storeId: s.id, storeName: s.name });
                      setStep(2);
                    }}
                    style={storeBtn}
                  >
                    <span style={{ fontSize: 20 }}>
                      {STORE_ICONS[s.id] || "📦"}
                    </span>
                    <div>{s.name}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div style={crumb}>
                ✅ {form.supplierName} → {form.storeName}
              </div>
              {loading ? (
                <LoadingBlock text="Загрузка товаров..." />
              ) : products.length === 0 ? (
                <ErrorBlock text="Товары не загрузились" onRetry={onRetry} />
              ) : (
                <>
                  <ProductSearch products={products} onSelect={addItem} />
                  {items.length > 0 && (
                    <div
                      style={{
                        border: "1px solid var(--border-color)",
                        borderRadius: 10,
                        overflow: "hidden",
                        marginTop: 12,
                      }}
                    >
                      <table
                        style={{
                          width: "100%",
                          borderCollapse: "collapse",
                          fontSize: 12,
                        }}
                      >
                        <thead>
                          <tr style={{ background: "#f8fafb" }}>
                            <th style={th}>Товар</th>
                            <th
                              style={{ ...th, textAlign: "center", width: 100 }}
                            >
                              Кол-во
                            </th>
                            <th
                              style={{ ...th, textAlign: "center", width: 120 }}
                            >
                              Сумма общая
                            </th>
                            <th style={{ ...th, width: 36 }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((it, idx) => (
                            <tr
                              key={idx}
                              style={{ borderTop: "1px solid #f0f2f5" }}
                            >
                              <td style={td}>
                                <div style={{ fontWeight: 500 }}>
                                  {it.product_name}
                                </div>
                                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                                  {it.unit}
                                </div>
                              </td>
                              <td style={{ ...td, textAlign: "center" }}>
                                <div
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 6,
                                    justifyContent: "center",
                                  }}
                                >
                                  <input
                                    type="number"
                                    value={it.quantity}
                                    onChange={(e) =>
                                      updateItem(
                                        idx,
                                        "quantity",
                                        it.unit === "шт"
                                          ? e.target.value
                                              .split(".")[0]
                                              .split(",")[0]
                                          : e.target.value
                                      )
                                    }
                                    placeholder="0"
                                    style={numInput}
                                  />
                                  <span
                                    style={{
                                      fontSize: 12,
                                      color: "var(--text-muted)",
                                      minWidth: 24,
                                      textAlign: "left",
                                      fontWeight: 600,
                                    }}
                                  >
                                    {it.unit || "шт"}
                                  </span>
                                </div>
                              </td>
                              <td style={{ ...td, textAlign: "center" }}>
                                <input
                                  type="number"
                                  value={it.totalPrice}
                                  onChange={(e) =>
                                    updateItem(
                                      idx,
                                      "totalPrice",
                                      e.target.value
                                    )
                                  }
                                  placeholder="0"
                                  style={numInput}
                                />
                              </td>
                              <td style={td}>
                                <button
                                  onClick={() =>
                                    setItems((p) =>
                                      p.filter((_, i) => i !== idx)
                                    )
                                  }
                                  style={{
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    color: "#ef4444",
                                    display: "flex",
                                  }}
                                >
                                  {I.trash}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <label style={{ ...lbl, marginTop: 16 }}>Комментарий</label>
                  <input
                    value={form.comment}
                    onChange={(e) =>
                      setForm({ ...form, comment: e.target.value })
                    }
                    placeholder="Необязательно"
                    style={inp}
                  />
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      marginTop: 16,
                      justifyContent: "flex-end",
                    }}
                  >
                    <Btn outline onClick={() => setStep(1)}>
                      ← Назад
                    </Btn>
                    <Btn
                      onClick={handleSubmit}
                      disabled={submitting || items.length === 0}
                    >
                      {submitting ? I.loader : I.send}{" "}
                      {submitting ? "Отправка..." : "Провести"}
                    </Btn>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TransferView({
  products,
  stores,
  showToast,
  loading,
  onRetry,
  loggedInUser,
  loadHistory,
  history,
  historyLoading,
}) {
  const [mode, setMode] = useState("idle");

  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    fromId: "",
    fromName: "",
    toId: "",
    toName: "",
    comment: "",
  });
  const [items, setItems] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // States for pending transfers workflow
  const [pendingTransfers, setPendingTransfers] = useState({ incoming: [], returned: [], outgoing: [] });
  const [pendingLoading, setPendingLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editedItems, setEditedItems] = useState([]);
  const [receiverCommentText, setReceiverCommentText] = useState("");
  const [actionSubmittingId, setActionSubmittingId] = useState(null);
  const [subTab, setSubTab] = useState("db_history");

  const loadPendingTransfers = async () => {
    if (!loggedInUser) return;
    setPendingLoading(true);
    try {
      const res = await API.getPendingTransfers(loggedInUser.tg_id, loggedInUser.storeId);
      if (res && res.success) {
        setPendingTransfers({
          incoming: res.incoming || [],
          returned: res.returned || [],
          outgoing: res.outgoing || [],
        });
      }
    } catch (e) {
      console.error("Failed to load pending transfers:", e);
    } finally {
      setPendingLoading(false);
    }
  };

  useEffect(() => {
    loadPendingTransfers();
  }, [loggedInUser]);

  const handlePendingAction = async (id, action, targetItem) => {
    setActionSubmittingId(id);
    try {
      const res = await API.createTransfer({
        action,
        id,
        store_from: targetItem.store_from,
        store_from_name: targetItem.store_from_name,
        store_to: targetItem.store_to,
        store_to_name: targetItem.store_to_name,
        items: targetItem.items,
        comment: targetItem.comment,
        receiver_comment: targetItem.receiver_comment || receiverCommentText,
        user: {
          tg_id: loggedInUser.tg_id,
          name: loggedInUser.name,
          role: loggedInUser.role,
        },
      });

      if (res && res.success) {
        if (action === "approve_by_receiver" || action === "approve_by_creator" || res.documentNumber) {
          showToast(`Перемещение проведено в iiko! Номер: ${res.documentNumber || ""}`);
        } else if (action === "reject_by_receiver" || action === "reject_by_creator") {
          showToast("Перемещение отклонено и отменено.");
        } else if (action === "modify_by_receiver") {
          showToast("Изменения отправлены снабженцу.");
        }
        setEditingId(null);
        setReceiverCommentText("");
        loadPendingTransfers();
        loadHistory();
      } else {
        showToast(res?.error || "Произошла ошибка при выполнении операции", "error");
      }
    } catch (e) {
      console.error(e);
      showToast("Ошибка при обработке перемещения", "error");
    } finally {
      setActionSubmittingId(null);
    }
  };

  const addItem = (p) => {
    setItems((prev) => {
      if (prev.find((i) => i.product_id === p.id)) return prev;
      return [
        ...prev,
        {
          product_id: p.id,
          product_name: p.name,
          quantity: "",
          unit: p.mainUnit || "шт",
        },
      ];
    });
  };

  const updateItem = (idx, field, value) => {
    setItems((p) =>
      p.map((x, i) => (i === idx ? { ...x, [field]: value } : x))
    );
  };

  const handleSubmit = async () => {
    if (!form.fromId || !form.toId || items.length === 0) {
      showToast("Заполните все поля", "error");
      return;
    }
    const prepared = items
      .map((it) => ({
        product_id: it.product_id,
        product_name: it.product_name,
        quantity: parseFloat(it.quantity) || 0,
        unit: it.unit,
      }))
      .filter((it) => it.quantity > 0);
    if (prepared.length === 0) {
      showToast("Укажите количество", "error");
      return;
    }
    setSubmitting(true);
    const result = await API.createTransfer({
      store_from: form.fromId,
      store_from_name: form.fromName,
      store_to: form.toId,
      store_to_name: form.toName,
      items: prepared,
      comment: form.comment,
      user: {
        tg_id: loggedInUser.tg_id,
        name: loggedInUser.name,
        role: loggedInUser.role,
      },
    });
    setSubmitting(false);
    if (result?.success) {
      showToast("Перемещение отправлено на согласование!");
      loadPendingTransfers();
      loadHistory();
      setMode("idle");
      setStep(0);
      setItems([]);
      setForm({ fromId: "", fromName: "", toId: "", toName: "", comment: "" });
    } else showToast("Ошибка перемещения", "error");
  };

  const availableTo = stores.filter((s) => {
    if (s.id === form.fromId) return false;
    if (loggedInUser?.storeId && form.fromId !== loggedInUser.storeId) {
      return s.id === loggedInUser.storeId;
    }
    return true;
  });

  return (
    <div style={{ animation: "fadeIn .25s ease" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
          Перемещение
        </h2>
        {mode === "idle" ? (
          <Btn
            onClick={() => {
              setMode("new");
              setStep(0);
            }}
          >
            {I.plus} Новое
          </Btn>
        ) : (
          <Btn
            outline
            onClick={() => {
              setMode("idle");
              setStep(0);
              setItems([]);
            }}
          >
            {I.x} Отмена
          </Btn>
        )}
      </div>
      {mode === "idle" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {(pendingTransfers.incoming.length > 0 ||
            pendingTransfers.returned.length > 0 ||
            pendingTransfers.outgoing.length > 0) && (
            <div
              style={{
                background: "rgba(255, 255, 255, 0.45)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                borderRadius: 16,
                border: "1px solid rgba(226, 232, 240, 0.8)",
                padding: 20,
                boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.04)",
              }}
            >
              <h3
                style={{
                  margin: "0 0 16px 0",
                  fontSize: 15,
                  fontWeight: 700,
                  color: "var(--text-main)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span>🔔 На согласовании</span>
                <span
                  style={{
                    background: "#ef4444",
                    color: "#fff",
                    fontSize: 10,
                    fontWeight: 800,
                    padding: "2px 6px",
                    borderRadius: 12,
                    lineHeight: 1.2,
                  }}
                >
                  {pendingTransfers.incoming.length +
                    pendingTransfers.returned.length +
                    pendingTransfers.outgoing.length}
                </span>
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {pendingTransfers.incoming.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      background: "var(--bg-card)",
                      borderRadius: 12,
                      border: "1px solid var(--border-color)",
                      padding: 16,
                      boxShadow: "0 2px 8px rgba(0,0,0,0.01)",
                      animation: "fadeIn .25s ease",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: 12,
                        flexWrap: "wrap",
                        gap: 12,
                      }}
                    >
                      <div>
                        <span
                          style={{
                            background: "#e0f2fe",
                            color: "#0369a1",
                            fontSize: 9,
                            fontWeight: 800,
                            padding: "3px 8px",
                            borderRadius: 6,
                            textTransform: "uppercase",
                            letterSpacing: 0.5,
                          }}
                        >
                          Входящее перемещение
                        </span>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: "var(--text-main)",
                            marginTop: 6,
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <span>{STORE_ICONS[item.store_from] || "📦"} {item.store_from_name}</span>
                          <span style={{ color: "#6366f1", fontSize: 12 }}>{I.arrow || "→"}</span>
                          <span>{STORE_ICONS[item.store_to] || "📦"} {item.store_to_name}</span>
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                          Создал: <b>{item.creator_name}</b> • {new Date(item.created_at).toLocaleString("ru-RU")}
                        </div>
                      </div>

                      {item.comment && (
                        <div
                          style={{
                            background: "#f8fafb",
                            border: "1px solid var(--border-color)",
                            borderRadius: 8,
                            padding: "8px 12px",
                            fontSize: 12,
                            maxWidth: 300,
                            color: "var(--text-muted)",
                            wordBreak: "break-word",
                          }}
                        >
                          💬 <i>{item.comment}</i>
                        </div>
                      )}
                    </div>

                    {editingId === item.id ? (
                      <div>
                        <label style={lbl}>Введите фактически полученное количество:</label>
                        <div
                          style={{
                            border: "1px solid var(--border-color)",
                            borderRadius: 10,
                            overflow: "hidden",
                            marginTop: 6,
                          }}
                        >
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                            <thead>
                              <tr style={{ background: "#f8fafb" }}>
                                <th style={th}>Товар</th>
                                <th style={{ ...th, textAlign: "right", width: 90 }}>Отправлено</th>
                                <th style={{ ...th, textAlign: "center", width: 130 }}>Получено (факт)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {editedItems.map((it, idx) => (
                                <tr key={idx} style={{ borderTop: "1px solid var(--border-color)" }}>
                                  <td style={td}>
                                    <div style={{ fontWeight: 500 }}>{it.product_name}</div>
                                    <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{it.unit}</div>
                                  </td>
                                  <td style={{ ...td, textAlign: "right", fontWeight: 600, color: "var(--text-muted)" }}>
                                    {it.quantity} {it.unit}
                                  </td>
                                  <td style={{ ...td, textAlign: "center" }}>
                                    <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                      <input
                                        type="number"
                                        value={it.received_quantity}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setEditedItems((prev) =>
                                            prev.map((x, i) =>
                                              i === idx
                                                ? {
                                                    ...x,
                                                    received_quantity:
                                                      it.unit === "шт"
                                                        ? val.split(".")[0].split(",")[0]
                                                        : val,
                                                  }
                                                : x
                                            )
                                          );
                                        }}
                                        placeholder={it.quantity}
                                        style={{ ...numInput, width: 70 }}
                                      />
                                      <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>
                                        {it.unit}
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div style={{ marginTop: 12 }}>
                          <label style={lbl}>Комментарий к расхождению:</label>
                          <input
                            value={receiverCommentText}
                            onChange={(e) => setReceiverCommentText(e.target.value)}
                            placeholder="Например: недовезли 2 штуки..."
                            style={inp}
                          />
                        </div>

                        <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
                          <Btn outline onClick={() => setEditingId(null)} disabled={actionSubmittingId !== null}>
                            Отмена
                          </Btn>
                          <Btn
                            onClick={() => {
                              const updated = {
                                ...item,
                                items: editedItems.map((it) => ({
                                  ...it,
                                  received_quantity:
                                    it.received_quantity === ""
                                      ? it.quantity
                                      : parseFloat(it.received_quantity) || 0,
                                })),
                                receiver_comment: receiverCommentText,
                              };
                              handlePendingAction(item.id, "modify_by_receiver", updated);
                            }}
                            disabled={actionSubmittingId !== null}
                          >
                            {actionSubmittingId === item.id ? I.loader : I.send} Отправить исправления
                          </Btn>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ border: "1px solid #f1f5f9", borderRadius: 10, overflow: "hidden" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                            <thead>
                              <tr style={{ background: "#f8fafb" }}>
                                <th style={th}>Товар</th>
                                <th style={{ ...th, textAlign: "right", width: 120 }}>Количество</th>
                              </tr>
                            </thead>
                            <tbody>
                              {item.items.map((it, idx) => (
                                <tr key={idx} style={{ borderTop: "1px solid #f1f5f9" }}>
                                  <td style={td}>
                                    <div style={{ fontWeight: 500 }}>{it.product_name}</div>
                                    <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{it.unit}</div>
                                  </td>
                                  <td style={{ ...td, textAlign: "right", fontWeight: 600, color: "var(--text-main)" }}>
                                    {it.quantity} {it.unit}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end", flexWrap: "wrap" }}>
                          <button
                            onClick={() => handlePendingAction(item.id, "reject_by_receiver", item)}
                            disabled={actionSubmittingId !== null}
                            style={{
                              padding: "8px 14px",
                              borderRadius: 8,
                              border: "1px solid #ef4444",
                              background: "transparent",
                              color: "#ef4444",
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            Отклонить
                          </button>

                          <button
                            onClick={() => {
                              setEditingId(item.id);
                              setEditedItems(
                                item.items.map((x) => ({
                                  ...x,
                                  received_quantity:
                                    x.received_quantity !== null
                                      ? x.received_quantity
                                      : x.quantity,
                                }))
                              );
                              setReceiverCommentText("");
                            }}
                            disabled={actionSubmittingId !== null}
                            style={{
                              padding: "8px 14px",
                              borderRadius: 8,
                              border: "1px solid #6366f1",
                              background: "transparent",
                              color: "#6366f1",
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            Изменить кол-во
                          </button>

                          <button
                            onClick={() => handlePendingAction(item.id, "approve_by_receiver", item)}
                            disabled={actionSubmittingId !== null}
                            style={{
                              padding: "8px 16px",
                              borderRadius: 8,
                              border: "none",
                              background: "#10b981",
                              color: "#fff",
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            {actionSubmittingId === item.id ? I.loader : "Принять"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {pendingTransfers.returned.map((item) => {
                  const isCreatorReceiver = String(item.store_to) === String(loggedInUser?.storeId);
                  return (
                    <div
                      key={item.id}
                      style={{
                        background: "var(--bg-card)",
                        borderRadius: 12,
                        border: "1px solid #fbcfe8",
                        padding: 16,
                        boxShadow: "0 2px 8px rgba(0,0,0,0.01)",
                        animation: "fadeIn .25s ease",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          marginBottom: 12,
                          flexWrap: "wrap",
                          gap: 12,
                        }}
                      >
                        <div>
                          <span
                            style={{
                              background: "#fce7f3",
                              color: "#db2777",
                              fontSize: 9,
                              fontWeight: 800,
                              padding: "3px 8px",
                              borderRadius: 6,
                              textTransform: "uppercase",
                              letterSpacing: 0.5,
                            }}
                          >
                            {isCreatorReceiver ? "Отправитель вернул с изменениями" : "Получатель вернул с изменениями"}
                          </span>
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 700,
                              color: "var(--text-main)",
                              marginTop: 6,
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <span>{STORE_ICONS[item.store_from] || "📦"} {item.store_from_name}</span>
                            <span style={{ color: "#6366f1", fontSize: 12 }}>{I.arrow || "→"}</span>
                            <span>{STORE_ICONS[item.store_to] || "📦"} {item.store_to_name}</span>
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                            Отправлено: {new Date(item.created_at).toLocaleString("ru-RU")}
                          </div>
                        </div>

                        {item.receiver_comment && (
                          <div
                            style={{
                              background: "#fff1f2",
                              border: "1px solid #fecdd3",
                              borderRadius: 8,
                              padding: "8px 12px",
                              fontSize: 12,
                              maxWidth: 300,
                              color: "#9f1239",
                              wordBreak: "break-word",
                            }}
                          >
                            💬 <b>{isCreatorReceiver ? "Комментарий отправителя:" : "Комментарий шефа:"}</b><br />
                            <i>{item.receiver_comment}</i>
                          </div>
                        )}
                      </div>

                      <div style={{ border: "1px solid #fbcfe8", borderRadius: 10, overflow: "hidden" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                          <thead>
                            <tr style={{ background: "#fdf2f8" }}>
                              <th style={th}>Товар</th>
                              <th style={{ ...th, textAlign: "right", width: 120 }}>
                                {isCreatorReceiver ? "Было запрошено" : "Было отправлено"}
                              </th>
                              <th style={{ ...th, textAlign: "right", width: 130 }}>
                                {isCreatorReceiver ? "Фактически выдано" : "Фактически принято"}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {item.items.map((it, idx) => {
                              const hasDiff =
                                it.received_quantity !== null &&
                                parseFloat(it.received_quantity) !== parseFloat(it.quantity);
                              return (
                                <tr
                                  key={idx}
                                  style={{
                                    borderTop: "1px solid #fbcfe8",
                                    background: hasDiff ? "#fff5f5" : "none",
                                  }}
                                >
                                  <td style={td}>
                                    <div style={{ fontWeight: 500 }}>{it.product_name}</div>
                                    <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{it.unit}</div>
                                  </td>
                                  <td
                                    style={{
                                      ...td,
                                      textAlign: "right",
                                      color: hasDiff ? "#94a3b8" : "#334155",
                                      fontWeight: 500,
                                    }}
                                  >
                                    {hasDiff ? <s>{it.quantity} {it.unit}</s> : `${it.quantity} ${it.unit}`}
                                  </td>
                                  <td
                                    style={{
                                      ...td,
                                      textAlign: "right",
                                      fontWeight: 700,
                                      color: hasDiff ? "#ef4444" : "#334155",
                                    }}
                                  >
                                    {it.received_quantity !== null
                                      ? `${it.received_quantity} ${it.unit}`
                                      : `${it.quantity} ${it.unit}`}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
                        <button
                          onClick={() => handlePendingAction(item.id, "reject_by_creator", item)}
                          disabled={actionSubmittingId !== null}
                          style={{
                            padding: "8px 14px",
                            borderRadius: 8,
                            border: "1px solid #ef4444",
                            background: "transparent",
                            color: "#ef4444",
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Отклонить изменения
                        </button>

                        <button
                          onClick={() => handlePendingAction(item.id, "approve_by_creator", item)}
                          disabled={actionSubmittingId !== null}
                          style={{
                            padding: "8px 16px",
                            borderRadius: 8,
                            border: "none",
                            background: "#db2777",
                            color: "#fff",
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          {actionSubmittingId === item.id ? I.loader : "Принять изменения"}
                        </button>
                      </div>
                    </div>
                  );
                })}

                {pendingTransfers.outgoing.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      background: "var(--bg-card)",
                      borderRadius: 12,
                      border: "1px solid var(--border-color)",
                      padding: 16,
                      boxShadow: "0 2px 8px rgba(0,0,0,0.01)",
                      animation: "fadeIn .25s ease",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: 12,
                        flexWrap: "wrap",
                        gap: 12,
                      }}
                    >
                      <div>
                        <span
                          style={{
                            background: "#fef3c7",
                            color: "#b45309",
                            fontSize: 9,
                            fontWeight: 800,
                            padding: "3px 8px",
                            borderRadius: 6,
                            textTransform: "uppercase",
                            letterSpacing: 0.5,
                          }}
                        >
                          {item.status === "pending_receiver"
                            ? "На согласовании у получателя"
                            : "На согласовании у отправителя"}
                        </span>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: "var(--text-main)",
                            marginTop: 6,
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <span>{STORE_ICONS[item.store_from] || "📦"} {item.store_from_name}</span>
                          <span style={{ color: "#6366f1", fontSize: 12 }}>{I.arrow || "→"}</span>
                          <span>{STORE_ICONS[item.store_to] || "📦"} {item.store_to_name}</span>
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                          Создано вами: {new Date(item.created_at).toLocaleString("ru-RU")}
                        </div>
                      </div>
                    </div>

                    <div style={{ border: "1px solid var(--border-color)", borderRadius: 10, overflow: "hidden" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: "var(--bg-hover)" }}>
                            <th style={th}>Товар</th>
                            <th style={{ ...th, textAlign: "right", width: 120 }}>Кол-во</th>
                          </tr>
                        </thead>
                        <tbody>
                          {item.items.map((it, idx) => (
                            <tr key={idx} style={{ borderTop: "1px solid var(--border-color)" }}>
                              <td style={td}>
                                <div style={{ fontWeight: 500 }}>{it.product_name}</div>
                                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{it.unit}</div>
                              </td>
                              <td style={{ ...td, textAlign: "right", fontWeight: 700, color: "var(--text-main)" }}>
                                {it.quantity} {it.unit}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {item.comment && (
                      <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>
                        💬 Комментарий: {item.comment}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="horizontal-scroll-container" style={{ display: "flex", gap: 10, marginBottom: 12, marginTop: 4 }}>
            {[
              {
                id: "db_history",
                label: "📋 История сайта",
                grad: "linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)",
                text: "#0369a1",
              },
              {
                id: "iiko_history",
                label: "🌐 История iiko",
                grad: "linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)",
                text: "#4338ca",
              },
            ].map((sub) => (
              <button
                key={sub.id}
                onClick={() => setSubTab(sub.id)}
                style={{
                  padding: "9px 15px",
                  borderRadius: 10,
                  border: subTab === sub.id ? "none" : "1px solid var(--border-color)",
                  background: subTab === sub.id ? sub.grad : "var(--bg-card)",
                  color: subTab === sub.id ? sub.text : "var(--text-muted)",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                  boxShadow:
                    subTab === sub.id
                      ? "0 4px 10px rgba(99, 102, 241, 0.08)"
                      : "none",
                  transition: "all 0.15s ease",
                }}
              >
                {sub.label}
              </button>
            ))}
          </div>

          {subTab === "iiko_history" ? (
            <div>
              <IikoHistoryList
                type="INTERNAL_TRANSFER"
                showToast={showToast}
                stores={stores}
                products={products}
              />
            </div>
          ) : (
            <div>
              <HistoryList
                history={history.filter((act) => act.action_type === "transfer")}
                loading={historyLoading}
                onRefresh={() => {
                  loadPendingTransfers();
                  loadHistory();
                }}
                emptyText="История перемещений пуста"
                onRestore={(act) => {
                  if (act.details) {
                    setForm({
                      fromId: act.details.store_from || "",
                      fromName: act.details.store_from_name || "",
                      toId: act.details.store_to || "",
                      toName: act.details.store_to_name || "",
                      comment: act.details.comment || "",
                    });
                    setItems(
                      (act.details.items || []).map((it) => ({
                        product_id: it.product_id,
                        product_name: it.product_name,
                        quantity: it.quantity,
                        unit: it.unit || "шт",
                      }))
                    );
                    setMode("new");
                    setStep(2);
                    showToast("Черновик успешно восстановлен!");
                  }
                }}
              />
            </div>
          )}
        </div>
      )}
      {mode === "new" && (
        <div
          style={{
            background: "var(--bg-card)",
            borderRadius: 14,
            border: "1px solid var(--border-color)",
            padding: 24,
          }}
        >
          <StepBar steps={["Откуда", "Куда", "Товары"]} current={step} />

          {step === 0 && (
            <div>
              <label style={lbl}>Откуда</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {stores.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setForm({ ...form, fromId: s.id, fromName: s.name });
                      setStep(1);
                    }}
                    style={storeBtn}
                  >
                    <span style={{ fontSize: 20 }}>
                      {STORE_ICONS[s.id] || "📦"}
                    </span>
                    <div>{s.name}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <div style={crumb}>
                ✅ Откуда: <b>{form.fromName}</b>
              </div>
              <label style={lbl}>Куда</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {availableTo.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setForm({ ...form, toId: s.id, toName: s.name });
                      setStep(2);
                    }}
                    style={storeBtn}
                  >
                    <span style={{ fontSize: 20 }}>
                      {STORE_ICONS[s.id] || "📦"}
                    </span>
                    <div>{s.name}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div
                style={{
                  ...crumb,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                ✅ {form.fromName}{" "}
                <span style={{ color: "#6366f1" }}>{I.arrow}</span>{" "}
                {form.toName}
              </div>
              {loading ? (
                <LoadingBlock text="Загрузка товаров..." />
              ) : products.length === 0 ? (
                <ErrorBlock text="Товары не загрузились" onRetry={onRetry} />
              ) : (
                <>
                  <ProductSearch products={products} onSelect={addItem} />
                  {items.length > 0 && (
                    <div
                      style={{
                        border: "1px solid var(--border-color)",
                        borderRadius: 10,
                        overflow: "hidden",
                        marginTop: 12,
                      }}
                    >
                      <table
                        style={{
                          width: "100%",
                          borderCollapse: "collapse",
                          fontSize: 12,
                        }}
                      >
                        <thead>
                          <tr style={{ background: "#f8fafb" }}>
                            <th style={th}>Товар</th>
                            <th
                              style={{ ...th, textAlign: "center", width: 100 }}
                            >
                              Кол-во
                            </th>
                            <th style={{ ...th, width: 36 }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((it, idx) => (
                            <tr
                              key={idx}
                              style={{ borderTop: "1px solid #f0f2f5" }}
                            >
                              <td style={td}>
                                <div style={{ fontWeight: 500 }}>
                                  {it.product_name}
                                </div>
                                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                                  {it.unit}
                                </div>
                              </td>
                              <td style={{ ...td, textAlign: "center" }}>
                                <div
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 6,
                                    justifyContent: "center",
                                  }}
                                >
                                  <input
                                    type="number"
                                    value={it.quantity}
                                    onChange={(e) =>
                                      updateItem(
                                        idx,
                                        "quantity",
                                        it.unit === "шт"
                                          ? e.target.value
                                              .split(".")[0]
                                              .split(",")[0]
                                          : e.target.value
                                      )
                                    }
                                    placeholder="0"
                                    style={numInput}
                                  />
                                  <span
                                    style={{
                                      fontSize: 12,
                                      color: "var(--text-muted)",
                                      minWidth: 24,
                                      textAlign: "left",
                                      fontWeight: 600,
                                    }}
                                  >
                                    {it.unit || "шт"}
                                  </span>
                                </div>
                              </td>
                              <td style={td}>
                                <button
                                  onClick={() =>
                                    setItems((p) =>
                                      p.filter((_, i) => i !== idx)
                                    )
                                  }
                                  style={{
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    color: "#ef4444",
                                    display: "flex",
                                  }}
                                >
                                  {I.trash}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <label style={{ ...lbl, marginTop: 16 }}>Комментарий</label>
                  <input
                    value={form.comment}
                    onChange={(e) =>
                      setForm({ ...form, comment: e.target.value })
                    }
                    placeholder="Необязательно"
                    style={inp}
                  />
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      marginTop: 16,
                      justifyContent: "flex-end",
                    }}
                  >
                    <Btn outline onClick={() => setStep(1)}>
                      ← Назад
                    </Btn>
                    <Btn
                      onClick={handleSubmit}
                      disabled={submitting || items.length === 0}
                    >
                      {submitting ? I.loader : I.send}{" "}
                      {submitting ? "Отправка..." : "Провести"}
                    </Btn>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  INVENTORY — склад → товары (поиск + кол-во) с автосохранением черновика
// ═══════════════════════════════════════════════════════════════

function InventoryView({
  products,
  stores,
  showToast,
  loading,
  onRetry,
  loggedInUser,
  loadHistory,
  history,
  historyLoading,
}) {
  const [mode, setMode] = useState("idle");
  const [subTab, setSubTab] = useState("db_history");
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    storeId: "",
    storeName: "",
    comment: "",
  });
  const [items, setItems] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);

  useEffect(() => {
    if (loggedInUser && loggedInUser.storeId && stores.length > 0) {
      const boundStore = stores.find((s) => s.id === loggedInUser.storeId);
      if (boundStore) {
        setForm((f) => ({
          ...f,
          storeId: boundStore.id,
          storeName: boundStore.name,
        }));
        setStep(1);
      }
    }
  }, [loggedInUser, stores]);

  // Load draft when store is selected
  useEffect(() => {
    if (form.storeId) {
      const saved = localStorage.getItem(
        "locmaco_inventory_draft_" + form.storeId
      );
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setItems(parsed);
            setDraftRestored(true);
            setTimeout(() => setDraftRestored(false), 3000);
          } else {
            setItems([]);
          }
        } catch (_e) {
          setItems([]);
        }
      } else {
        setItems([]);
      }
    } else {
      setItems([]);
    }
  }, [form.storeId]);

  useEffect(() => {
    if (form.storeId) {
      if (items.length > 0) {
        try {
          localStorage.setItem(
            "locmaco_inventory_draft_" + form.storeId,
            JSON.stringify(items)
          );
        } catch (e) {
          console.error("Failed to save inventory draft to localStorage:", e);
        }
      } else {
        localStorage.removeItem("locmaco_inventory_draft_" + form.storeId);
      }
    }
  }, [items, form.storeId]);

  const addItem = (p) => {
    setItems((prev) => {
      if (prev.find((i) => i.product_id === p.id)) return prev;
      return [
        ...prev,
        {
          product_id: p.id,
          product_name: p.name,
          quantity: "",
          unit: p.mainUnit || "шт",
        },
      ];
    });
  };

  const updateItem = (idx, field, value) => {
    setItems((p) =>
      p.map((x, i) => (i === idx ? { ...x, [field]: value } : x))
    );
  };

  const clearDraft = () => {
    if (window.confirm("Очистить текущий черновик?")) {
      setItems([]);
      if (form.storeId) {
        localStorage.removeItem("locmaco_inventory_draft_" + form.storeId);
      }
      showToast("Черновик очищен");
    }
  };

  const handleSubmit = async () => {
    if (!form.storeId || items.length === 0) {
      showToast("Выберите склад и укажите товары", "error");
      return;
    }
    const prepared = items
      .map((it) => ({
        product_id: it.product_id,
        product_name: it.product_name,
        quantity: parseFloat(it.quantity) || 0,
        unit: it.unit,
      }))
      .filter((it) => it.quantity > 0);
    if (prepared.length === 0) {
      showToast("Укажите количество", "error");
      return;
    }
    setSubmitting(true);
    const result = await API.createInventory({
      store_id: form.storeId,
      store_name: form.storeName,
      items: prepared,
      comment: form.comment,
      user: {
        tg_id: loggedInUser.tg_id,
        name: loggedInUser.name,
        role: loggedInUser.role,
      },
    });
    setSubmitting(false);
    if (result?.success) {
      showToast("Инвентаризация проведена!");
      localStorage.removeItem("locmaco_inventory_draft_" + form.storeId);
      loadHistory();
      setMode("idle");
      setItems([]);
      if (loggedInUser?.storeId) {
        setStep(1);
        const boundStore = stores.find((s) => s.id === loggedInUser.storeId);
        setForm({
          storeId: boundStore?.id || "",
          storeName: boundStore?.name || "",
          comment: "",
        });
      } else {
        setStep(0);
        setForm({ storeId: "", storeName: "", comment: "" });
      }
    } else {
      showToast("Ошибка создания", "error");
    }
  };

  return (
    <div style={{ animation: "fadeIn .25s ease" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
          Инвентаризация остатков
        </h2>
        {mode === "idle" ? (
          <Btn
            onClick={() => {
              setMode("new");
              if (loggedInUser?.storeId) {
                setStep(1);
                const boundStore = stores.find(
                  (s) => s.id === loggedInUser.storeId
                );
                setForm({
                  storeId: boundStore?.id || "",
                  storeName: boundStore?.name || "",
                  comment: "",
                });
              } else {
                setStep(0);
              }
            }}
          >
            {I.plus} Пересчет
          </Btn>
        ) : (
          <Btn
            outline
            onClick={() => {
              setMode("idle");
              setItems([]);
              if (loggedInUser?.storeId) {
                setStep(1);
                const boundStore = stores.find(
                  (s) => s.id === loggedInUser.storeId
                );
                setForm({
                  storeId: boundStore?.id || "",
                  storeName: boundStore?.name || "",
                  comment: "",
                });
              } else {
                setStep(0);
                setForm({ storeId: "", storeName: "", comment: "" });
              }
            }}
          >
            {I.x} Отмена
          </Btn>
        )}
      </div>
      {mode === "idle" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div className="horizontal-scroll-container" style={{ display: "flex", gap: 10, marginBottom: 12, marginTop: 4 }}>
            {[
              {
                id: "db_history",
                label: "📋 История сайта",
                grad: "linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)",
                text: "#0369a1",
              },
              {
                id: "iiko_history",
                label: "🌐 История iiko",
                grad: "linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)",
                text: "#4338ca",
              },
            ].map((sub) => (
              <button
                key={sub.id}
                onClick={() => setSubTab(sub.id)}
                style={{
                  padding: "9px 15px",
                  borderRadius: 10,
                  border: subTab === sub.id ? "none" : "1px solid var(--border-color)",
                  background: subTab === sub.id ? sub.grad : "var(--bg-card)",
                  color: subTab === sub.id ? sub.text : "var(--text-muted)",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                  boxShadow:
                    subTab === sub.id
                      ? "0 4px 10px rgba(99, 102, 241, 0.08)"
                      : "none",
                  transition: "all 0.15s ease",
                }}
              >
                {sub.label}
              </button>
            ))}
          </div>

          {subTab === "iiko_history" ? (
            <div>
              <IikoHistoryList
                type="INVENTORY"
                showToast={showToast}
                stores={stores}
                products={products}
              />
            </div>
          ) : (
            <div>
              <HistoryList
                history={history.filter((act) => act.action_type === "inventory")}
                loading={historyLoading}
                onRefresh={loadHistory}
                emptyText="История инвентаризаций пуста"
                onRestore={(act) => {
                  if (act.details) {
                    setForm({
                      storeId: act.details.store_id || "",
                      storeName: act.details.store_name || "",
                      comment: act.details.comment || "",
                    });
                    setItems(
                      (act.details.items || []).map((it) => ({
                        product_id: it.product_id,
                        product_name: it.product_name,
                        quantity: it.quantity,
                        unit: it.unit || "шт",
                      }))
                    );
                    setMode("new");
                    setStep(1); // Jump to items step!
                    showToast("Черновик успешно восстановлен!");
                  }
                }}
              />
            </div>
          )}
        </div>
      )}
      {mode === "new" && (
        <div
          style={{
            background: "var(--bg-card)",
            borderRadius: 14,
            border: "1px solid var(--border-color)",
            padding: 24,
          }}
        >
          <StepBar steps={["Выбор склада", "Пересчет"]} current={step} />

          {step === 0 && (
            <div>
              <label style={lbl}>Выберите склад</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {stores.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setForm({ ...form, storeId: s.id, storeName: s.name });
                      setStep(1);
                    }}
                    style={storeBtn}
                  >
                    <span style={{ fontSize: 20 }}>
                      {STORE_ICONS[s.id] || "📦"}
                    </span>
                    <div>{s.name}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <div
                style={{
                  ...crumb,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>
                  🏢 Склад: <b>{form.storeName}</b>
                </span>
                {items.length > 0 && (
                  <button
                    onClick={clearDraft}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#ef4444",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    {I.trash} Очистить черновик
                  </button>
                )}
              </div>

              {draftRestored && (
                <div
                  style={{
                    background: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    color: "var(--text-success)",
                    padding: "10px 14px",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 500,
                    marginBottom: 12,
                    animation: "fadeIn 0.2s ease",
                  }}
                >
                  🔄 Восстановлен черновик автосохранения
                </div>
              )}

              {loading ? (
                <LoadingBlock text="Загрузка товаров..." />
              ) : products.length === 0 ? (
                <ErrorBlock text="Товары не загрузились" onRetry={onRetry} />
              ) : (
                <>
                  <ProductSearch products={products} onSelect={addItem} />
                  {items.length > 0 && (
                    <div
                      style={{
                        border: "1px solid var(--border-color)",
                        borderRadius: 10,
                        overflow: "hidden",
                        marginTop: 12,
                      }}
                    >
                      <table
                        style={{
                          width: "100%",
                          borderCollapse: "collapse",
                          fontSize: 12,
                        }}
                      >
                        <thead>
                          <tr style={{ background: "#f8fafb" }}>
                            <th style={th}>Товар</th>
                            <th
                              style={{ ...th, textAlign: "center", width: 130 }}
                            >
                              Количество
                            </th>
                            <th style={{ ...th, width: 36 }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((it, idx) => (
                            <tr
                              key={idx}
                              style={{ borderTop: "1px solid #f0f2f5" }}
                            >
                              <td style={td}>
                                <div style={{ fontWeight: 500 }}>
                                  {it.product_name}
                                </div>
                                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                                  {it.unit}
                                </div>
                              </td>
                              <td style={{ ...td, textAlign: "center" }}>
                                <div
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 6,
                                    justifyContent: "center",
                                  }}
                                >
                                  <input
                                    type="number"
                                    value={it.quantity}
                                    onChange={(e) =>
                                      updateItem(
                                        idx,
                                        "quantity",
                                        it.unit === "шт"
                                          ? e.target.value
                                              .split(".")[0]
                                              .split(",")[0]
                                          : e.target.value
                                      )
                                    }
                                    placeholder="0"
                                    style={numInput}
                                  />
                                  <span
                                    style={{
                                      fontSize: 12,
                                      color: "var(--text-muted)",
                                      minWidth: 24,
                                      textAlign: "left",
                                      fontWeight: 600,
                                    }}
                                  >
                                    {it.unit || "шт"}
                                  </span>
                                </div>
                              </td>
                              <td style={td}>
                                <button
                                  onClick={() =>
                                    setItems((p) =>
                                      p.filter((_, i) => i !== idx)
                                    )
                                  }
                                  style={{
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    color: "#ef4444",
                                    display: "flex",
                                  }}
                                >
                                  {I.trash}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <label style={{ ...lbl, marginTop: 16 }}>Комментарий</label>
                  <input
                    value={form.comment}
                    onChange={(e) =>
                      setForm({ ...form, comment: e.target.value })
                    }
                    placeholder="Необязательно"
                    style={inp}
                  />

                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      marginTop: 16,
                      justifyContent: "flex-end",
                    }}
                  >
                    <Btn outline onClick={() => setStep(0)}>
                      ← Назад
                    </Btn>
                    <Btn
                      onClick={handleSubmit}
                      disabled={submitting || items.length === 0}
                    >
                      {submitting ? I.loader : I.send}{" "}
                      {submitting ? "Отправка..." : "Провести в iiko"}
                    </Btn>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  PRODUCTION — акты приготовления (списание и оприходование)
// ═══════════════════════════════════════════════════════════════

function ProductionView({
  products,
  stores = [],
  showToast,
  loading,
  onRetry,
  loggedInUser,
  loadHistory,
  history,
  historyLoading,
}) {
  const [mode, setMode] = useState("idle");
  const [subTab, setSubTab] = useState("db_history");
  const [items, setItems] = useState([]);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState("");

  useEffect(() => {
    if (loggedInUser?.storeId) {
      setSelectedStoreId(loggedInUser.storeId);
    } else {
      setSelectedStoreId("");
    }
  }, [loggedInUser]);

  useEffect(() => {
    if (mode === "new") {
      const saved = localStorage.getItem("locmaco_production_draft");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setItems(parsed);
            setDraftRestored(true);
            setTimeout(() => setDraftRestored(false), 3000);
          } else {
            setItems([]);
          }
        } catch (_e) {
          setItems([]);
        }
      } else {
        setItems([]);
      }
    } else {
      setItems([]);
    }
  }, [mode]);

  useEffect(() => {
    if (mode === "new") {
      if (items.length > 0) {
        try {
          localStorage.setItem("locmaco_production_draft", JSON.stringify(items));
        } catch (e) {
          console.error("Failed to save production draft to localStorage:", e);
        }
      } else {
        localStorage.removeItem("locmaco_production_draft");
      }
    }
  }, [items, mode]);

  const addItem = (p) => {
    setItems((prev) => {
      if (prev.find((i) => i.product_id === p.id)) return prev;
      return [
        ...prev,
        {
          product_id: p.id,
          product_name: p.name,
          code: p.code || "",
          quantity: "",
          unit: p.mainUnit || "шт",
        },
      ];
    });
  };

  const updateItem = (idx, field, value) => {
    setItems((p) =>
      p.map((x, i) => (i === idx ? { ...x, [field]: value } : x))
    );
  };

  const clearDraft = () => {
    if (window.confirm("Очистить текущий черновик?")) {
      setItems([]);
      localStorage.removeItem("locmaco_production_draft");
      showToast("Черновик очищен");
    }
  };

  const handleSubmit = async () => {
    if (items.length === 0) {
      showToast("Выберите готовые изделия для приготовления", "error");
      return;
    }
    if (!loggedInUser.storeId && !selectedStoreId) {
      showToast("Выберите склад для проведения акта", "error");
      return;
    }
    const prepared = items
      .map((it) => ({
        product_id: it.product_id,
        product_name: it.product_name,
        code: it.code,
        quantity: parseFloat(it.quantity) || 0,
        unit: it.unit,
      }))
      .filter((it) => it.quantity > 0);

    if (prepared.length === 0) {
      showToast("Укажите количество для изделий", "error");
      return;
    }

    setSubmitting(true);
    const result = await API.createProduction({
      items: prepared,
      comment,
      storeId: selectedStoreId,
      user: {
        tg_id: loggedInUser.tg_id,
        name: loggedInUser.name,
        role: loggedInUser.role,
      },
    });
    setSubmitting(false);

    if (result?.success) {
      showToast("Акт приготовления успешно проведен!");
      localStorage.removeItem("locmaco_production_draft");
      loadHistory();
      setMode("idle");
      setItems([]);
      setComment("");
    } else {
      showToast(result?.error || "Ошибка создания акта", "error");
    }
  };

  return (
    <div style={{ animation: "fadeIn .25s ease" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
          Приготовление заготовок
        </h2>
        {mode === "idle" ? (
          <Btn
            onClick={() => {
              setMode("new");
              setComment("");
            }}
            style={{
              background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
              boxShadow: "0 4px 12px rgba(249, 115, 22, 0.2)",
            }}
          >
            {I.plus} Новый акт
          </Btn>
        ) : (
          <Btn
            outline
            onClick={() => {
              setMode("idle");
              setItems([]);
              setComment("");
            }}
          >
            {I.x} Отмена
          </Btn>
        )}
      </div>

      {mode === "idle" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div className="horizontal-scroll-container" style={{ display: "flex", gap: 10, marginBottom: 12, marginTop: 4 }}>
            {[
              {
                id: "db_history",
                label: "📋 История сайта",
                grad: "linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)",
                text: "#0369a1",
              },
              {
                id: "iiko_history",
                label: "🌐 История iiko",
                grad: "linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)",
                text: "#4338ca",
              },
            ].map((sub) => (
              <button
                key={sub.id}
                onClick={() => setSubTab(sub.id)}
                style={{
                  padding: "9px 15px",
                  borderRadius: 10,
                  border: subTab === sub.id ? "none" : "1px solid var(--border-color)",
                  background: subTab === sub.id ? sub.grad : "var(--bg-card)",
                  color: subTab === sub.id ? sub.text : "var(--text-muted)",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                  boxShadow:
                    subTab === sub.id
                      ? "0 4px 10px rgba(99, 102, 241, 0.08)"
                      : "none",
                  transition: "all 0.15s ease",
                }}
              >
                {sub.label}
              </button>
            ))}
          </div>

          {subTab === "iiko_history" ? (
            <div>
              <IikoHistoryList
                type="PRODUCTION_DOCUMENT"
                showToast={showToast}
                stores={stores}
                products={products}
              />
            </div>
          ) : (
            <div>
              <HistoryList
                history={history.filter((act) => act.action_type === "production")}
                loading={historyLoading}
                onRefresh={loadHistory}
                emptyText="История актов приготовления пуста"
                onRestore={(act) => {
                  if (act.details) {
                    setComment(act.details.comment || "");
                    setItems(
                      (act.details.items || []).map((it) => ({
                        product_id: it.product_id,
                        product_name: it.product_name,
                        code: it.code || "",
                        quantity: it.quantity,
                        unit: it.unit || "шт",
                      }))
                    );
                    setMode("new");
                    showToast("Черновик успешно восстановлен!");
                  }
                }}
              />
            </div>
          )}
        </div>
      )}

      {mode === "new" && (
        <div
          style={{
            background: "var(--bg-card)",
            borderRadius: 14,
            border: "1px solid var(--border-color)",
            padding: 24,
          }}
        >
          {loggedInUser.storeId ? (
            <div
              style={{
                ...crumb,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <span>
                🍳 Место приготовления: <b>{stores.find(s => s.id === loggedInUser.storeId)?.name || "Кухня Заготовки"}</b>
              </span>
              {items.length > 0 && (
                <button
                  onClick={clearDraft}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#ef4444",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  {I.trash} Очистить черновик
                </button>
              )}
            </div>
          ) : (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <label style={lbl}>Склад / Место приготовления</label>
                {items.length > 0 && (
                  <button
                    onClick={clearDraft}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#ef4444",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    {I.trash} Очистить черновик
                  </button>
                )}
              </div>
              <select
                value={selectedStoreId}
                onChange={(e) => setSelectedStoreId(e.target.value)}
                style={inp}
              >
                <option value="">Выберите склад...</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    🏢 {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {draftRestored && (
            <div
              style={{
                background: "#fff7ed",
                border: "1px solid #ffedd5",
                color: "#c2410c",
                padding: "10px 14px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 500,
                marginBottom: 12,
                animation: "fadeIn 0.2s ease",
              }}
            >
              🔄 Восстановлен черновик автосохранения
            </div>
          )}

          {loading ? (
            <LoadingBlock text="Загрузка товаров..." />
          ) : products.length === 0 ? (
            <ErrorBlock text="Товары не загрузились" onRetry={onRetry} />
          ) : (
            <>
              <ProductSearch products={products} onSelect={addItem} />
              {items.length > 0 && (
                <div
                  style={{
                    border: "1px solid var(--border-color)",
                    borderRadius: 10,
                    overflow: "hidden",
                    marginTop: 12,
                  }}
                >
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 12,
                    }}
                  >
                    <thead>
                      <tr style={{ background: "#f8fafb" }}>
                        <th style={th}>Товар</th>
                        <th style={{ ...th, textAlign: "center", width: 130 }}>
                          Количество
                        </th>
                        <th style={{ ...th, width: 36 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it, idx) => (
                        <tr
                          key={idx}
                          style={{ borderTop: "1px solid #f0f2f5" }}
                        >
                          <td style={td}>
                            <div style={{ fontWeight: 500 }}>
                              {it.product_name}
                            </div>
                            <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                              {it.unit}
                            </div>
                          </td>
                          <td style={{ ...td, textAlign: "center" }}>
                            <div
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                justifyContent: "center",
                              }}
                            >
                              <input
                                type="number"
                                value={it.quantity}
                                onChange={(e) =>
                                  updateItem(
                                    idx,
                                    "quantity",
                                    it.unit === "шт"
                                      ? e.target.value
                                          .split(".")[0]
                                          .split(",")[0]
                                      : e.target.value
                                  )
                                }
                                placeholder="0"
                                style={numInput}
                              />
                              <span
                                style={{
                                  fontSize: 12,
                                  color: "var(--text-muted)",
                                  minWidth: 24,
                                  textAlign: "left",
                                  fontWeight: 600,
                                }}
                              >
                                {it.unit || "шт"}
                              </span>
                            </div>
                          </td>
                          <td style={td}>
                            <button
                              onClick={() =>
                                setItems((p) => p.filter((_, i) => i !== idx))
                              }
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                color: "#ef4444",
                                display: "flex",
                              }}
                            >
                              {I.trash}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <label style={{ ...lbl, marginTop: 16 }}>Комментарий</label>
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Необязательно"
                style={inp}
              />

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginTop: 16,
                  justifyContent: "flex-end",
                }}
              >
                <Btn
                  onClick={handleSubmit}
                  disabled={submitting || items.length === 0}
                  style={{
                    background:
                      "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
                    border: "none",
                  }}
                >
                  {submitting ? I.loader : I.send}{" "}
                  {submitting ? "Отправка..." : "Приготовить в iiko"}
                </Btn>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  WRITEOFF — акты списания (для бара и админа)
// ═══════════════════════════════════════════════════════════════

function WriteoffView({
  products,
  stores = [],
  showToast,
  loading,
  onRetry,
  loggedInUser,
  loadHistory,
  history,
  historyLoading,
}) {
  const [mode, setMode] = useState("idle");
  const [subTab, setSubTab] = useState("db_history");
  const [items, setItems] = useState([]);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState("");

  const [accounts, setAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState("6f983109-eb1f-4517-917b-9912d5eeda16"); // default: "Пищевые потери и списания"

  const [baseRole] = (loggedInUser?.role || "").split(":");
  const isAdmin = baseRole === "admin";

  useEffect(() => {
    if (loggedInUser?.storeId) {
      setSelectedStoreId(loggedInUser.storeId);
    } else {
      setSelectedStoreId("");
    }
  }, [loggedInUser]);

  useEffect(() => {
    if (isAdmin && mode === "new" && accounts.length === 0) {
      const fetchAccounts = async () => {
        try {
          setAccountsLoading(true);
          const res = await API.getAccounts();
          if (res?.success && Array.isArray(res.data)) {
            setAccounts(res.data);
            const defaultAcc = res.data.find(a => a.id === "6f983109-eb1f-4517-917b-9912d5eeda16");
            if (defaultAcc) {
              setSelectedAccountId(defaultAcc.id);
            } else if (res.data.length > 0) {
              setSelectedAccountId(res.data[0].id);
            }
          } else {
            showToast(res?.error || "Не удалось загрузить счета списания", "error");
          }
        } catch (err) {
          showToast("Ошибка при получении счетов списания", "error");
        } finally {
          setAccountsLoading(false);
        }
      };
      fetchAccounts();
    }
  }, [isAdmin, mode, accounts.length]);

  useEffect(() => {
    if (mode === "new") {
      const saved = localStorage.getItem("locmaco_writeoff_draft");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setItems(parsed);
            setDraftRestored(true);
            setTimeout(() => setDraftRestored(false), 3000);
          } else {
            setItems([]);
          }
        } catch (_e) {
          setItems([]);
        }
      } else {
        setItems([]);
      }
    } else {
      setItems([]);
    }
  }, [mode]);

  useEffect(() => {
    if (mode === "new") {
      if (items.length > 0) {
        try {
          localStorage.setItem("locmaco_writeoff_draft", JSON.stringify(items));
        } catch (e) {
          console.error("Failed to save writeoff draft to localStorage:", e);
        }
      } else {
        localStorage.removeItem("locmaco_writeoff_draft");
      }
    }
  }, [items, mode]);

  const addItem = (p) => {
    setItems((prev) => {
      // Allow multiple instances of the same product
      return [
        ...prev,
        {
          product_id: p.id,
          product_name: p.name,
          code: p.code || "",
          quantity: "",
          unit: p.mainUnit || "шт",
        },
      ];
    });
  };

  const updateItem = (idx, field, value) => {
    setItems((p) =>
      p.map((x, i) => (i === idx ? { ...x, [field]: value } : x))
    );
  };

  const clearDraft = () => {
    if (window.confirm("Очистить текущий черновик?")) {
      setItems([]);
      localStorage.removeItem("locmaco_writeoff_draft");
      showToast("Черновик очищен");
    }
  };

  const handleSubmit = async () => {
    if (items.length === 0) {
      showToast("Выберите товары для списания", "error");
      return;
    }
    if (!loggedInUser.storeId && !selectedStoreId) {
      showToast("Выберите склад для проведения списания", "error");
      return;
    }
    const prepared = items
      .map((it) => ({
        product_id: it.product_id,
        product_name: it.product_name,
        code: it.code,
        quantity: parseFloat(it.quantity) || 0,
        unit: it.unit,
      }))
      .filter((it) => it.quantity > 0);

    if (prepared.length === 0) {
      showToast("Укажите количество для списания", "error");
      return;
    }

    setSubmitting(true);
    const result = await API.createWriteoff({
      items: prepared,
      comment,
      storeId: selectedStoreId,
      accountId: isAdmin ? selectedAccountId : "6f983109-eb1f-4517-917b-9912d5eeda16",
      user: {
        tg_id: loggedInUser.tg_id,
        name: loggedInUser.name,
        role: loggedInUser.role,
      },
    });
    setSubmitting(false);

    if (result?.success) {
      showToast("Акт списания успешно проведен!");
      localStorage.removeItem("locmaco_writeoff_draft");
      loadHistory();
      setMode("idle");
      setItems([]);
      setComment("");
    } else {
      showToast(result?.error || "Ошибка создания акта", "error");
    }
  };

  return (
    <div style={{ animation: "fadeIn .25s ease" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
          Списание товаров
        </h2>
        {mode === "idle" ? (
          <Btn
            onClick={() => {
              setMode("new");
              setComment("");
            }}
            style={{
              background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
              boxShadow: "0 4px 12px rgba(239, 68, 68, 0.2)",
            }}
          >
            {I.plus} Новое списание
          </Btn>
        ) : (
          <Btn
            outline
            onClick={() => {
              setMode("idle");
              setItems([]);
              setComment("");
            }}
          >
            {I.x} Отмена
          </Btn>
        )}
      </div>

      {mode === "idle" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div className="horizontal-scroll-container" style={{ display: "flex", gap: 10, marginBottom: 12, marginTop: 4 }}>
            {[
              {
                id: "db_history",
                label: "📋 История сайта",
                grad: "linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)",
                text: "#b91c1c",
              },
              {
                id: "iiko_history",
                label: "🌐 История iiko",
                grad: "linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)",
                text: "#4338ca",
              },
            ].map((sub) => (
              <button
                key={sub.id}
                onClick={() => setSubTab(sub.id)}
                style={{
                  padding: "9px 15px",
                  borderRadius: 10,
                  border: subTab === sub.id ? "none" : "1px solid var(--border-color)",
                  background: subTab === sub.id ? sub.grad : "var(--bg-card)",
                  color: subTab === sub.id ? sub.text : "var(--text-muted)",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                  boxShadow:
                    subTab === sub.id
                      ? "0 4px 10px rgba(99, 102, 241, 0.08)"
                      : "none",
                  transition: "all 0.15s ease",
                }}
              >
                {sub.label}
              </button>
            ))}
          </div>

          {subTab === "iiko_history" ? (
            <div>
              <IikoHistoryList
                type="OUTGOING_DOCUMENT"
                showToast={showToast}
                stores={stores}
                products={products}
              />
            </div>
          ) : (
            <div>
              <HistoryList
                history={history.filter((act) => act.action_type === "writeoff")}
                loading={historyLoading}
                onRefresh={loadHistory}
                emptyText="История списаний пуста"
                onRestore={(act) => {
                  if (act.details) {
                    setComment(act.details.comment || "");
                    setItems(
                      (act.details.items || []).map((it) => ({
                        product_id: it.product_id,
                        product_name: it.product_name,
                        code: it.code || "",
                        quantity: it.quantity,
                        unit: it.unit || "шт",
                      }))
                    );
                    setMode("new");
                    showToast("Черновик успешно восстановлен!");
                  }
                }}
              />
            </div>
          )}
        </div>
      )}

      {mode === "new" && (
        <div
          style={{
            background: "var(--bg-card)",
            borderRadius: 14,
            border: "1px solid var(--border-color)",
            padding: 24,
          }}
        >
          {loggedInUser.storeId ? (
            <div
              style={{
                ...crumb,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <span>
                🏢 Склад списания: <b>{stores.find(s => s.id === loggedInUser.storeId)?.name || "Бар"}</b>
              </span>
              {items.length > 0 && (
                <button
                  onClick={clearDraft}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#ef4444",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  {I.trash} Очистить черновик
                </button>
              )}
            </div>
          ) : (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <label style={lbl}>Склад списания</label>
                {items.length > 0 && (
                  <button
                    onClick={clearDraft}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#ef4444",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    {I.trash} Очистить черновик
                  </button>
                )}
              </div>
              <select
                value={selectedStoreId}
                onChange={(e) => setSelectedStoreId(e.target.value)}
                style={inp}
              >
                <option value="">Выберите склад...</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    🏢 {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {isAdmin ? (
            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Счет списания</label>
              {accountsLoading ? (
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                  {I.loader} Загрузка счетов из iiko...
                </div>
              ) : (
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  style={inp}
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      📉 [{acc.code || "—"}] {acc.name} ({acc.type})
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : (
            <div
              style={{
                ...crumb,
                display: "flex",
                alignItems: "center",
                marginBottom: 16,
                background: "var(--bg-app)",
                borderColor: "var(--border-color)",
                color: "var(--text-muted)",
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              📉 Счет списания: <b style={{ marginLeft: 4, color: "var(--text-main)" }}>Пищевые потери и списания</b>
            </div>
          )}


          {draftRestored && (
            <div
              style={{
                background: "#fff7ed",
                border: "1px solid #ffedd5",
                color: "#c2410c",
                padding: "10px 14px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 500,
                marginBottom: 12,
                animation: "fadeIn 0.2s ease",
              }}
            >
              🔄 Восстановлен черновик автосохранения
            </div>
          )}

          {loading ? (
            <LoadingBlock text="Загрузка товаров..." />
          ) : products.length === 0 ? (
            <ErrorBlock text="Товары не загрузились" onRetry={onRetry} />
          ) : (
            <>
              <ProductSearch products={products} onSelect={addItem} />
              {items.length > 0 && (
                <div
                  style={{
                    border: "1px solid var(--border-color)",
                    borderRadius: 10,
                    overflow: "hidden",
                    marginTop: 12,
                  }}
                >
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 12,
                    }}
                  >
                    <thead>
                      <tr style={{ background: "#f8fafb" }}>
                        <th style={th}>Товар</th>
                        <th style={{ ...th, textAlign: "center", width: 130 }}>
                          Количество
                        </th>
                        <th style={{ ...th, width: 36 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it, idx) => (
                        <tr
                          key={idx}
                          style={{ borderTop: "1px solid #f0f2f5" }}
                        >
                          <td style={td}>
                            <div style={{ fontWeight: 500 }}>
                              {it.product_name}
                            </div>
                            <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                              {it.unit}
                            </div>
                          </td>
                          <td style={{ ...td, textAlign: "center" }}>
                            <div
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                justifyContent: "center",
                              }}
                            >
                              <input
                                type="number"
                                value={it.quantity}
                                onChange={(e) =>
                                  updateItem(
                                    idx,
                                    "quantity",
                                    it.unit === "шт"
                                      ? e.target.value
                                          .split(".")[0]
                                          .split(",")[0]
                                      : e.target.value
                                  )
                                }
                                placeholder="0"
                                style={numInput}
                              />
                              <span
                                style={{
                                  fontSize: 12,
                                  color: "var(--text-muted)",
                                  minWidth: 24,
                                  textAlign: "left",
                                  fontWeight: 600,
                                }}
                              >
                                {it.unit || "шт"}
                              </span>
                            </div>
                          </td>
                          <td style={td}>
                            <button
                              onClick={() =>
                                setItems((p) => p.filter((_, i) => i !== idx))
                              }
                              style={{
                                border: "none",
                                background: "none",
                                color: "#ef4444",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                padding: 6,
                              }}
                            >
                              {I.x}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={{ marginTop: 20 }}>
                <label style={lbl}>Комментарий</label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Добавьте примечание..."
                  style={{
                    ...inp,
                    height: 60,
                    resize: "none",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              <div
                style={{
                  marginTop: 24,
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 12,
                }}
              >
                <Btn
                  onClick={handleSubmit}
                  disabled={submitting || items.length === 0}
                  style={{
                    background:
                      "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                    border: "none",
                  }}
                >
                  {submitting ? I.loader : I.send}{" "}
                  {submitting ? "Отправка..." : "Провести списание в iiko"}
                </Btn>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  SERVICES — акты приема услуг (для снабженца и админа)
// ═══════════════════════════════════════════════════════════════

function ServicesView({
  stores = [],
  suppliers = [],
  showToast,
  loggedInUser,
  loadHistory,
  history,
  historyLoading,
}) {
  const [mode, setMode] = useState("idle");
  const [sum, setSum] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState("f94a2411-4e2a-4d0a-a3c5-f5a4d4e0042d"); // Default: "Представительские"
  const [selectedAccountId, setSelectedAccountId] = useState("0ca10c4d-e132-4348-a711-1380af66ee52"); // Default: "Доставка продуктов"

  const [accounts, setAccounts] = useState([
    { id: "0ca10c4d-e132-4348-a711-1380af66ee52", name: "Доставка продуктов" },
    { id: "d07478d5-c4e8-4618-b40d-23cbbce41a18", name: "Автомобильные расходы" },
  ]);
  const [accountsLoading, setAccountsLoading] = useState(false);

  const [baseRole] = (loggedInUser?.role || "").split(":");
  const isAdmin = baseRole === "admin" || baseRole === "director";

  useEffect(() => {
    if (loggedInUser?.storeId) {
      setSelectedStoreId(loggedInUser.storeId);
    } else {
      setSelectedStoreId("");
    }
  }, [loggedInUser]);

  useEffect(() => {
    if (isAdmin && mode === "new") {
      const fetchAccounts = async () => {
        try {
          setAccountsLoading(true);
          const res = await API.getAccounts();
          if (res?.success && Array.isArray(res.data)) {
            setAccounts(res.data);
            const defaultAcc = res.data.find(a => a.id === "0ca10c4d-e132-4348-a711-1380af66ee52");
            if (defaultAcc) {
              setSelectedAccountId(defaultAcc.id);
            } else if (res.data.length > 0) {
              setSelectedAccountId(res.data[0].id);
            }
          } else {
            showToast(res?.error || "Не удалось загрузить счета из iiko", "error");
          }
        } catch (err) {
          showToast("Ошибка при получении счетов услуг", "error");
        } finally {
          setAccountsLoading(false);
        }
      };
      fetchAccounts();
    } else if (!isAdmin) {
      setAccounts([
        { id: "0ca10c4d-e132-4348-a711-1380af66ee52", name: "Доставка продуктов" },
        { id: "d07478d5-c4e8-4618-b40d-23cbbce41a18", name: "Автомобильные расходы" },
      ]);
      setSelectedAccountId("0ca10c4d-e132-4348-a711-1380af66ee52");
    }
  }, [isAdmin, mode]);

  const handleSubmit = async () => {
    if (!selectedAccountId || !sum) {
      showToast("Заполните все поля", "error");
      return;
    }
    const sumVal = parseFloat(sum) || 0;
    if (sumVal <= 0) {
      showToast("Сумма услуги должна быть больше нуля", "error");
      return;
    }

    const targetStoreId = selectedStoreId || loggedInUser?.storeId || (stores[0]?.id || "1239d270-1bbe-f64f-b7ea-5f00518ef508");
    const store = stores.find((s) => s.id === targetStoreId);
    const storeName = store ? store.name : "Основной склад";

    const supplierObj = suppliers.find((s) => s.id === selectedSupplierId);
    const supplierName = supplierObj ? supplierObj.name : "Представительские";

    const acc = accounts.find((a) => a.id === selectedAccountId);
    const accountName = acc ? acc.name : "Неизвестный счет";

    setSubmitting(true);
    const result = await API.createService({
      store_id: targetStoreId,
      store_name: storeName,
      supplier_id: selectedSupplierId,
      supplier_name: supplierName,
      account_id: selectedAccountId,
      account_name: accountName,
      sum: sumVal,
      comment: comment,
    });
    setSubmitting(false);

    if (result?.success) {
      showToast("Акт приема услуг успешно создан!");
      loadHistory();
      setMode("idle");
      setSum("");
      setComment("");
    } else {
      showToast(result?.error || "Ошибка создания акта", "error");
    }
  };

  const getStoreName = (id) => {
    const s = stores.find((st) => st.id === id);
    return s ? s.name : id;
  };

  return (
    <div style={{ animation: "fadeIn .25s ease" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
          Акты приема услуг
        </h2>
        {mode === "idle" ? (
          <Btn
            onClick={() => {
              setMode("new");
              setSum("");
              setComment("");
              setSelectedSupplierId("f94a2411-4e2a-4d0a-a3c5-f5a4d4e0042d");
            }}
          >
            {I.plus} Новый акт услуг
          </Btn>
        ) : (
          <Btn
            outline
            onClick={() => {
              setMode("idle");
              setSum("");
              setComment("");
            }}
          >
            {I.x} Отмена
          </Btn>
        )}
      </div>

      {mode === "idle" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <HistoryList
            history={history}
            loading={historyLoading}
            onRefresh={loadHistory}
            emptyText="История актов приема услуг пуста"
            onRestore={(act) => {
              if (act.details) {
                setSelectedStoreId(act.details.store_id || "");
                setSelectedSupplierId(act.details.supplier_id || "f94a2411-4e2a-4d0a-a3c5-f5a4d4e0042d");
                setSelectedAccountId(act.details.account_id || "0ca10c4d-e132-4348-a711-1380af66ee52");
                setSum(String(act.details.sum || ""));
                setComment(act.details.comment || "");
                setMode("new");
              }
            }}
          />
        </div>
      )}

      {mode === "new" && (
        <div
          style={{
            background: "var(--bg-card)",
            borderRadius: 16,
            border: "1px solid var(--border-color)",
            padding: 20,
            boxShadow: "var(--shadow-sm)",
          }}
        >

          {/* Supplier Selection for Admin / Readonly for Supplier */}
          {isAdmin ? (
            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Поставщик</label>
              <select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                style={inp}
              >
                <option value="">-- Выберите поставщика --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    🤝 {s.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div
              style={{
                ...crumb,
                display: "flex",
                alignItems: "center",
                marginBottom: 16,
                background: "var(--bg-app)",
                borderColor: "var(--border-color)",
                color: "var(--text-muted)",
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              🤝 Поставщик: <b style={{ marginLeft: 4, color: "var(--text-main)" }}>Представительские</b>
            </div>
          )}

          {/* Service Account Selection */}
          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Счет услуги</label>
            {accountsLoading ? (
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                {I.loader} Загрузка счетов из iiko...
              </div>
            ) : (
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                style={inp}
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    📊 [{acc.code || "—"}] {acc.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Sum Input */}
          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Сумма (сум)</label>
            <input
              type="number"
              placeholder="Введите сумму услуги..."
              value={sum}
              onChange={(e) => setSum(e.target.value)}
              style={inp}
            />
          </div>

          {/* Comment Input */}
          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Комментарий</label>
            <textarea
              placeholder="Добавьте примечание..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              style={{
                ...inp,
                height: 80,
                resize: "none",
                fontFamily: "inherit",
              }}
            />
          </div>

          {/* Submit Button */}
          <div
            style={{
              marginTop: 24,
              display: "flex",
              justifyContent: "flex-end",
              gap: 12,
            }}
          >
            <Btn
              onClick={handleSubmit}
              disabled={submitting}
              style={{
                background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                border: "none",
              }}
            >
              {submitting ? I.loader : I.send}{" "}
              {submitting ? "Отправка..." : "Провести акт в iiko"}
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
//  EMPLOYEES — управление сотрудниками (без привязки к ТГ)
// ═══════════════════════════════════════════════════════════════

function EmployeesView({ stores, showToast, loggedInUser }) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState("idle"); // idle, new, or edit
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [subTab, setSubTab] = useState("list"); // list, login_history
  const [loginHistory, setLoginHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    role: "bar",
    storeId: "",
    access_code: "",
    tg_id: "",
  });

  const loadEmployees = async () => {
    setLoading(true);
    const res = await API.getEmployees();
    if (res && res.success && Array.isArray(res.employees)) {
      setEmployees(res.employees);
    } else {
      showToast(res?.error || "Не удалось загрузить сотрудников", "error");
    }
    setLoading(false);
  };

  const loadLoginHistory = async () => {
    setHistoryLoading(true);
    const res = await API.getEmployees();
    if (res && res.success && Array.isArray(res.employees)) {
      const activeEmployees = res.employees
        .filter((emp) => emp.last_login_at)
        .sort((a, b) => new Date(b.last_login_at) - new Date(a.last_login_at));
      setLoginHistory(activeEmployees);
      setEmployees(res.employees);
    } else {
      showToast(res?.error || "Не удалось загрузить историю посещений", "error");
    }
    setHistoryLoading(false);
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    setSearchQuery("");
    if (subTab === "login_history") {
      loadLoginHistory();
    }
  }, [subTab]);

  const isStoreDependent = (role) => {
    return ["supplier", "kitchen", "prep_chef", "bar", "hall"].includes(role);
  };

  const getRoleLabel = (roleStr) => {
    const [base] = roleStr.split(":");
    const labels = {
      admin: "Администратор",
      director: "Руководитель",
      supplier: "Снабженец",
      kitchen: "Шеф-повар",
      prep_chef: "Смесь-повар",
      bar: "Бармен",
      cashier: "Кассир",
      manager: "Менеджер",
      hall: "Зал",
    };
    return labels[base] || base;
  };

  const getRoleColor = (roleStr) => {
    const [base] = roleStr.split(":");
    const colors = {
      admin: { bg: "#e0e7ff", text: "#4f46e5" }, // indigo
      director: { bg: "#fce7f3", text: "#db2777" }, // pink
      supplier: { bg: "#e0f2fe", text: "#0284c7" }, // sky
      kitchen: { bg: "#f3e8ff", text: "#7e22ce" }, // purple
      prep_chef: { bg: "#ffedd5", text: "#ea580c" }, // orange
      bar: { bg: "#ecfdf5", text: "#059669" }, // emerald
      cashier: { bg: "#fef9c3", text: "#ca8a04" }, // yellow
      manager: { bg: "#ccfbf1", text: "#0f766e" }, // teal
      hall: { bg: "#f0fdf4", text: "#15803d" }, // green for hall
    };
    return colors[base] || { bg: "#f1f5f9", text: "#475569" };
  };

  const getStoreName = (roleStr) => {
    const [_, storeId] = roleStr.split(":");
    if (!storeId) return "Все склады";
    const found = stores.find((s) => s.id === storeId);
    return found ? found.name : "Неизвестный склад";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      showToast("Введите имя сотрудника", "error");
      return;
    }
    if (isStoreDependent(form.role) && !form.storeId) {
      showToast("Выберите склад для данной должности", "error");
      return;
    }
    if (!form.access_code || form.access_code.length < 4) {
      showToast("Пароль должен быть не менее 4 символов", "error");
      return;
    }

    const finalRole = isStoreDependent(form.role)
      ? `${form.role}:${form.storeId}`
      : form.role;

    setSubmitting(true);
    let res;
    if (mode === "edit") {
      res = await API.updateEmployee({
        id: editingId,
        name: form.name.trim(),
        role: finalRole,
        access_code: form.access_code,
        tg_id: form.tg_id,
        user: { role: loggedInUser.baseRole },
      });
    } else {
      res = await API.createEmployee({
        name: form.name.trim(),
        role: finalRole,
        access_code: form.access_code,
        tg_id: form.tg_id,
        user: { role: loggedInUser.baseRole },
      });
    }
    setSubmitting(false);

    if (res && res.success) {
      showToast(mode === "edit" ? "Сотрудник успешно изменен!" : "Сотрудник успешно создан!");
      setForm({ name: "", role: "bar", storeId: "", access_code: "", tg_id: "" });
      setMode("idle");
      setEditingId(null);
      loadEmployees();
    } else {
      showToast(res?.error || "Ошибка сохранения сотрудника", "error");
    }
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`Вы уверены, что хотите удалить сотрудника "${name}"?`)) {
      const res = await API.deleteEmployee(id);
      if (res && res.success) {
        showToast("Сотрудник успешно удален");
        loadEmployees();
      } else {
        showToast(res?.error || "Ошибка удаления", "error");
      }
    }
  };

  const sortedEmployees = [...employees].sort((a, b) => {
    const aName = (a.name || "").toLowerCase();
    const bName = (b.name || "").toLowerCase();
    const aIsAz = aName.includes("azimbek") || aName.includes("азимбек");
    const bIsAz = bName.includes("azimbek") || bName.includes("азимбек");
    if (aIsAz && !bIsAz) return -1;
    if (!aIsAz && bIsAz) return 1;
    return 0;
  });

  const filtered = sortedEmployees.filter((emp) => {
    const q = searchQuery.toLowerCase();
    const nameMatch = emp.name?.toLowerCase().includes(q);
    const codeMatch = emp.access_code?.includes(q);
    const roleMatch = getRoleLabel(emp.role).toLowerCase().includes(q);
    const storeMatch = getStoreName(emp.role).toLowerCase().includes(q);
    return nameMatch || codeMatch || roleMatch || storeMatch;
  });

  const filteredHistory = loginHistory.filter((emp) => {
    const q = searchQuery.toLowerCase();
    const nameMatch = emp.name?.toLowerCase().includes(q);
    const roleMatch = getRoleLabel(emp.role).toLowerCase().includes(q);
    const methodMatch = (emp.last_login_method === "passkey" ? "faceid touchid биометрия passkey" : "pin пинкод пароль password").includes(q);
    return nameMatch || roleMatch || methodMatch;
  });

  return (
    <div style={{ animation: "fadeIn .25s ease" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
          {mode === "edit" ? "Редактирование сотрудника" : "Сотрудники"}
        </h2>
        {mode === "idle" && subTab === "list" && loggedInUser?.baseRole === "admin" && (
          <Btn
            onClick={() => {
              setMode("new");
              setForm({ name: "", role: "bar", storeId: "", access_code: "", tg_id: "" });
            }}
            style={{
              background: "var(--text-main)",
              color: "var(--bg-card)",
              boxShadow: "none",
            }}
          >
            {I.plus} Добавить сотрудника
          </Btn>
        )}
        {mode !== "idle" && (
          <Btn outline onClick={() => { setMode("idle"); setEditingId(null); }}>
            {I.x} Отмена
          </Btn>
        )}
      </div>

      {mode === "idle" && (
        <div className="horizontal-scroll-container" style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <button
            onClick={() => setSubTab("list")}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid var(--border-color)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              background: subTab === "list" ? "var(--text-main)" : "var(--bg-card)",
              color: subTab === "list" ? "var(--bg-card)" : "var(--text-muted)",
              transition: "all 0.15s ease",
            }}
          >
            👥 Список сотрудников
          </button>
          <button
            onClick={() => setSubTab("login_history")}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid var(--border-color)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              background: subTab === "login_history" ? "var(--text-main)" : "var(--bg-card)",
              color: subTab === "login_history" ? "var(--bg-card)" : "var(--text-muted)",
              transition: "all 0.15s ease",
            }}
          >
            🕒 История посещений
          </button>
        </div>
      )}

      {mode === "idle" && subTab === "list" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ position: "relative" }}>
            <input
              type="text"
              placeholder="Поиск по имени, должности, складу или коду..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                ...inp,
                paddingLeft: 40,
                background: "var(--bg-card)",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-muted)",
                display: "flex",
              }}
            >
              {I.search}
            </div>
          </div>

          {loading ? (
            <LoadingBlock text="Загрузка списка сотрудников..." />
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border-color)" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>👥</div>
              <div style={{ fontWeight: 600, color: "var(--text-muted)" }}>
                {searchQuery ? "Ничего не найдено" : "Сотрудники не найдены"}
              </div>
            </div>
          ) : (
            <div
              style={{
                background: "var(--bg-card)",
                borderRadius: 14,
                border: "1px solid var(--border-color)",
                overflow: "hidden",
                boxShadow: "0 4px 12px rgba(0,0,0,0.02)",
              }}
            >
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "var(--bg-hover)", borderBottom: "1px solid var(--border-color)" }}>
                      <th style={{ ...th, padding: "14px 16px" }}>Имя</th>
                      <th style={th}>Должность</th>
                      <th style={th}>Склад</th>
                      <th style={{ ...th, textAlign: "center", width: 100 }}>Пароль</th>
                      <th style={{ ...th, textAlign: "center", width: 120 }}>Telegram ID</th>
                      {loggedInUser?.baseRole === "admin" && <th style={{ ...th, width: 90 }}></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((emp) => {
                      const color = getRoleColor(emp.role);
                      return (
                        <tr key={emp.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                          <td style={{ ...td, padding: "14px 16px", fontWeight: 600, color: "var(--text-main)" }}>
                            {emp.name}
                          </td>
                          <td style={td}>
                            <span
                              style={{
                                padding: "4px 10px",
                                borderRadius: 6,
                                fontSize: 11,
                                fontWeight: 700,
                                background: color.bg,
                                color: color.text,
                                display: "inline-block",
                              }}
                            >
                              {getRoleLabel(emp.role)}
                            </span>
                          </td>
                          <td style={{ ...td, color: "var(--text-muted)", fontWeight: 500 }}>
                            {getStoreName(emp.role)}
                          </td>
                          <td style={{ ...td, textAlign: "center", fontFamily: "monospace", fontWeight: 700, letterSpacing: 1, color: "var(--text-muted)" }}>
                            {emp.access_code}
                          </td>
                          <td style={{ ...td, textAlign: "center", fontFamily: "monospace", color: "var(--text-muted)", fontSize: 12 }}>
                            {emp.tg_id || "—"}
                          </td>
                          {loggedInUser?.baseRole === "admin" && (
                            <td style={td}>
                              <div style={{ display: "flex", gap: 4 }}>
                                <button
                                  onClick={() => {
                                    const [baseRole, storeId] = emp.role.split(":");
                                    setForm({
                                      name: emp.name,
                                      role: baseRole || "bar",
                                      storeId: storeId || "",
                                      access_code: emp.access_code,
                                      tg_id: emp.tg_id || "",
                                    });
                                    setEditingId(emp.id);
                                    setMode("edit");
                                  }}
                                  style={{
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    color: "#6366f1",
                                    display: "flex",
                                    padding: 8,
                                    borderRadius: 8,
                                    transition: "background 0.15s ease",
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
                                  onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                                >
                                  {I.edit}
                                </button>
                                {emp.tg_id !== 2141257356 && emp.tg_id !== 390586482 ? (
                                  <button
                                    onClick={() => handleDelete(emp.id, emp.name)}
                                    style={{
                                      background: "none",
                                      border: "none",
                                      cursor: "pointer",
                                      color: "#ef4444",
                                      display: "flex",
                                      padding: 8,
                                      borderRadius: 8,
                                      transition: "background 0.15s ease",
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = "#fee2e2"}
                                    onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                                  >
                                    {I.trash}
                                  </button>
                                ) : null}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {mode === "idle" && subTab === "login_history" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ position: "relative" }}>
            <input
              type="text"
              placeholder="Поиск по сотруднику или способу входа..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                ...inp,
                paddingLeft: 40,
                background: "var(--bg-card)",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-muted)",
                display: "flex",
              }}
            >
              {I.search}
            </div>
          </div>

          {historyLoading ? (
            <LoadingBlock text="Загрузка истории посещений..." />
          ) : filteredHistory.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border-color)" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🕒</div>
              <div style={{ fontWeight: 600, color: "var(--text-muted)" }}>
                {searchQuery ? "История входов не найдена" : "История входов пуста"}
              </div>
            </div>
          ) : (
            <div
              style={{
                background: "var(--bg-card)",
                borderRadius: 14,
                border: "1px solid var(--border-color)",
                overflow: "hidden",
                boxShadow: "0 4px 12px rgba(0,0,0,0.02)",
              }}
            >
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "var(--bg-hover)", borderBottom: "1px solid var(--border-color)" }}>
                      <th style={{ ...th, padding: "14px 16px" }}>Сотрудник</th>
                      <th style={th}>Должность</th>
                      <th style={th}>Способ входа</th>
                      <th style={{ ...th, textAlign: "right", paddingRight: 16 }}>Последний вход</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.map((emp) => {
                      const date = new Date(emp.last_login_at);
                      const formattedDate = date.toLocaleDateString("ru-RU", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      });

                      const color = getRoleColor(emp.role);

                      return (
                        <tr
                          key={emp.id}
                          style={{
                            borderBottom: "1px solid var(--border-color)",
                            transition: "background 0.2s",
                          }}
                        >
                          <td style={{ padding: "14px 16px", fontWeight: 600, color: "var(--text-main)" }}>
                            {emp.name}
                          </td>
                          <td style={td}>
                            <span
                              style={{
                                padding: "4px 10px",
                                borderRadius: 6,
                                fontSize: 11,
                                fontWeight: 700,
                                background: color.bg,
                                color: color.text,
                                display: "inline-block",
                              }}
                            >
                              {getRoleLabel(emp.role)}
                            </span>
                          </td>
                          <td style={td}>
                            {emp.last_login_method === "passkey" ? (
                              <span
                                style={{
                                  padding: "4px 8px",
                                  borderRadius: 6,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  background: "var(--bg-pill)",
                                  color: "var(--text-pill)",
                                  border: "1px solid var(--border-color)",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 6,
                                }}
                              >
                                <svg
                                  width="10"
                                  height="10"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  viewBox="0 0 24 24"
                                >
                                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                                </svg>
                                Face ID / Touch ID
                              </span>
                            ) : (
                              <span
                                style={{
                                  padding: "4px 8px",
                                  borderRadius: 6,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  background: "var(--bg-pill)",
                                  color: "var(--text-pill)",
                                  border: "1px solid var(--border-color)",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 6,
                                }}
                              >
                                🔑 Пароль
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "14px 16px", textAlign: "right", paddingRight: 16, color: "var(--text-muted)", fontFamily: "monospace" }}>
                            {formattedDate}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {(mode === "new" || mode === "edit") && (
        <form
          onSubmit={handleSubmit}
          style={{
            background: "var(--bg-card)",
            borderRadius: 14,
            border: "1px solid var(--border-color)",
            padding: 24,
            display: "flex",
            flexDirection: "column",
            gap: 16,
            boxShadow: "0 4px 12px rgba(0,0,0,0.02)",
          }}
        >
          <div>
            <label style={lbl}>ФИО сотрудника</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Например, Кадир Кадыров"
              style={inp}
              required
            />
          </div>

          <div>
            <label style={lbl}>Должность</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value, storeId: isStoreDependent(e.target.value) ? (stores[0]?.id || "") : "" })}
              style={inp}
            >
              <option value="admin">Администратор (Полный доступ)</option>
              <option value="director">Руководитель (Только аналитика)</option>
              <option value="manager">Менеджер (Топ продаж и официанты)</option>
              <option value="supplier">Снабженец</option>
              <option value="kitchen">Шеф-повар</option>
              <option value="prep_chef">Смесь-повар</option>
              <option value="bar">Бармен</option>
              <option value="cashier">Кассир</option>
              <option value="hall">Зал</option>
            </select>
          </div>

          {isStoreDependent(form.role) && (
            <div>
              <label style={lbl}>Склад привязки</label>
              <select
                value={form.storeId}
                onChange={(e) => setForm({ ...form, storeId: e.target.value })}
                style={inp}
                required
              >
                <option value="" disabled>-- Выберите склад --</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label style={lbl}>Пароль (минимум 4 символа)</label>
            <input
              type="text"
              minLength="4"
              value={form.access_code}
              onChange={(e) => setForm({ ...form, access_code: e.target.value })}
              placeholder="Введите пароль сотрудника"
              style={inp}
              required
            />
            <small style={{ color: "var(--text-muted)", marginTop: 4, display: "block" }}>
              Этот уникальный пароль сотрудник будет вводить на главном экране для входа
            </small>
          </div>

          <div>
            <label style={lbl}>Telegram ID (опционально)</label>
            <input
              type="text"
              value={form.tg_id || ""}
              onChange={(e) => setForm({ ...form, tg_id: e.target.value })}
              placeholder="Например, 123456789"
              style={inp}
            />
            <small style={{ color: "var(--text-muted)", marginTop: 4, display: "block" }}>
              Используется для отправки личных уведомлений о перемещениях
            </small>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              marginTop: 8,
              justifyContent: "flex-end",
            }}
          >
            <Btn
              type="submit"
              disabled={submitting}
              style={{
                background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                border: "none",
              }}
            >
              {submitting ? I.loader : (mode === "edit" ? I.edit : I.plus)}{" "}
              {submitting ? "Сохранение..." : (mode === "edit" ? "Сохранить изменения" : "Создать сотрудника")}
            </Btn>
          </div>
        </form>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  BALANCES — остатки на складе
// ═══════════════════════════════════════════════════════════════

function BalancesView({ stores, showToast, loggedInUser }) {
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchBalances = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    const res = await API.getBalances();
    if (isRefresh) {
      setRefreshing(false);
    } else {
      setLoading(false);
    }

    if (res && !res.error) {
      const data = res.data || [];
      setBalances(data);
      // Auto-select warehouse
      if (loggedInUser.storeId) {
        setSelectedStoreId(loggedInUser.storeId);
      } else if (!selectedStoreId && data.length > 0) {
        // Choose first warehouse that has balanceItems or just first warehouse
        const firstWithItems = data.find(d => d.balanceItems && d.balanceItems.length > 0);
        setSelectedStoreId(firstWithItems ? firstWithItems.storage.id : data[0].storage.id);
      }
    } else {
      const errMsg = res?.error || "Не удалось загрузить остатки со склада";
      setError(errMsg);
      showToast(errMsg, "error");
    }
  };

  useEffect(() => {
    if (loggedInUser.storeId) {
      setSelectedStoreId(loggedInUser.storeId);
    }
    fetchBalances();
  }, [loggedInUser.storeId]);

  const canSeeFinance = ["admin", "director"].includes(loggedInUser.baseRole);

  const selectedStoreData = balances.find((b) => b.storage?.id === selectedStoreId);
  const rawItems = selectedStoreData?.balanceItems || [];

  const filteredItems = rawItems.filter((item) => {
    // Если остаток ровно 0, то этот товар не используется на данном складе, полностью исключаем его
    if (item.amount === 0) return false;

    const p = item.product || {};
    const nameMatch = (p.name || "").toLowerCase().includes(searchQuery.toLowerCase());
    const numMatch = (p.num || "").toLowerCase().includes(searchQuery.toLowerCase());
    return nameMatch || numMatch;
  });

  const totalSum = filteredItems.reduce((acc, item) => acc + (item.sum || 0), 0);
  const totalCount = filteredItems.length;

  const handleRefresh = () => {
    fetchBalances(true);
  };

  const availableStores = balances.map(b => b.storage).filter(Boolean);
  const storesList = availableStores.length > 0 ? availableStores : stores;

  const activeStoreName = storesList.find(s => s.id === selectedStoreId)?.name || "Неизвестный склад";

  return (
    <div style={{ animation: "fadeIn .25s ease" }}>
      {/* Title & Refresh */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-main)", marginBottom: 4 }}>
            Остатки на складе
          </h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Просмотр текущих запасов ингредиентов и товаров в режиме реального времени
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading || refreshing}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            borderRadius: 12,
            background: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text-muted)",
            cursor: "pointer",
            transition: "all 0.15s ease",
            boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
          }}
        >
          <span style={{ display: "inline-flex", animation: refreshing ? "spin 1s linear infinite" : "none" }}>
            {I.refresh}
          </span>
          {refreshing ? "Обновление..." : "Обновить"}
        </button>
      </div>

      {/* Filter Toolbar */}
      <div
        style={{
          background: "var(--bg-card)",
          borderRadius: 20,
          padding: 20,
          border: "1px solid var(--border-color)",
          boxShadow: "0 4px 12px rgba(0,0,0,0.02)",
          marginBottom: 20,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          {/* Warehouse Selector */}
          <div>
            <label style={lbl}>Склад</label>
            {loggedInUser.storeId ? (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: "var(--bg-pill)",
                  border: "1px solid var(--border-color)",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--text-main)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8
                }}
              >
                🏢 {activeStoreName}
              </div>
            ) : (
              <select
                value={selectedStoreId}
                onChange={(e) => setSelectedStoreId(e.target.value)}
                style={{ ...inp, background: "var(--bg-card)", fontWeight: 500 }}
              >
                <option value="">Выберите склад...</option>
                {storesList.map((s) => (
                  <option key={s.id} value={s.id}>
                    🏢 {s.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Search Product */}
          <div>
            <label style={lbl}>Поиск по товару</label>
            <div style={{ position: "relative" }}>
              <input
                type="text"
                placeholder="Название или артикул..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ ...inp, paddingLeft: 36 }}
              />
              <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}>
                {I.search}
              </div>
            </div>
          </div>
        </div>

        {/* Options */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap", gap: 12, borderTop: "1px solid #f1f5f9", paddingTop: 14 }}>
          {/* Statistics summary */}
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ fontSize: 12, background: "var(--bg-pill)", padding: "6px 12px", borderRadius: 8, color: "var(--text-muted)", fontWeight: 600 }}>
              Товаров: <span style={{ color: "#6366f1" }}>{totalCount}</span>
            </div>
            {canSeeFinance && selectedStoreId && (
              <div style={{ fontSize: 12, background: "#e0f2fe", padding: "6px 12px", borderRadius: 8, color: "#0369a1", fontWeight: 600 }}>
                Общая сумма: <span style={{ color: "#0284c7" }}>{fmtPrice(totalSum)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      {loading ? (
        <LoadingBlock text="Загрузка остатков со склада..." />
      ) : error ? (
        <ErrorBlock text={error} onRetry={() => fetchBalances()} />
      ) : filteredItems.length === 0 ? (
        <Empty icon="📦" text="Ничего не найдено. Попробуйте изменить параметры поиска или фильтры." />
      ) : (
        <div
          style={{
            background: "var(--bg-card)",
            borderRadius: 20,
            border: "1px solid var(--border-color)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.02)",
            overflow: "hidden"
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafb", borderBottom: "1px solid var(--border-color)" }}>
                  <th style={{ ...th, width: 60, textAlign: "center" }}>№</th>
                  <th style={th}>Артикул</th>
                  <th style={{ ...th, paddingLeft: 16 }}>Наименование товара</th>
                  <th style={{ ...th, textAlign: "right", width: 150 }}>Остаток</th>
                  {canSeeFinance && (
                    <>
                      <th style={{ ...th, textAlign: "right", width: 150 }}>Себестоимость</th>
                      <th style={{ ...th, textAlign: "right", width: 160, paddingRight: 16 }}>Сумма</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, idx) => {
                  const p = item.product || {};
                  const isZeroOrNegative = item.amount <= 0;
                  const isLow = item.amount > 0 && item.amount < (item.consumptionForecast || 0);

                  return (
                    <tr key={p.id || idx} style={{ borderBottom: "1px solid #f0f2f5", background: isZeroOrNegative ? "rgba(239, 68, 68, 0.01)" : "none" }}>
                      <td style={{ ...td, textAlign: "center", color: "var(--text-muted)", fontSize: 11 }}>
                        {idx + 1}
                      </td>
                      <td style={{ ...td, color: "var(--text-muted)", fontFamily: "monospace", fontSize: 12 }}>
                        {p.num || "—"}
                      </td>
                      <td style={{ ...td, paddingLeft: 16, fontWeight: 600, color: "var(--text-main)" }}>
                        {p.name || "Без названия"}
                      </td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>
                        <span
                          style={{
                            color: isZeroOrNegative
                              ? "#ef4444"
                              : isLow
                              ? "#f97316"
                              : "#10b981",
                            background: isZeroOrNegative
                              ? "#fef2f2"
                              : isLow
                              ? "#fff7ed"
                              : "#ecfdf5",
                            padding: "4px 8px",
                            borderRadius: 6,
                            fontSize: 12,
                          }}
                        >
                          {item.amount.toFixed(3).replace(/\.?0+$/, "")} {p.mainUnitName || "шт"}
                        </span>
                      </td>
                      {canSeeFinance && (
                        <>
                          <td style={{ ...td, textAlign: "right", color: "var(--text-muted)" }}>
                            {fmtPrice(item.costPrice)}
                          </td>
                          <td style={{ ...td, textAlign: "right", fontWeight: 600, color: "var(--text-main)", paddingRight: 16 }}>
                            {fmtPrice(item.sum)}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  CASH — отчет кассы (наличные, терминал, Click/Payme, излишки/недостачи)
// ═══════════════════════════════════════════════════════════════

function CashView({
  showToast,
  loggedInUser,
  loadHistory,
  history,
  historyLoading,
}) {
  const getTodayTashkent = () => {
    const now = new Date();
    const tashkent = new Date(now.getTime() + 5 * 60 * 60 * 1000);
    return tashkent.toISOString().split("T")[0];
  };

  const [form, setForm] = useState({
    date: getTodayTashkent(),
    cash: "",
    encashment: "",
    uzcard: "",
    humo: "",
    online: "",
    rahmat: "",
    uzum: "",
    yandex: "",
    surplus: "",
    shortage: "",
    comment: "",
  });
  const [expenses, setExpenses] = useState([]);
  const [activeEmployees, setActiveEmployees] = useState([]);
  const [empWages, setEmpWages] = useState({});
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (form.date) {
      const fetchActive = async () => {
        setEmployeesLoading(true);
        try {
          const res = await API.getActiveEmployees(form.date);
          if (res?.success) {
            setActiveEmployees(res.employees || []);
            const initialWages = {};
            (res.employees || []).forEach((emp) => {
              initialWages[emp.id] = "0";
            });
            setEmpWages(initialWages);
          } else {
            setActiveEmployees([]);
            setEmpWages({});
          }
        } catch (e) {
          console.error("fetchActive error:", e);
        } finally {
          setEmployeesLoading(false);
        }
      };
      fetchActive();
    }
  }, [form.date]);

  const handleFieldChange = (field, val) => {
    setForm((p) => ({ ...p, [field]: val }));
  };

  const addExpense = () => {
    setExpenses((p) => [...p, { id: Date.now(), name: "", amount: "" }]);
  };

  const updateExpense = (id, field, value) => {
    setExpenses((p) =>
      p.map((exp) => (exp.id === id ? { ...exp, [field]: value } : exp))
    );
  };

  const removeExpense = (id) => {
    setExpenses((p) => p.filter((exp) => exp.id !== id));
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    const hasWages = Object.values(empWages).some((w) => w !== "");
    const hasValues =
      Object.keys(form).some((key) => key !== "date" && form[key] !== "") ||
      expenses.length > 0 ||
      hasWages;
    if (!hasValues) {
      showToast("Заполните хотя бы одно поле", "error");
      return;
    }
    setSubmitting(true);
    const result = await API.createCash({
      date: form.date,
      payments: {
        cash: form.cash,
        encashment: form.encashment,
        uzcard: form.uzcard,
        humo: form.humo,
        online: form.online,
        rahmat: form.rahmat,
        uzum: form.uzum,
        yandex: form.yandex,
      },
      expenses: expenses.map((exp) => ({
        name: exp.name || "Расход",
        amount: parseFloat(exp.amount) || 0,
      })),
      employeeWages: activeEmployees.map((emp) => ({
        employeeId: emp.id,
        name: emp.name,
        wage: parseFloat(empWages[emp.id]) || 0,
      })),
      surplus: form.surplus,
      shortage: form.shortage,
      comment: form.comment,
      user: {
        tg_id: loggedInUser.tg_id,
        name: loggedInUser.name,
        role: loggedInUser.role,
      },
    });
    setSubmitting(false);
    if (result?.success) {
      showToast("Отчет кассы сохранен!");
      setForm({
        date: getTodayTashkent(),
        cash: "",
        encashment: "",
        uzcard: "",
        humo: "",
        online: "",
        rahmat: "",
        uzum: "",
        yandex: "",
        surplus: "",
        shortage: "",
        comment: "",
      });
      setExpenses([]);
      setActiveEmployees([]);
      setEmpWages({});
      loadHistory();
    } else {
      showToast("Ошибка сохранения", "error");
    }
  };

  const totalSales =
    (parseFloat(form.cash) || 0) +
    (parseFloat(form.encashment) || 0) +
    (parseFloat(form.uzcard) || 0) +
    (parseFloat(form.humo) || 0) +
    (parseFloat(form.online) || 0) +
    (parseFloat(form.rahmat) || 0) +
    (parseFloat(form.uzum) || 0) +
    (parseFloat(form.yandex) || 0);

  const totalExpenses = expenses.reduce(
    (sum, exp) => sum + (parseFloat(exp.amount) || 0),
    0
  );

  const isManager =
    loggedInUser.role === "admin" || loggedInUser.role === "director";

  return (
    <div style={{ animation: "fadeIn .25s ease" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
          Отчет кассы
        </h2>
      </div>

      <div
        style={{
          background: "var(--bg-card)",
          borderRadius: 14,
          border: "1px solid var(--border-color)",
          padding: 24,
          marginBottom: 24,
        }}
      >
        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
        >
          <div style={{ maxWidth: 220, marginBottom: 8 }}>
            <label style={lbl}>📅 Дата сдачи кассы</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => handleFieldChange("date", e.target.value)}
              style={inp}
              required
            />
          </div>

          <h3
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 700,
              color: "var(--text-muted)",
            }}
          >
            💵 Выручка по типам оплат
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: 16,
            }}
          >
            <div>
              <label style={lbl}>Наличные (сум)</label>
              <input
                type="number"
                value={form.cash}
                onChange={(e) => handleFieldChange("cash", e.target.value)}
                placeholder="0"
                style={inp}
              />
            </div>
            <div>
              <label style={lbl}>Инкассация (сум)</label>
              <input
                type="number"
                value={form.encashment}
                onChange={(e) => handleFieldChange("encashment", e.target.value)}
                placeholder="0"
                style={inp}
              />
            </div>
            <div>
              <label style={lbl}>Uzcard (сум)</label>
              <input
                type="number"
                value={form.uzcard}
                onChange={(e) => handleFieldChange("uzcard", e.target.value)}
                placeholder="0"
                style={inp}
              />
            </div>
            <div>
              <label style={lbl}>Humo (сум)</label>
              <input
                type="number"
                value={form.humo}
                onChange={(e) => handleFieldChange("humo", e.target.value)}
                placeholder="0"
                style={inp}
              />
            </div>
            <div>
              <label style={lbl}>Click / Payme (сум)</label>
              <input
                type="number"
                value={form.online}
                onChange={(e) => handleFieldChange("online", e.target.value)}
                placeholder="0"
                style={inp}
              />
            </div>
            <div>
              <label style={lbl}>RAHMAT (сум)</label>
              <input
                type="number"
                value={form.rahmat}
                onChange={(e) => handleFieldChange("rahmat", e.target.value)}
                placeholder="0"
                style={inp}
              />
            </div>
            <div>
              <label style={lbl}>Uzum (сум)</label>
              <input
                type="number"
                value={form.uzum}
                onChange={(e) => handleFieldChange("uzum", e.target.value)}
                placeholder="0"
                style={inp}
              />
            </div>
            <div>
              <label style={lbl}>Яндекс Еда (сум)</label>
              <input
                type="number"
                value={form.yandex}
                onChange={(e) => handleFieldChange("yandex", e.target.value)}
                placeholder="0"
                style={inp}
              />
            </div>
          </div>

          <div
            style={{
              background: "var(--bg-hover)",
              padding: 12,
              borderRadius: 10,
              display: "flex",
              justifyContent: "space-between",
              fontWeight: 800,
              fontSize: 14,
            }}
          >
            <span>Итого выручка:</span>
            <span>{fmtPrice(totalSales)}</span>
          </div>

          {/* DYNAMIC EXPENSES */}
          <div style={{ borderTop: "1px dashed #e2e8f0", paddingTop: 16 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: 14,
                  fontWeight: 700,
                  color: "var(--text-muted)",
                }}
              >
                💸 Расходы из кассы
              </h3>
              <button
                type="button"
                onClick={addExpense}
                style={{
                  background: "none",
                  border: "1px solid #6366f1",
                  borderRadius: 8,
                  padding: "5px 10px",
                  color: "#6366f1",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                {I.plus} Добавить расход
              </button>
            </div>

            {expenses.length > 0 ? (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                {expenses.map((exp) => (
                  <div
                    key={exp.id}
                    style={{ display: "flex", gap: 12, alignItems: "center" }}
                  >
                    <input
                      value={exp.name}
                      onChange={(e) =>
                        updateExpense(exp.id, "name", e.target.value)
                      }
                      placeholder="Название (например: лимоны, хозтовары)"
                      style={{ ...inp, flex: 2 }}
                    />
                    <input
                      type="number"
                      value={exp.amount}
                      onChange={(e) =>
                        updateExpense(exp.id, "amount", e.target.value)
                      }
                      placeholder="Сумма (сум)"
                      style={{ ...inp, flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={() => removeExpense(exp.id)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "#ef4444",
                        display: "flex",
                      }}
                    >
                      {I.trash}
                    </button>
                  </div>
                ))}
                <div
                  style={{
                    background: "#fef2f2",
                    padding: 10,
                    borderRadius: 8,
                    display: "flex",
                    justifyContent: "space-between",
                    fontWeight: 700,
                    color: "var(--text-danger)",
                    fontSize: 13,
                    marginTop: 4,
                  }}
                >
                  <span>Всего расходов:</span>
                  <span>{fmtPrice(totalExpenses)}</span>
                </div>
              </div>
            ) : (
              <div
                style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}
              >
                Расходов по смене не зафиксировано
              </div>
            )}
          </div>

          <div
            style={{
              borderTop: "1px dashed #e2e8f0",
              paddingTop: 16,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
            }}
          >
            <div>
              <label style={{ ...lbl, color: "var(--text-success)" }}>Излишки (сум)</label>
              <input
                type="number"
                value={form.surplus}
                onChange={(e) => handleFieldChange("surplus", e.target.value)}
                placeholder="0"
                style={{ ...inp, borderColor: "#bbf7d0" }}
              />
            </div>
            <div>
              <label style={{ ...lbl, color: "var(--text-danger)" }}>
                Недостача (сум)
              </label>
              <input
                type="number"
                value={form.shortage}
                onChange={(e) => handleFieldChange("shortage", e.target.value)}
                placeholder="0"
                style={{ ...inp, borderColor: "#fca5a5" }}
              />
            </div>
          </div>

          {/* ACTIVE EMPLOYEES WAGES */}
          <div style={{ borderTop: "1px dashed #e2e8f0", paddingTop: 16 }}>
            <h3
              style={{
                margin: "0 0 12px 0",
                fontSize: 14,
                fontWeight: 700,
                color: "var(--text-muted)",
              }}
            >
              👥 Сотрудники на смене и их ЗП
            </h3>
            {employeesLoading ? (
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Загрузка списка сотрудников...
              </div>
            ) : activeEmployees.length > 0 ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: 12,
                }}
              >
                {activeEmployees.map((emp) => (
                  <div
                    key={emp.id}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      background: "var(--bg-hover)",
                      padding: 12,
                      borderRadius: 10,
                      border: "1px solid var(--border-color)",
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-main)" }}>
                      {emp.name}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <input
                        type="number"
                        value={empWages[emp.id] ?? ""}
                        onChange={(e) =>
                          setEmpWages((prev) => ({
                            ...prev,
                            [emp.id]: e.target.value,
                          }))
                        }
                        placeholder="0"
                        style={{ ...inp, margin: 0, flex: 1 }}
                      />
                      <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                        сум
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>
                Нет сотрудников, открывших смену в эту дату
              </div>
            )}
          </div>

          <div>
            <label style={lbl}>Комментарий</label>
            <input
              value={form.comment}
              onChange={(e) => handleFieldChange("comment", e.target.value)}
              placeholder="Необязательно"
              style={inp}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Btn onClick={handleSubmit} disabled={submitting}>
              {submitting ? I.loader : I.send}{" "}
              {submitting ? "Сдача..." : "Сдать кассу"}
            </Btn>
          </div>
        </form>
      </div>

      {!isManager && (
        <div style={{ marginTop: 24 }}>
          <HistoryList
            history={history.filter(
              (act) => String(act.tg_id) === String(loggedInUser.tg_id)
            )}
            loading={historyLoading}
            onRefresh={loadHistory}
            emptyText="Вы еще не сдавали кассовые отчеты"
          />
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  PRODUCT SEARCH
// ═══════════════════════════════════════════════════════════════

function ProductSearch({ products, onSelect }) {
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setFocused(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const filtered =
    q.length >= 1
      ? products
          .filter((p) => p.name.toLowerCase().includes(q.toLowerCase()))
          .slice(0, 10)
      : [];

  const highlightMatch = (text, query) => {
    if (!query) return <span>{text}</span>;
    const parts = text.split(new RegExp(`(${query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <mark
              key={i}
              style={{
                background: "var(--color-primary-glow)",
                color: "var(--text-main)",
                borderRadius: 4,
                padding: "1px 3px",
                fontWeight: 600,
              }}
            >
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </span>
    );
  };

  return (
    <div ref={ref} style={{ position: "relative", marginBottom: 8 }}>
      <div style={{ position: "relative" }}>
        <span
          style={{
            position: "absolute",
            left: 12,
            top: "50%",
            transform: "translateY(-50%)",
            color: focused ? "var(--color-primary)" : "var(--text-muted)",
            transition: "color 0.2s ease",
            display: "flex",
            alignItems: "center",
          }}
        >
          {I.search}
        </span>
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setFocused(true);
          }}
          onFocus={() => setFocused(true)}
          placeholder="Найти и добавить товар..."
          style={{
            width: "100%",
            padding: "11px 40px 11px 40px",
            borderRadius: 10,
            border: focused
              ? "1px solid var(--color-primary)"
              : "1px solid var(--border-color)",
            fontSize: 14,
            outline: "none",
            background: "var(--bg-input)",
            color: "var(--text-main)",
            boxShadow: focused ? "0 0 0 3px var(--color-primary-glow)" : "none",
            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
        {q && (
          <button
            onClick={() => {
              setQ("");
              setFocused(false);
            }}
            style={{
              position: "absolute",
              right: 12,
              top: "50%",
              transform: "translateY(-50%)",
              background: "none",
              border: "none",
              padding: 4,
              color: "var(--text-muted)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "50%",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--text-main)";
              e.currentTarget.style.background = "var(--bg-hover)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--text-muted)";
              e.currentTarget.style.background = "none";
            }}
          >
            {I.x}
          </button>
        )}
      </div>
      {focused && q.length >= 1 && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            background: "var(--bg-card)",
            borderRadius: 12,
            border: "1px solid var(--border-color)",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
            zIndex: 150,
            maxHeight: 260,
            overflow: "auto",
            animation: "fadeIn 0.15s ease-out",
          }}
        >
          {filtered.length === 0 && (
            <div
              style={{
                padding: "20px 16px",
                textAlign: "center",
                fontSize: 13,
                color: "var(--text-muted)",
              }}
            >
              Товары не найдены
            </div>
          )}
          {filtered.map((p, index) => (
            <button
              key={p.id}
              onClick={() => {
                onSelect(p);
                setQ("");
                setFocused(false);
              }}
              style={{
                width: "100%",
                padding: "12px 16px",
                border: "none",
                borderTop: index === 0 ? "none" : "1px solid var(--border-color)",
                background: "transparent",
                color: "var(--text-main)",
                cursor: "pointer",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: 13,
                textAlign: "left",
                transition: "background 0.15s ease",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "var(--bg-hover)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <span style={{ fontWeight: 500 }}>{highlightMatch(p.name, q)}</span>
              <span
                style={{
                  color: "var(--text-muted)",
                  fontSize: 11,
                  background: "var(--bg-pill)",
                  padding: "2px 6px",
                  borderRadius: 6,
                  fontWeight: 600,
                }}
              >
                {p.mainUnit || "шт"}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  SHARED
// ═══════════════════════════════════════════════════════════════

function StepBar({ steps, current }) {
  return (
    <div style={{ display: "flex", gap: 4, marginBottom: 24 }}>
      {steps.map((s, i) => (
        <div key={i} style={{ flex: 1, textAlign: "center" }}>
          <div
            style={{
              height: 3,
              borderRadius: 2,
              background: i <= current ? "#6366f1" : "#e2e8f0",
              marginBottom: 6,
            }}
          />
          <span
            style={{
              fontSize: 11,
              fontWeight: i === current ? 700 : 400,
              color: i <= current ? "#6366f1" : "#94a3b8",
            }}
          >
            {s}
          </span>
        </div>
      ))}
    </div>
  );
}

function LoadingBlock({ text }) {
  return (
    <div
      style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-muted)" }}
    >
      <div
        style={{ marginBottom: 12, display: "flex", justifyContent: "center" }}
      >
        {I.loader}
      </div>
      <div style={{ fontSize: 14 }}>{text}</div>
    </div>
  );
}
function ErrorBlock({ text, onRetry }) {
  return (
    <div
      style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-muted)" }}
    >
      <div style={{ fontSize: 44, marginBottom: 8 }}>⚠️</div>
      <div style={{ fontSize: 14, color: "#ef4444", marginBottom: 12 }}>
        {text}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: "1px solid var(--border-color)",
            background: "var(--bg-card)",
            color: "#6366f1",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          {I.refresh} Повторить
        </button>
      )}
    </div>
  );
}
function Empty({ icon, text }) {
  return (
    <div
      style={{ textAlign: "center", padding: "50px 20px", color: "var(--text-muted)" }}
    >
      <div style={{ fontSize: 44, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 14, fontWeight: 500 }}>{text}</div>
    </div>
  );
}
function Btn({ children, outline, onClick, disabled, style }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "9px 16px",
        borderRadius: 9,
        border: outline ? "1px solid #6366f1" : "none",
        background: outline ? "transparent" : "#6366f1",
        color: outline ? "#6366f1" : "#fff",
        fontSize: 12,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        display: "flex",
        alignItems: "center",
        gap: 5,
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function HistoryList({ history, loading, onRefresh, emptyText, onRestore }) {
  if (loading && history.length === 0) {
    return <LoadingBlock text="Загрузка истории..." />;
  }

  if (history.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "40px 20px" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>📜</div>
        <div style={{ fontWeight: 600, color: "var(--text-muted)" }}>
          {emptyText || "История действий пуста"}
        </div>
        <div
          style={{ display: "flex", justifyContent: "center", marginTop: 16 }}
        >
          <Btn outline onClick={onRefresh}>
            {I.refresh} Обновить
          </Btn>
        </div>
      </div>
    );
  }

  return (
    <div style={{ animation: "fadeIn .25s ease" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
          marginTop: 10,
        }}
      >
        <h3
          style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text-muted)" }}
        >
          История операций
        </h3>
        <button
          onClick={onRefresh}
          style={{
            background: "none",
            border: "none",
            color: "#6366f1",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          {I.refresh} Обновить
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {history.map((act) => {
          const isInvoice = act.action_type === "invoice";
          const isInventory = act.action_type === "inventory";
          const isCash = act.action_type === "cash";
          const isProduction = act.action_type === "production";
          const details = act.details || {};
          const isFailed =
            details.status === "failed" || act.document_number === "СБОЙ";
          let formattedDate = "";
          if (details.selected_date) {
            const parts = details.selected_date.split("-");
            if (parts.length === 3) {
              formattedDate = `${parts[2]}.${parts[1]}.${parts[0]}`;
            } else {
              formattedDate = details.selected_date;
            }
            formattedDate = `${formattedDate} (Отчетный день)`;
          } else {
            const date = new Date(act.created_at);
            formattedDate = date.toLocaleDateString("ru-RU", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });
          }
          const items = details.items || [];

          const typeColor = isFailed
            ? "#ef4444"
            : isInvoice
            ? "#10b981"
            : isInventory
            ? "#7c3aed"
            : isCash
            ? "#059669"
            : isProduction
            ? "#f97316"
            : "#06b6d4";

          return (
            <div
              key={act.id}
              style={{
                background: isFailed ? "#fffbfa" : "var(--bg-card)",
                borderRadius: 14,
                border: isFailed ? "1px solid #fee2e2" : "1px solid var(--border-color)",
                borderLeft: `4px solid ${typeColor}`,
                padding: "16px 18px",
                boxShadow: isFailed
                  ? "0 4px 12px rgba(239, 68, 68, 0.04)"
                  : "0 2px 8px rgba(0,0,0,0.03)",
                animation: "fadeIn .25s ease",
                transition: "all 0.15s ease",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  borderBottom: "1px dashed var(--border-color)",
                  paddingBottom: 12,
                  marginBottom: 12,
                }}
              >
                <div>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    {isFailed ? (
                      <span
                        style={{
                          padding: "4px 8px",
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          background: "#fee2e2",
                          color: "#ef4444",
                        }}
                      >
                        СБОЙ IIKO
                      </span>
                    ) : (
                      <span
                        style={{
                          padding: "4px 8px",
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          background: isInvoice
                            ? "#ecfdf5"
                            : isInventory
                            ? "#faf5ff"
                            : isCash
                            ? "#f0fdf4"
                            : isProduction
                            ? "#fff7ed"
                            : "#e0e7ff",
                          color: isInvoice
                            ? "#059669"
                            : isInventory
                            ? "#7c3aed"
                            : isCash
                            ? "var(--text-success)"
                            : isProduction
                            ? "#c2410c"
                            : "#4f46e5",
                        }}
                      >
                        {isInvoice
                          ? "Приход"
                          : isInventory
                          ? "Инвентаризация"
                          : isCash
                          ? "Отчет кассы"
                          : isProduction
                          ? "Приготовление"
                          : "Перемещение"}
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: isFailed ? "#ef4444" : "var(--text-main)",
                      }}
                    >
                      {act.document_number || "Без номера"}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                    👤 Выполнил:{" "}
                    <b style={{ color: "var(--text-main)" }}>
                      {act.user_name || "Неизвестный"}
                    </b>{" "}
                    (через{" "}
                    {act.document_number &&
                    String(act.document_number).startsWith("TG-")
                      ? "ТГ-Бот"
                      : "Сайт"}
                    )
                  </div>
                </div>
                <div
                  style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}
                >
                  {formattedDate}
                </div>
              </div>

              <div style={{ fontSize: 12 }}>
                {isCash ? (
                  <div>
                    <div
                      style={{
                        background: "var(--bg-hover)",
                        borderRadius: 8,
                        padding: 12,
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span style={{ color: "var(--text-muted)" }}>💵 Наличные:</span>
                        <span style={{ fontWeight: 600 }}>
                          {fmtPrice(
                            details.payments?.cash || details.cash || 0
                          )}
                        </span>
                      </div>
                      {parseFloat(details.payments?.encashment || details.encashment || 0) > 0 && (
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                          }}
                        >
                          <span style={{ color: "var(--text-muted)" }}>💰 Инкассация:</span>
                          <span style={{ fontWeight: 600 }}>
                            {fmtPrice(
                              details.payments?.encashment || details.encashment || 0
                            )}
                          </span>
                        </div>
                      )}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span style={{ color: "var(--text-muted)" }}>💳 Uzcard:</span>
                        <span style={{ fontWeight: 600 }}>
                          {fmtPrice(details.payments?.uzcard || 0)}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span style={{ color: "var(--text-muted)" }}>💳 Humo:</span>
                        <span style={{ fontWeight: 600 }}>
                          {fmtPrice(details.payments?.humo || 0)}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span style={{ color: "var(--text-muted)" }}>
                          📱 Click / Payme:
                        </span>
                        <span style={{ fontWeight: 600 }}>
                          {fmtPrice(
                            details.payments?.online || details.online || 0
                          )}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span style={{ color: "var(--text-muted)" }}>💳 RAHMAT:</span>
                        <span style={{ fontWeight: 600 }}>
                          {fmtPrice(details.payments?.rahmat || 0)}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span style={{ color: "var(--text-muted)" }}>💳 Uzum:</span>
                        <span style={{ fontWeight: 600 }}>
                          {fmtPrice(details.payments?.uzum || 0)}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span style={{ color: "var(--text-muted)" }}>🛵 Яндекс Еда:</span>
                        <span style={{ fontWeight: 600 }}>
                          {fmtPrice(details.payments?.yandex || 0)}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          borderTop: "1px dashed #e2e8f0",
                          paddingTop: 6,
                          fontWeight: 700,
                        }}
                      >
                        <span>💰 Итого выручка:</span>
                        <span>
                          {fmtPrice(
                            details.total_sales ||
                              (details.cash || 0) +
                                (details.card || 0) +
                                (details.online || 0)
                          )}
                        </span>
                      </div>
                      {details.expenses?.length > 0 && (
                        <div
                          style={{
                            borderTop: "1px dashed #e2e8f0",
                            paddingTop: 6,
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                          }}
                        >
                          <span
                            style={{
                              color: "var(--text-muted)",
                              fontWeight: 700,
                              fontSize: 11,
                            }}
                          >
                            💸 Расходы из кассы:
                          </span>
                          {details.expenses.map((exp, idx) => (
                            <div
                              key={idx}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                fontSize: 11,
                                paddingLeft: 8,
                              }}
                            >
                              <span>• {exp.name}:</span>
                              <span style={{ fontWeight: 600 }}>
                                {fmtPrice(exp.amount)}
                              </span>
                            </div>
                          ))}
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              fontSize: 11,
                              fontWeight: 700,
                              paddingLeft: 8,
                            }}
                          >
                            <span>Сумма расходов:</span>
                            <span>{fmtPrice(details.total_expenses || 0)}</span>
                          </div>
                        </div>
                      )}
                      {details.employee_wages?.length > 0 && (
                        <div
                          style={{
                            borderTop: "1px dashed #e2e8f0",
                            paddingTop: 6,
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                          }}
                        >
                          <span
                            style={{
                              color: "var(--text-muted)",
                              fontWeight: 700,
                              fontSize: 11,
                            }}
                          >
                            👥 Выданная ЗП сотрудникам:
                          </span>
                          {details.employee_wages.map((emp, idx) => (
                            <div
                              key={idx}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                fontSize: 11,
                                paddingLeft: 8,
                              }}
                            >
                              <span>• {emp.name || "Сотрудник"}:</span>
                              <span style={{ fontWeight: 600 }}>
                                {fmtPrice(emp.wage || 0)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      {(details.surplus > 0 || details.shortage > 0) && (
                        <div
                          style={{
                            borderTop: "1px dashed #e2e8f0",
                            paddingTop: 6,
                            marginTop: 4,
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                          }}
                        >
                          {details.surplus > 0 && (
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                color: "var(--text-success)",
                              }}
                            >
                              <span>🟢 Излишки:</span>
                              <span style={{ fontWeight: 700 }}>
                                +{fmtPrice(details.surplus)}
                              </span>
                            </div>
                          )}
                          {details.shortage > 0 && (
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                color: "var(--text-danger)",
                              }}
                            >
                              <span>🔴 Недостача:</span>
                              <span style={{ fontWeight: 700 }}>
                                -{fmtPrice(details.shortage)}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div
                      style={{
                        marginBottom: 8,
                        color: "var(--text-muted)",
                        fontWeight: 600,
                      }}
                    >
                      {isInvoice ? (
                        <span>
                          🏭 Поставщик:{" "}
                          <b>{details.supplier_name || "Неизвестный"}</b> → 📦
                          Склад: <b>{details.store_name || "Неизвестный"}</b>
                        </span>
                      ) : isInventory ? (
                        <span>
                          📦 Склад:{" "}
                          <b>{details.store_name || "Неизвестный склад"}</b>
                        </span>
                      ) : isProduction ? (
                        <span>
                          🍳 Приготовлено на складе: <b>Кухня Заготовки</b>
                        </span>
                      ) : (
                        <span>
                          📦 Склад:{" "}
                          <b>
                            {details.store_from_name || "Неизвестный склад"}
                          </b>{" "}
                          → 📦 Склад:{" "}
                          <b>{details.store_to_name || "Неизвестный склад"}</b>
                        </span>
                      )}
                    </div>

                    <div
                      style={{
                        background: "var(--bg-hover)",
                        borderRadius: 8,
                        padding: 10,
                      }}
                    >
                      {items.map((it, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            padding: "4px 0",
                            borderBottom:
                              idx < items.length - 1
                                ? "1px solid #f1f5f9"
                                : "none",
                            color: "var(--text-main)",
                          }}
                        >
                          <span>{it.product_name || "Товар"}</span>
                          <span style={{ fontWeight: 600 }}>
                            {it.quantity} {it.unit || "шт"}
                            {isInvoice &&
                              Number(it.price) > 0 &&
                              ` × ${fmt(Number(it.price))} сум`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {isFailed && (
                  <div
                    style={{
                      marginTop: 10,
                      background: "#fff1f1",
                      border: "1px solid #fecaca",
                      borderRadius: 8,
                      padding: "8px 12px",
                      color: "#b91c1c",
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    ⚠️ Ошибка отправки:{" "}
                    {details.error || "iiko отклонила документ"}
                  </div>
                )}

                {details.comment && (
                  <div
                    style={{
                      marginTop: 8,
                      fontStyle: "italic",
                      color: "var(--text-muted)",
                      fontSize: 11,
                    }}
                  >
                    💬 Комментарий: {details.comment}
                  </div>
                )}

                {isFailed && onRestore && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      marginTop: 12,
                    }}
                  >
                    <button
                      onClick={() => onRestore(act)}
                      style={{
                        background:
                          "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                        color: "#fff",
                        border: "none",
                        borderRadius: 8,
                        padding: "6px 14px",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        boxShadow: "0 4px 10px rgba(239, 68, 68, 0.2)",
                        transition: "all 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "translateY(-1px)";
                        e.currentTarget.style.boxShadow =
                          "0 6px 14px rgba(239, 68, 68, 0.3)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "none";
                        e.currentTarget.style.boxShadow =
                          "0 4px 10px rgba(239, 68, 68, 0.2)";
                      }}
                    >
                      🔄 Восстановить черновик
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const lbl = {
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text-muted)",
  marginBottom: 6,
  display: "block",
};
const th = {
  padding: "8px 12px",
  textAlign: "left",
  fontWeight: 600,
  color: "var(--text-muted)",
  fontSize: 11,
};
const td = { padding: "8px 12px" };
const crumb = { fontSize: 12, color: "var(--text-muted)", marginBottom: 12 };
const inp = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 9,
  border: "1px solid var(--border-color)",
  background: "var(--bg-input)",
  color: "var(--text-main)",
  fontSize: 13,
  outline: "none",
};
const numInput = {
  width: 80,
  padding: "6px 8px",
  borderRadius: 6,
  border: "1px solid var(--border-color)",
  background: "var(--bg-input)",
  color: "var(--text-main)",
  fontSize: 13,
  textAlign: "center",
  outline: "none",
};
const storeBtn = {
  padding: "14px 16px",
  borderRadius: 10,
  border: "1px solid var(--border-color)",
  background: "var(--bg-card)",
  color: "var(--text-main)",
  cursor: "pointer",
  textAlign: "left",
  fontSize: 14,
  fontWeight: 500,
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: "100%",
};

const PeriodDropdown = ({ period, setPeriod, onPeriodChange, customLabel = "Свой период", showSingleDay = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const periods = [
    { id: "today", label: "Сегодня", emoji: "📅" },
    { id: "yesterday", label: "Вчера", emoji: "🕒" },
    ...(showSingleDay ? [{ id: "single", label: "Выбрать день", emoji: "🔍" }] : []),
    { id: "this_week", label: "Текущая неделя", emoji: "📅" },
    { id: "last_week", label: "Прошлая неделя", emoji: "⏮️" },
    { id: "this_month", label: "Этот месяц", emoji: "📊" },
    { id: "last_month", label: "Прошлый месяц", emoji: "📉" },
    { id: "last_10_days", label: "Последние 10 дней", emoji: "📆" },
    { id: "custom", label: customLabel, emoji: "⚙️" },
  ];

  const selectedPeriod = periods.find(p => p.id === period) || periods.find(p => p.id === "this_month") || periods[0];

  return (
    <div ref={dropdownRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 14px",
          borderRadius: 12,
          border: "1px solid var(--border-color)",
          background: "var(--bg-card)",
          color: "var(--text-main)",
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
          transition: "all 0.2s ease",
        }}
      >
        <span>{selectedPeriod.emoji} {selectedPeriod.label}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
            marginLeft: 4,
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 999,
            minWidth: 220,
            background: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            borderRadius: 12,
            boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
            padding: 6,
            display: "flex",
            flexDirection: "column",
            gap: 2,
            animation: "fadeIn 0.15s ease",
          }}
        >
          {periods.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setPeriod(p.id);
                if (onPeriodChange) onPeriodChange(p.id);
                setIsOpen(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                borderRadius: 8,
                border: "none",
                background: period === p.id ? "var(--bg-active)" : "transparent",
                color: period === p.id ? "var(--text-main)" : "var(--text-muted)",
                fontSize: 13,
                fontWeight: period === p.id ? 700 : 500,
                textAlign: "left",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <span>{p.emoji}</span>
              <span>{p.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

function AnalyticsView({ showToast, history, historyLoading, loadHistory, loggedInUser }) {
  const isManager = loggedInUser?.baseRole === "manager";
  const [subTab, setSubTab] = useState(isManager ? "top" : "pl");
  const [loading, setLoading] = useState(false);
  const [analyticsGroup, setAnalyticsGroup] = useState(isManager ? "sales" : "finance");

  // Date ranges
  const [plPeriod, setPlPeriod] = useState("this_month");
  const [plDates, setPlDates] = useState({ from: "", to: "" });

  const [cashPeriod, setCashPeriod] = useState("today");
  const [cashDates, setCashDates] = useState({ from: "", to: "" });
  const [cashSingleDate, setCashSingleDate] = useState(() => {
    const now = new Date();
    const tzNow = new Date(now.getTime() + 5 * 60 * 60 * 1000);
    return tzNow.toISOString().split("T")[0];
  });

  const [topPeriod, setTopPeriod] = useState("today");
  const [topDates, setTopDates] = useState({ from: "", to: "" });
  const [topThreshold, setTopThreshold] = useState(30);

  const [waitersPeriod, setWaitersPeriod] = useState("today");
  const [waitersDates, setWaitersDates] = useState({ from: "", to: "" });

  const [plData, setPlData] = useState(null);
  const [selectedExpenseCategory, setSelectedExpenseCategory] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [categoryDetails, setCategoryDetails] = useState([]);
  const [cashData, setCashData] = useState(null);
  const [topData, setTopData] = useState(null);
  const [waitersData, setWaitersData] = useState(null);
  const [showExpensesDetail, setShowExpensesDetail] = useState(false);

  const [categoriesPeriod, setCategoriesPeriod] = useState("today");
  const [categoriesDates, setCategoriesDates] = useState({ from: "", to: "" });
  const [categoriesSingleDate, setCategoriesSingleDate] = useState(() => {
    const now = new Date();
    const tzNow = new Date(now.getTime() + 5 * 60 * 60 * 1000);
    return tzNow.toISOString().split("T")[0];
  });
  const [categoriesData, setCategoriesData] = useState([]);
  const [expandedGroups, setExpandedGroups] = useState({});

  // Category transactions details loader (on-demand)
  useEffect(() => {
    if (!selectedExpenseCategory) {
      setCategoryDetails([]);
      return;
    }

    const fetchCategoryDetails = async () => {
      setDetailsLoading(true);
      try {
        let from = plDates.from;
        let to = plDates.to;
        if (plPeriod !== "custom") {
          const dates = getDatesForPeriod(plPeriod);
          from = dates.from;
          to = dates.to;
        }

        const r = await fetch(
          `/api/iiko/analytics/pl/details?category=${encodeURIComponent(selectedExpenseCategory)}&from=${from}&to=${to}`,
          { cache: "no-store" }
        );
        const res = await r.json();
        if (res && res.success) {
          setCategoryDetails(res.data || []);
        } else {
          showToast(res?.error || "Ошибка загрузки деталей расходов", "error");
        }
      } catch (err) {
        showToast("Ошибка сети при загрузке деталей", "error");
      } finally {
        setDetailsLoading(false);
      }
    };

    fetchCategoryDetails();
  }, [selectedExpenseCategory, plPeriod, plDates.from, plDates.to]);

  // Cash and Admin Expenses states
  const [cashExpensesData, setCashExpensesData] = useState(null);
  const [expensePeriod, setExpensePeriod] = useState("this_month");
  const [cashReportsPage, setCashReportsPage] = useState(1);
  const [adminExpensesPage, setAdminExpensesPage] = useState(1);
  const [expenseDates, setExpenseDates] = useState(() => {
    const now = new Date();
    const tzNow = new Date(now.getTime() + 5 * 60 * 60 * 1000);
    const format = (d) => d.toISOString().split("T")[0];
    const d1 = new Date(tzNow.getFullYear(), tzNow.getMonth(), 1, 12, 0, 0);
    return { from: format(d1), to: format(tzNow) };
  });
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [wagesPeriod, setWagesPeriod] = useState("this_month");
  const [wagesData, setWagesData] = useState(null);
  const [wagesDates, setWagesDates] = useState(() => {
    const now = new Date();
    const tzNow = new Date(now.getTime() + 5 * 60 * 60 * 1000);
    const format = (d) => d.toISOString().split("T")[0];
    const d1 = new Date(tzNow.getFullYear(), tzNow.getMonth(), 1, 12, 0, 0);
    return { from: format(d1), to: format(tzNow) };
  });
  const [wagesPage, setWagesPage] = useState(1);
  const [selectedWageDay, setSelectedWageDay] = useState(null);
  const [expenseForm, setExpenseForm] = useState(() => {
    const now = new Date();
    const tzNow = new Date(now.getTime() + 5 * 60 * 60 * 1000);
    return { name: "", amount: "", date: tzNow.toISOString().split("T")[0] };
  });

  const [attendanceData, setAttendanceData] = useState(null);
  const [attendanceDate, setAttendanceDate] = useState(() => {
    const now = new Date();
    const tzNow = new Date(now.getTime() + 5 * 60 * 60 * 1000);
    return tzNow.toISOString().split("T")[0];
  });
  const [attendanceSearch, setAttendanceSearch] = useState("");
  const [attendanceRoleFilter, setAttendanceRoleFilter] = useState("all");

  // Helper date calculators
  const getDatesForPeriod = (periodType) => {
    const now = new Date();
    // Tashkent offset (+5 hours)
    const tzNow = new Date(now.getTime() + 5 * 60 * 60 * 1000);
    const format = (d) => d.toISOString().split("T")[0];

    switch (periodType) {
      case "today":
        return { from: format(tzNow), to: format(tzNow) };
      case "yesterday": {
        const y = new Date(tzNow.getTime() - 24 * 60 * 60 * 1000);
        return { from: format(y), to: format(y) };
      }
      case "this_week": {
        const day = tzNow.getDay();
        const diff = tzNow.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(tzNow.getFullYear(), tzNow.getMonth(), diff, 12, 0, 0);
        return { from: format(monday), to: format(tzNow) };
      }
      case "last_week": {
        const day = tzNow.getDay();
        const diffToMonday = tzNow.getDate() - day + (day === 0 ? -6 : 1);
        const lastMonday = new Date(tzNow.getFullYear(), tzNow.getMonth(), diffToMonday - 7, 12, 0, 0);
        const lastSunday = new Date(tzNow.getFullYear(), tzNow.getMonth(), diffToMonday - 1, 12, 0, 0);
        return { from: format(lastMonday), to: format(lastSunday) };
      }
      case "last_10_days": {
        const d1 = new Date(tzNow.getTime() - 9 * 24 * 60 * 60 * 1000);
        return { from: format(d1), to: format(tzNow) };
      }
      case "this_month": {
        const d1 = new Date(tzNow.getFullYear(), tzNow.getMonth(), 1, 12, 0, 0);
        return { from: format(d1), to: format(tzNow) };
      }
      case "last_month": {
        const d1 = new Date(
          tzNow.getFullYear(),
          tzNow.getMonth() - 1,
          1,
          12,
          0,
          0
        );
        const d2 = new Date(tzNow.getFullYear(), tzNow.getMonth(), 0, 12, 0, 0);
        return { from: format(d1), to: format(d2) };
      }
      case "all_time": {
        const start = new Date(2020, 0, 1, 12, 0, 0);
        return { from: format(start), to: format(tzNow) };
      }
      default:
        return { from: "", to: "" };
    }
  };

  // PL Loader
  const loadPL = async (periodType, customFrom = "", customTo = "") => {
    let from = customFrom;
    let to = customTo;
    if (periodType !== "custom") {
      const dates = getDatesForPeriod(periodType);
      from = dates.from;
      to = dates.to;
    }
    if (!from || !to) return;

    try {
      setLoading(true);
      const r = await fetch(`/api/iiko/analytics/pl?from=${from}&to=${to}`, { cache: "no-store" });
      const res = await r.json();
      if (res && res.success) {
        setPlData(res.data);
      } else {
        showToast(res?.error || "Ошибка загрузки P&L отчета", "error");
      }
    } catch (_e) {
      showToast("Ошибка сети при загрузке P&L", "error");
    } finally {
      setLoading(false);
    }
  };

  // Cash Loader
  const loadCash = async (periodType, customFrom = "", customTo = "") => {
    let from = customFrom;
    let to = customTo;
    if (periodType !== "custom" && periodType !== "single") {
      const dates = getDatesForPeriod(periodType);
      from = dates.from;
      to = dates.to;
    }
    if (!from || !to) return;

    try {
      setLoading(true);
      const r = await fetch(`/api/iiko/analytics/cash?from=${from}&to=${to}`, { cache: "no-store" });
      const res = await r.json();
      if (res && res.success) {
        setCashData(res.data);
      } else {
        showToast(res?.error || "Ошибка загрузки отчета кассы", "error");
      }
    } catch (_e) {
      showToast("Ошибка сети при загрузке кассы", "error");
    } finally {
      setLoading(false);
    }
  };

  // Categories Loader
  const loadCategories = async (periodType, customFrom = "", customTo = "") => {
    let from = customFrom;
    let to = customTo;
    if (periodType !== "custom" && periodType !== "single") {
      const dates = getDatesForPeriod(periodType);
      from = dates.from;
      to = dates.to;
    }
    if (!from || !to) return;

    try {
      setLoading(true);
      const r = await fetch(`/api/iiko/analytics/categories?from=${from}&to=${to}`, { cache: "no-store" });
      const res = await r.json();
      if (res && res.success) {
        setCategoriesData(res.categories || []);
      } else {
        showToast(res?.error || "Ошибка загрузки выручки по категориям", "error");
      }
    } catch (_e) {
      showToast("Ошибка сети при загрузке категорий", "error");
    } finally {
      setLoading(false);
    }
  };

  // Top Sales Loader
  const loadTop = async (periodType, customFrom = "", customTo = "") => {
    let from = customFrom;
    let to = customTo;
    if (periodType !== "custom") {
      const dates = getDatesForPeriod(periodType);
      from = dates.from;
      to = dates.to;
    }
    if (!from || !to) return;

    try {
      setLoading(true);
      const r = await fetch(
        `/api/iiko/analytics/top-sales?from=${from}&to=${to}`,
        { cache: "no-store" }
      );
      const res = await r.json();
      if (res && res.success) {
        setTopData(res.data);
        setTopThreshold(res.threshold || 30);
      } else {
        showToast(res?.error || "Ошибка загрузки топ продаж", "error");
      }
    } catch (_e) {
      showToast("Ошибка сети при загрузке топ продаж", "error");
    } finally {
      setLoading(false);
    }
  };

  // Waiters Loader
  const loadWaiters = async (periodType, customFrom = "", customTo = "") => {
    let from = customFrom;
    let to = customTo;
    if (periodType !== "custom") {
      const dates = getDatesForPeriod(periodType);
      from = dates.from;
      to = dates.to;
    }
    if (!from || !to) return;

    try {
      setLoading(true);
      const r = await fetch(
        `/api/iiko/analytics/waiters?from=${from}&to=${to}`,
        { cache: "no-store" }
      );
      const res = await r.json();
      if (res && res.success) {
        setWaitersData(res.data);
      } else {
        showToast(res?.error || "Ошибка загрузки топ официантов", "error");
      }
    } catch (_e) {
      showToast("Ошибка сети при загрузке официантов", "error");
    } finally {
      setLoading(false);
    }
  };

  // Wages Loader
  const loadWages = async (periodType, customFrom = "", customTo = "") => {
    let from = customFrom;
    let to = customTo;
    if (periodType !== "custom") {
      const dates = getDatesForPeriod(periodType);
      from = dates.from;
      to = dates.to;
    }
    if (!from || !to) return;

    try {
      setLoading(true);
      const r = await fetch(
        `/api/iiko/analytics/wages?from=${from}&to=${to}`,
        { cache: "no-store" }
      );
      const res = await r.json();
      if (res && res.success) {
        setWagesData(res.data);
        setWagesPage(1);
        setSelectedWageDay(null);
      } else {
        showToast(res?.error || "Ошибка загрузки ЗП сотрудников", "error");
      }
    } catch (_e) {
      showToast("Ошибка сети при загрузке ЗП", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleExportWagesToExcel = async () => {
    const fromDate = wagesDates.from;
    const toDate = wagesDates.to;
    if (!fromDate || !toDate) {
      showToast("Укажите период дат", "error");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`/api/iiko/analytics/wages/export?from=${fromDate}&to=${toDate}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        showToast(errJson.error || "Ошибка экспорта Excel", "error");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `wages_report_${fromDate}_to_${toDate}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast("Excel файл успешно выгружен");
    } catch (err) {
      console.error(err);
      showToast("Ошибка сети при экспорте Excel", "error");
    } finally {
      setLoading(false);
    }
  };

  // Attendance Loader
  const loadAttendance = async (dateStr) => {
    if (!dateStr) return;
    try {
      setLoading(true);
      const r = await fetch(`/api/iiko/analytics/attendance?date=${dateStr}`);
      const res = await r.json();
      if (res && res.success) {
        setAttendanceData(res.employees || []);
      } else {
        showToast(res?.error || "Ошибка загрузки посещаемости", "error");
      }
    } catch (_e) {
      showToast("Ошибка сети при загрузке посещаемости", "error");
    } finally {
      setLoading(false);
    }
  };

  // Cash Expenses Loader
  const loadCashExpenses = async (periodType, customFrom = "", customTo = "") => {
    let from = customFrom;
    let to = customTo;
    if (periodType !== "custom") {
      const dates = getDatesForPeriod(periodType);
      from = dates.from;
      to = dates.to;
    }
    if (!from || !to) return;

    try {
      setLoading(true);
      const r = await fetch(
        `/api/iiko/analytics/cash-expenses?from=${from}&to=${to}`,
        { cache: "no-store" }
      );
      const res = await r.json();
      if (res && res.success) {
        setCashExpensesData(res.data);
        setCashReportsPage(1);
        setAdminExpensesPage(1);
      } else {
        showToast(res?.error || "Ошибка загрузки наличных и расходов", "error");
      }
    } catch (_e) {
      showToast("Ошибка сети при загрузке наличных и расходов", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!expenseForm.name.trim() || !expenseForm.amount || !expenseForm.date) {
      showToast("Заполните все поля", "error");
      return;
    }
    const amt = parseFloat(expenseForm.amount);
    if (isNaN(amt) || amt <= 0) {
      showToast("Сумма должна быть больше 0", "error");
      return;
    }

    try {
      setLoading(true);
      const r = await fetch("/api/iiko/analytics/cash-expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: expenseForm.name.trim(),
          amount: amt,
          date: expenseForm.date,
        }),
      });
      const res = await r.json();
      if (res && res.success) {
        showToast("Расход успешно добавлен!");
        const now = new Date();
        const tzNow = new Date(now.getTime() + 5 * 60 * 60 * 1000);
        setExpenseForm({ name: "", amount: "", date: tzNow.toISOString().split("T")[0] });
        setShowAddExpenseModal(false);
        loadCashExpenses(expensePeriod, expenseDates.from, expenseDates.to);
      } else {
        showToast(res?.error || "Ошибка добавления расхода", "error");
      }
    } catch (_e) {
      showToast("Ошибка сети при добавлении расхода", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteExpense = async (id) => {
    if (!window.confirm("Удалить этот расход?")) return;

    try {
      setLoading(true);
      const r = await fetch(`/api/iiko/analytics/cash-expenses?id=${id}`, {
        method: "DELETE",
      });
      const res = await r.json();
      if (res && res.success) {
        showToast("Расход успешно удален!");
        loadCashExpenses(expensePeriod, expenseDates.from, expenseDates.to);
      } else {
        showToast(res?.error || "Ошибка удаления расхода", "error");
      }
    } catch (_e) {
      showToast("Ошибка сети при удалении расхода", "error");
    } finally {
      setLoading(false);
    }
  };

  // Init loaders on SubTab change
  useEffect(() => {
    if (subTab === "pl") {
      loadPL(plPeriod, plDates.from, plDates.to);
    } else if (subTab === "cash") {
      if (cashPeriod === "single") {
        loadCash("single", cashSingleDate, cashSingleDate);
      } else {
        loadCash(cashPeriod, cashDates.from, cashDates.to);
      }
    } else if (subTab === "top") {
      loadTop(topPeriod, topDates.from, topDates.to);
    } else if (subTab === "waiters") {
      loadWaiters(waitersPeriod, waitersDates.from, waitersDates.to);
    } else if (subTab === "cash_expenses") {
      loadCashExpenses(expensePeriod, expenseDates.from, expenseDates.to);
    } else if (subTab === "wages") {
      loadWages(wagesPeriod, wagesDates.from, wagesDates.to);
    } else if (subTab === "attendance") {
      loadAttendance(attendanceDate);
    } else if (subTab === "categories") {
      if (categoriesPeriod === "single") {
        loadCategories("single", categoriesSingleDate, categoriesSingleDate);
      } else {
        loadCategories(categoriesPeriod, categoriesDates.from, categoriesDates.to);
      }
    }
  }, [subTab]);

  const cardStyle = (grad, border) => ({
    padding: 20,
    borderRadius: 16,
    background: grad || "rgba(255, 255, 255, 0.7)",
    border: border || "1px solid rgba(226, 232, 240, 0.8)",
    boxShadow: "0 4px 15px rgba(0,0,0,0.03)",
    transition: "all 0.2s ease",
  });

  return (
    <div style={{ animation: "fadeIn .25s ease" }}>
      {/* Grouped Tab Selectors */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
        {/* Top level group selectors */}
        <div
          className="horizontal-scroll-container"
          style={{
            display: "flex",
            gap: 8,
            borderBottom: "1px solid var(--border-color)",
            paddingBottom: 10,
          }}
        >
          {[
            {
              id: "finance",
              label: "💰 Финансы",
              tabs: ["pl", "cash", "categories", "cash_expenses"]
            },
            {
              id: "sales",
              label: "📈 Продажи",
              tabs: ["top", "waiters"]
            },
            {
              id: "staff",
              label: "👥 Кадры",
              tabs: ["wages", "attendance"]
            }
          ].filter((g) => {
            const visibleTabs = g.tabs.filter((tabId) => {
              if (isManager && ["pl", "cash", "categories", "attendance"].includes(tabId)) return false;
              if (["cash_expenses", "wages"].includes(tabId) && !["admin", "director"].includes(loggedInUser?.baseRole)) return false;
              return true;
            });
            return visibleTabs.length > 0;
          }).map((g) => (
            <button
              key={g.id}
              onClick={() => {
                setAnalyticsGroup(g.id);
                const visibleTabs = g.tabs.filter((tabId) => {
                  if (isManager && ["pl", "cash", "categories", "attendance"].includes(tabId)) return false;
                  if (["cash_expenses", "wages"].includes(tabId) && !["admin", "director"].includes(loggedInUser?.baseRole)) return false;
                  return true;
                });
                if (visibleTabs.length > 0) {
                  setSubTab(visibleTabs[0]);
                }
              }}
              style={{
                padding: "8px 14px",
                borderRadius: 20,
                border: "none",
                background: analyticsGroup === g.id ? "var(--text-main)" : "var(--bg-active)",
                color: analyticsGroup === g.id ? "var(--bg-card)" : "var(--text-muted)",
                fontWeight: 700,
                fontSize: 12,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {g.label}
            </button>
          ))}
        </div>

        {/* Second level tab selectors */}
        <div
          className="horizontal-scroll-container"
          style={{
            display: "flex",
            gap: 10,
            paddingBottom: 2,
          }}
        >
          {[
            {
              id: "pl",
              label: "📊 Отчет о Прибыли и Убытках",
              grad: "linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)",
              text: "#4338ca",
              groupId: "finance",
            },
            {
              id: "cash",
              label: "💵 Касса",
              grad: "linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)",
              text: "#065f46",
              groupId: "finance",
            },
            {
              id: "categories",
              label: "📈 Выручка по категориям",
              grad: "linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%)",
              text: "#7c3aed",
              groupId: "finance",
            },
            {
              id: "cash_expenses",
              label: "💰 Сейф",
              grad: "linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)",
              text: "#3730a3",
              groupId: "finance",
            },
            {
              id: "top",
              label: "🍽 Топ продаж",
              grad: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
              text: "#92400e",
              groupId: "sales",
            },
            {
              id: "waiters",
              label: "🤵 Топ официантов",
              grad: "linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)",
              text: "#0369a1",
              groupId: "sales",
            },
            {
              id: "wages",
              label: "👥 Заработная плата сотрудников",
              grad: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
              text: "#92400e",
              groupId: "staff",
            },
            {
              id: "attendance",
              label: "📅 Смены сотрудников",
              grad: "linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%)",
              text: "#6b21a8",
              groupId: "staff",
            },
          ].filter((sub) => {
            if (sub.groupId !== analyticsGroup) return false;
            if (isManager && ["pl", "cash", "categories", "attendance"].includes(sub.id)) return false;
            if (["cash_expenses", "wages"].includes(sub.id) && !["admin", "director"].includes(loggedInUser?.baseRole)) return false;
            return true;
          }).map((sub) => (
            <button
              key={sub.id}
              onClick={() => setSubTab(sub.id)}
              style={{
                padding: "8px 14px",
                borderRadius: 12,
                border: subTab === sub.id ? "none" : "1px solid var(--border-color)",
                background: subTab === sub.id ? sub.grad : "var(--bg-card)",
                color: subTab === sub.id ? sub.text : "var(--text-muted)",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                boxShadow:
                  subTab === sub.id
                    ? "0 4px 12px rgba(99, 102, 241, 0.15)"
                    : "none",
                transition: "all 0.15s ease",
              }}
            >
              {sub.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: 200,
          }}
        >
          <div
            style={{ color: "#6366f1", animation: "spin 1s linear infinite" }}
          >
            {I.loader}
          </div>
          <span
            style={{
              marginLeft: 8,
              fontSize: 13,
              fontWeight: 500,
              color: "var(--text-muted)",
            }}
          >
            Загрузка аналитики...
          </span>
        </div>
      )}

      {/* 📊 P&L REPORT VIEW */}
      {!loading && subTab === "pl" && (
        <div>
          {/* PL Period Selectors */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              alignItems: "center",
              marginBottom: 20,
            }}
          >
            <PeriodDropdown
              period={plPeriod}
              setPeriod={setPlPeriod}
              onPeriodChange={(pId) => {
                if (pId !== "custom") loadPL(pId);
              }}
            />

            {plPeriod === "custom" && (
              <div
                style={{
                  display: "inline-flex",
                  gap: 6,
                  alignItems: "center",
                  marginLeft: 10,
                }}
              >
                <input
                  type="date"
                  value={plDates.from}
                  onChange={(e) =>
                    setPlDates({ ...plDates, from: e.target.value })
                  }
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid var(--border-color)",
                    fontSize: 12,
                  }}
                />
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>до</span>
                <input
                  type="date"
                  value={plDates.to}
                  onChange={(e) =>
                    setPlDates({ ...plDates, to: e.target.value })
                  }
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid var(--border-color)",
                    fontSize: 12,
                  }}
                />
                <button
                  onClick={() => loadPL("custom", plDates.from, plDates.to)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    background: "#4f46e5",
                    color: "#fff",
                    border: "none",
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  ОК
                </button>
              </div>
            )}
          </div>

          {plData ? (
            <div>
              {/* Financial Metrics Cards Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 16,
                  marginBottom: 24,
                }}
              >
                <div
                  style={cardStyle(
                    "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    "none"
                  )}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "rgba(255,255,255,0.75)",
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    💰 Выручка
                  </div>
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 800,
                      color: "#fff",
                      marginTop: 8,
                    }}
                  >
                    {fmtPrice(plData.revenue)}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "rgba(255,255,255,0.8)",
                      marginTop: 4,
                    }}
                  >
                    Общие кассовые продажи
                  </div>
                </div>

                <div
                  style={cardStyle(
                    "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
                    "none"
                  )}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "rgba(255,255,255,0.75)",
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    📉 Себестоимость (COGS)
                  </div>
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 800,
                      color: "#fff",
                      marginTop: 8,
                    }}
                  >
                    {fmtPrice(plData.cogs)}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "rgba(255,255,255,0.8)",
                      marginTop: 4,
                    }}
                  >
                    {plData.revenue > 0
                      ? `${((plData.cogs / plData.revenue) * 100).toFixed(1)}%`
                      : "0%"}{" "}
                    от выручки
                  </div>
                </div>

                <div
                  style={cardStyle(
                    "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                    "none"
                  )}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "rgba(255,255,255,0.75)",
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    💸 Операционные расходы
                  </div>
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 800,
                      color: "#fff",
                      marginTop: 8,
                    }}
                  >
                    {fmtPrice(plData.expensesSum)}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "rgba(255,255,255,0.8)",
                      marginTop: 4,
                    }}
                  >
                    {plData.revenue > 0
                      ? `${(
                          (plData.expensesSum / plData.revenue) *
                          100
                        ).toFixed(1)}%`
                      : "0%"}{" "}
                    от выручки
                  </div>
                </div>

                <div
                  style={cardStyle(
                    plData.netProfit >= 0
                      ? "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)"
                      : "linear-gradient(135deg, #b91c1c 0%, #7f1d1d 100%)",
                    "none"
                  )}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "rgba(255,255,255,0.75)",
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    💵 Чистая прибыль
                  </div>
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 800,
                      color: "#fff",
                      marginTop: 8,
                    }}
                  >
                    {fmtPrice(plData.netProfit)}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "rgba(255,255,255,0.8)",
                      marginTop: 4,
                    }}
                  >
                    Рентабельность:{" "}
                    <strong style={{ textDecoration: "underline" }}>
                      {plData.margin.toFixed(1)}%
                    </strong>
                  </div>
                </div>
              </div>

              {/* Expenses Chart Container */}
              <div
                style={{
                  background: "var(--bg-card)",
                  borderRadius: 16,
                  border: "1px solid var(--border-color)",
                  padding: 20,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 16,
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>
                    📂 Операционные расходы по счетам
                  </h3>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  <PieChart
                    data={plData.expensesDetail}
                    total={plData.expensesSum}
                    revenue={plData.revenue}
                    onSelectCategory={setSelectedExpenseCategory}
                  />

                  {/* Modal for Expense Category Transactions */}
                  {selectedExpenseCategory && plData && (
                    <div
                      style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: "rgba(15, 23, 42, 0.4)",
                        backdropFilter: "blur(4px)",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        zIndex: 9999,
                        animation: "fadeIn .2s ease",
                      }}
                      onClick={() => setSelectedExpenseCategory(null)}
                    >
                      <div
                        style={{
                          background: "var(--bg-card)",
                          borderRadius: 16,
                          border: "1px solid var(--border-color)",
                          padding: 24,
                          width: "90%",
                          maxWidth: 700,
                          maxHeight: "80vh",
                          boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
                          display: "flex",
                          flexDirection: "column",
                          animation: "scaleIn .2s cubic-bezier(0.16, 1, 0.3, 1)",
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Header */}
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            borderBottom: "1px solid var(--border-color)",
                            paddingBottom: 16,
                            marginBottom: 16,
                          }}
                        >
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "var(--text-main)" }}>
                              📂 {selectedExpenseCategory}
                            </h3>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}>
                              Всего расходов по категории: <span style={{ color: "#ef4444", fontWeight: 700 }}>{fmtPrice(plData.expensesDetail.find(e => e.name === selectedExpenseCategory)?.amount || 0)}</span>
                            </span>
                          </div>
                          <button
                            onClick={() => setSelectedExpenseCategory(null)}
                            style={{
                              background: "var(--bg-pill)",
                              border: "none",
                              borderRadius: "50%",
                              width: 32,
                              height: 32,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: "pointer",
                              color: "var(--text-main)",
                            }}
                          >
                            {I.x}
                          </button>
                        </div>

                        {/* List/Table */}
                        <div style={{ overflowY: "auto", flex: 1, paddingRight: 4, minHeight: 150, display: "flex", flexDirection: "column" }}>
                          {detailsLoading ? (
                            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: "40px 0", color: "var(--text-muted)", margin: "auto" }}>
                              <div
                                style={{
                                  color: "var(--color-primary)",
                                }}
                              >
                                {I.loader}
                              </div>
                              <span style={{ fontSize: 12, fontWeight: 600 }}>Загрузка деталей...</span>
                            </div>
                          ) : categoryDetails.length === 0 ? (
                            <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-muted)", fontStyle: "italic", margin: "auto" }}>
                              Нет транзакций в этой категории за выбранный период.
                            </div>
                          ) : (
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                              <thead>
                                <tr style={{ borderBottom: "2px solid var(--border-color)", textAlign: "left", background: "var(--bg-hover)" }}>
                                  <th style={{ padding: "10px 12px", color: "var(--text-muted)", fontWeight: 700 }}>Дата</th>
                                  <th style={{ padding: "10px 12px", color: "var(--text-muted)", fontWeight: 700 }}>Документ</th>
                                  <th style={{ padding: "10px 12px", color: "var(--text-muted)", fontWeight: 700 }}>Доп. информация</th>
                                  <th style={{ padding: "10px 12px", textAlign: "right", color: "var(--text-muted)", fontWeight: 700 }}>Сумма</th>
                                </tr>
                              </thead>
                              <tbody>
                                {categoryDetails.map((tx, idx) => {
                                  let formattedDate = "";
                                  try {
                                    if (tx.date) {
                                      const d = new Date(tx.date);
                                      formattedDate = d.toLocaleDateString("ru-RU", {
                                        day: "2-digit",
                                        month: "2-digit",
                                        year: "numeric",
                                      });
                                    }
                                  } catch (e) {
                                    formattedDate = tx.date;
                                  }

                                  return (
                                    <tr key={idx} style={{ borderBottom: "1px solid var(--border-color)" }}>
                                      <td style={{ padding: "12px", color: "var(--text-main)", fontWeight: 500 }}>{formattedDate}</td>
                                      <td style={{ padding: "12px", color: "var(--text-muted)", fontFamily: "monospace" }}>{tx.document || "—"}</td>
                                      <td style={{ padding: "12px", color: "var(--text-main)", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={tx.description}>
                                        {tx.description || "—"}
                                      </td>
                                      <td style={{ padding: "12px", textAlign: "right", color: "#ef4444", fontWeight: 700 }}>
                                        {fmtPrice(tx.amount)}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 
                  <div
                    style={{
                      height: 1,
                      background: "#e2e8f0",
                      margin: "8px 0",
                    }}
                  />
                  {plData.expensesDetail.length > 0 ? (
                    plData.expensesDetail.map((exp, idx) => {
                      const pctOfTotalExpenses = (
                        (exp.amount / (plData.expensesSum || 1)) *
                        100
                      ).toFixed(1);
                      const pctOfRevenue =
                        plData.revenue > 0
                          ? ((exp.amount / plData.revenue) * 100).toFixed(1)
                          : "0.0";
                      return (
                        <div key={idx} style={{ padding: "8px 0" }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              fontSize: 16,
                              fontWeight: 700,
                              marginBottom: 8,
                              alignItems: "center",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                gap: 10,
                                flexWrap: "wrap",
                                alignItems: "center",
                              }}
                            >
                              <span style={{ color: "var(--text-main)", fontWeight: 700 }}>{exp.name}</span>
                              <span
                                style={{
                                  background: "rgba(99, 102, 241, 0.08)",
                                  color: "#4f46e5",
                                  padding: "3px 10px",
                                  borderRadius: 6,
                                  fontSize: "12.5px",
                                  fontWeight: 700,
                                  letterSpacing: "0.2px",
                                }}
                              >
                                {pctOfTotalExpenses}% от расходов
                              </span>
                              {plData.revenue > 0 && (
                                <span
                                  style={{
                                    background: "rgba(16, 185, 129, 0.08)",
                                    color: "#10b981",
                                    padding: "3px 10px",
                                    borderRadius: 6,
                                    fontSize: "12.5px",
                                    fontWeight: 700,
                                    letterSpacing: "0.2px",
                                  }}
                                >
                                  {pctOfRevenue}% от выручки
                                </span>
                              )}
                            </div>
                            <span style={{ color: "#ef4444", flexShrink: 0, fontWeight: 800, fontSize: 16 }}>
                              {fmtPrice(exp.amount)}
                            </span>
                          </div>
                          <div
                            style={{
                              width: "100%",
                              height: 6,
                              borderRadius: 3,
                              background: "var(--bg-pill)",
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                borderRadius: 3,
                                background: "#ef4444",
                                width: `${pctOfTotalExpenses}%`,
                                transition: "width .5s ease",
                              }}
                            />
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div
                      style={{
                        fontStyle: "italic",
                        color: "var(--text-muted)",
                        fontSize: 13,
                        textAlign: "center",
                        padding: "20px 0",
                      }}
                    >
                      Расходы отсутствуют за выбранный период.
                    </div>
                  )}
                  */}
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{
                fontStyle: "italic",
                color: "var(--text-muted)",
                fontSize: 13,
                textAlign: "center",
                padding: 40,
              }}
            >
              Выберите период для построения отчета.
            </div>
          )}
        </div>
      )}

      {/* 💵 CASH REGISTER REPORT VIEW */}
      {!loading && subTab === "cash" && (
        <div>
          {/* Branch Select & Cash Period Selectors */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              alignItems: "center",
              marginBottom: 20,
            }}
          >
            <div>
              <select
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-card)",
                  fontSize: 12,
                  fontWeight: 700,
                  outline: "none",
                }}
              >
                <option value="fest">📍 Lokmaco г.Фергана тц Festival</option>
              </select>
            </div>

            <PeriodDropdown
              period={cashPeriod}
              setPeriod={setCashPeriod}
              showSingleDay={true}
              customLabel="Период"
              onPeriodChange={(pId) => {
                if (pId !== "custom" && pId !== "single") {
                  loadCash(pId);
                } else if (pId === "single") {
                  loadCash("single", cashSingleDate, cashSingleDate);
                }
              }}
            />

            {cashPeriod === "single" && (
              <div
                style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}
              >
                <span
                  style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}
                >
                  Выбор даты:
                </span>
                <input
                  type="date"
                  value={cashSingleDate}
                  onChange={(e) => setCashSingleDate(e.target.value)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid var(--border-color)",
                    fontSize: 12,
                    background: "var(--bg-card)",
                    color: "var(--text-main)",
                    outline: "none",
                  }}
                />
                <button
                  onClick={() => {
                    if (cashSingleDate) {
                      loadCash("single", cashSingleDate, cashSingleDate);
                    }
                  }}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    background: "#ef4444",
                    color: "#fff",
                    border: "none",
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  ОК
                </button>
              </div>
            )}

            {cashPeriod === "custom" && (
              <div
                style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}
              >
                <input
                  type="date"
                  value={cashDates.from}
                  onChange={(e) =>
                    setCashDates({ ...cashDates, from: e.target.value })
                  }
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid var(--border-color)",
                    fontSize: 12,
                  }}
                />
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>до</span>
                <input
                  type="date"
                  value={cashDates.to}
                  onChange={(e) =>
                    setCashDates({ ...cashDates, to: e.target.value })
                  }
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid var(--border-color)",
                    fontSize: 12,
                  }}
                />
                <button
                  onClick={() =>
                    loadCash("custom", cashDates.from, cashDates.to)
                  }
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    background: "#10b981",
                    color: "#fff",
                    border: "none",
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  ОК
                </button>
              </div>
            )}
          </div>

          {cashData ? (
            (() => {
              // 1. Determine the active date range selected by the user
              let activeFrom = "";
              let activeTo = "";

              if (cashPeriod === "single") {
                activeFrom = cashSingleDate;
                activeTo = cashSingleDate;
              } else if (cashPeriod === "custom") {
                activeFrom = cashDates.from;
                activeTo = cashDates.to;
              } else {
                const dates = getDatesForPeriod(cashPeriod);
                activeFrom = dates.from;
                activeTo = dates.to;
              }

              // 2. Sum up the cashier reports from Supabase for the active range
              let cashierTotals = null;
              let periodReports = [];
              if (cashData && Array.isArray(cashData.cashierReports)) {
                periodReports = cashData.cashierReports;
              } else if (history) {
                const cashReports = history.filter(
                  (h) => h.action_type === "cash"
                );
                periodReports = cashReports.filter((report) => {
                  const reportDate =
                    report.details?.selected_date ||
                    new Date(report.created_at).toISOString().split("T")[0];
                  return reportDate >= activeFrom && reportDate <= activeTo;
                });
              }

                if (periodReports.length > 0) {
                  cashierTotals = {
                    cash: 0,
                    encashment: 0,
                    encashmentFromExpenses: 0,
                    uzcard: 0,
                    humo: 0,
                    online: 0,
                    rahmat: 0,
                    uzum: 0,
                    yandex: 0,
                    totalExpenses: 0,
                    reportsCount: periodReports.length,
                  };

                  periodReports.forEach((report) => {
                    const det = report.details || {};
                    cashierTotals.cash += parseFloat(
                      det.payments?.cash || det.cash || 0
                    );
                    
                    const reportExpenses = det.expenses || [];
                    const encFromExp = reportExpenses.reduce((sum, item) => {
                      const name = (item.name || "").toLowerCase();
                      if (name.includes("инкасс")) {
                        return sum + (parseFloat(item.amount) || 0);
                      }
                      return sum;
                    }, 0);

                    const reportEncashment = parseFloat(
                      det.payments?.encashment || det.encashment || 0
                    );
                    cashierTotals.encashment += Math.max(reportEncashment, encFromExp);
                    
                    cashierTotals.encashmentFromExpenses += encFromExp;

                    cashierTotals.uzcard += parseFloat(
                      det.payments?.uzcard || 0
                    );
                    cashierTotals.humo += parseFloat(det.payments?.humo || 0);
                    cashierTotals.online += parseFloat(
                      det.payments?.online || det.online || 0
                    );
                    cashierTotals.rahmat += parseFloat(
                      det.payments?.rahmat || 0
                    );
                    cashierTotals.uzum += parseFloat(det.payments?.uzum || 0);
                    cashierTotals.yandex += parseFloat(
                      det.payments?.yandex || 0
                    );
                    cashierTotals.totalExpenses += parseFloat(
                      det.total_expenses || 0
                    );
                  });
                }

              return (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 20 }}
                >
                  {/* Cash Key Metrics Cards Grid */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(200px, 1fr))",
                      gap: 16,
                    }}
                  >
                    <div
                      style={cardStyle(
                        "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                        "none"
                      )}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "rgba(255,255,255,0.75)",
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                        }}
                      >
                        💰 Выручка iiko
                      </div>
                      <div
                        style={{
                          fontSize: 24,
                          fontWeight: 800,
                          color: "#fff",
                          marginTop: 8,
                        }}
                      >
                        {fmtPrice(cashData.revenue)}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "rgba(255,255,255,0.8)",
                          marginTop: 4,
                        }}
                      >
                        За выбранный период
                      </div>
                    </div>

                    {cashData.kitchenRevenue !== undefined && (
                      <div
                        style={cardStyle(
                          "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
                          "none"
                        )}
                      >
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: "rgba(255,255,255,0.75)",
                            textTransform: "uppercase",
                            letterSpacing: 0.5,
                          }}
                        >
                          🍳 Выручка Кухня главная
                        </div>
                        <div
                          style={{
                            fontSize: 24,
                            fontWeight: 800,
                            color: "#fff",
                            marginTop: 8,
                          }}
                        >
                          {fmtPrice(cashData.kitchenRevenue)}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "rgba(255,255,255,0.8)",
                            marginTop: 4,
                          }}
                        >
                          {cashData.revenue > 0 ? `${Math.round((cashData.kitchenRevenue / cashData.revenue) * 100)}% от общей кассы` : "0% от общей кассы"}
                        </div>
                      </div>
                    )}

                    {cashData.basementKitchenRevenue !== undefined && (
                      <div
                        style={cardStyle(
                          "linear-gradient(135deg, #a855f7 0%, #8b5cf6 100%)",
                          "none"
                        )}
                      >
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: "rgba(255,255,255,0.75)",
                            textTransform: "uppercase",
                            letterSpacing: 0.5,
                          }}
                        >
                          🍕 Выручка Кухня подвал
                        </div>
                        <div
                          style={{
                            fontSize: 24,
                            fontWeight: 800,
                            color: "#fff",
                            marginTop: 8,
                          }}
                        >
                          {fmtPrice(cashData.basementKitchenRevenue)}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "rgba(255,255,255,0.8)",
                            marginTop: 4,
                          }}
                        >
                          {cashData.revenue > 0 ? `${Math.round((cashData.basementKitchenRevenue / cashData.revenue) * 100)}% от общей кассы` : "0% от общей кассы"}
                        </div>
                      </div>
                    )}

                    {cashData.barRevenue !== undefined && (
                      <div
                        style={cardStyle(
                          "linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)",
                          "none"
                        )}
                      >
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: "rgba(255,255,255,0.75)",
                            textTransform: "uppercase",
                            letterSpacing: 0.5,
                          }}
                        >
                          🍸 Выручка Бара
                        </div>
                        <div
                          style={{
                            fontSize: 24,
                            fontWeight: 800,
                            color: "#fff",
                            marginTop: 8,
                          }}
                        >
                          {fmtPrice(cashData.barRevenue)}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "rgba(255,255,255,0.8)",
                            marginTop: 4,
                          }}
                        >
                          {cashData.revenue > 0 ? `${Math.round((cashData.barRevenue / cashData.revenue) * 100)}% от общей кассы` : "0% от общей кассы"}
                        </div>
                      </div>
                    )}

                    <div style={cardStyle("#fff", "1px solid #e2e8f0")}>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "var(--text-muted)",
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                        }}
                      >
                        🧾 Всего чеков
                      </div>
                      <div
                        style={{
                          fontSize: 24,
                          fontWeight: 800,
                          color: "var(--text-main)",
                          marginTop: 8,
                        }}
                      >
                        {cashData.orderCount}
                      </div>
                      <div
                        style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}
                      >
                        Выставлено счетов в iiko
                      </div>
                    </div>

                    <div style={cardStyle("#fff", "1px solid #e2e8f0")}>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "var(--text-muted)",
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                        }}
                      >
                        📈 Средний чек
                      </div>
                      <div
                        style={{
                          fontSize: 24,
                          fontWeight: 800,
                          color: "var(--text-main)",
                          marginTop: 8,
                        }}
                      >
                        {fmtPrice(cashData.avgCheck)}
                      </div>
                      <div
                        style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}
                      >
                        Средняя стоимость заказа
                      </div>
                    </div>

                    <div style={cardStyle("#fff", "1px solid #e2e8f0")}>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "var(--text-muted)",
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                        }}
                      >
                        👥 Количество гостей
                      </div>
                      <div
                        style={{
                          fontSize: 24,
                          fontWeight: 800,
                          color: "var(--text-main)",
                          marginTop: 8,
                        }}
                      >
                        {cashData.guestCount || "—"}
                      </div>
                      <div
                        style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}
                      >
                        Общее число посетителей
                      </div>
                    </div>
                  </div>

                  {/* Audit Comparison Table comparing iiko vs cashier */}
                  <div
                    style={{
                      background: "var(--bg-card)",
                      borderRadius: 16,
                      border: "1px solid var(--border-color)",
                      padding: 20,
                      boxShadow: "0 4px 15px rgba(0,0,0,0.02)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 16,
                        borderBottom: "1px solid #f1f5f9",
                        paddingBottom: 10,
                      }}
                    >
                      <h3
                        style={{
                          margin: 0,
                          fontSize: 15,
                          fontWeight: 800,
                          color: "var(--text-main)",
                        }}
                      >
                        ⚖️ Сверка выручки и оплат (iiko vs Сдача кассира)
                      </h3>
                      {cashierTotals ? (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: "#10b981",
                            background: "rgba(16, 185, 129, 0.08)",
                            padding: "4px 10px",
                            borderRadius: 8,
                          }}
                        >
                          Сведено смен: {cashierTotals.reportsCount}
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: "#ef4444",
                            background: "rgba(239, 68, 68, 0.08)",
                            padding: "4px 10px",
                            borderRadius: 8,
                          }}
                        >
                          Нет сданных смен кассира за период
                        </span>
                      )}
                    </div>

                    {(() => {
                      const mapIikoToField = (iikoName) => {
                        const name = iikoName.toLowerCase();
                        if ((name.includes("нал") || name.includes("cash")) && name.includes("-")) return "encashment";
                        if (name.includes("нал") || name.includes("cash")) return "cash";
                        if (name.includes("uzcard")) return "uzcard";
                        if (name.includes("humo")) return "humo";
                        if (
                          name.includes("click") ||
                          name.includes("payme") ||
                          name.includes("онлайн")
                        )
                          return "online";
                        if (name.includes("rahmat")) return "rahmat";
                        if (name.includes("uzum")) return "uzum";
                        if (
                          name.includes("янндекс") ||
                          name.includes("yandex") ||
                          name.includes("яндекс")
                        )
                          return "yandex";
                        return "other";
                      };

                      const iikoPayments = {
                        cash: 0,
                        encashment: 0,
                        uzcard: 0,
                        humo: 0,
                        online: 0,
                        rahmat: 0,
                        uzum: 0,
                        yandex: 0,
                        other: 0,
                      };

                      if (cashData && cashData.paymentsSplit) {
                        cashData.paymentsSplit.forEach((item) => {
                          const field = mapIikoToField(item.name);
                          iikoPayments[field] += item.amount;
                        });
                      }

                      const cashierPayments = cashierTotals
                        ? {
                            cash: cashierTotals.cash,
                            encashment: cashierTotals.encashment || 0,
                            uzcard: cashierTotals.uzcard,
                            humo: cashierTotals.humo,
                            online: cashierTotals.online,
                            rahmat: cashierTotals.rahmat,
                            uzum: cashierTotals.uzum,
                            yandex: cashierTotals.yandex,
                          }
                        : {
                            cash: 0,
                            encashment: 0,
                            uzcard: 0,
                            humo: 0,
                            online: 0,
                            rahmat: 0,
                            uzum: 0,
                            yandex: 0,
                          };

                      const totalExpenses = cashierTotals
                        ? cashierTotals.totalExpenses
                        : 0;

                      const rows = [
                        { label: "💵 Наличные", field: "cash" },
                        { label: "💵 Наличные-", field: "encashment" },
                        { label: "💳 Uzcard", field: "uzcard" },
                        { label: "💳 Humo", field: "humo" },
                        { label: "📱 Click / Payme", field: "online" },
                        { label: "💳 RAHMAT", field: "rahmat" },
                        { label: "💳 Uzum", field: "uzum" },
                        { label: "🛵 Яндекс Еда", field: "yandex" },
                      ];

                      if (iikoPayments.other > 0) {
                        rows.push({
                          label: "⚙️ Другие оплаты (iiko)",
                          field: "other",
                        });
                      }

                      const thStyle = {
                        padding: "10px 8px",
                        borderBottom: "2px solid #cbd5e1",
                        background: "var(--bg-hover)",
                        fontSize: "11px",
                        fontWeight: "700",
                        color: "var(--text-muted)",
                        textAlign: "right",
                      };
                      const tdStyle = {
                        padding: "10px 8px",
                        borderBottom: "1px solid var(--border-color)",
                        fontSize: "12px",
                        color: "var(--text-main)",
                        textAlign: "right",
                      };

                      return (
                        <div
                          style={{
                            overflowX: "auto",
                            borderRadius: 10,
                            border: "1px solid var(--border-color)",
                          }}
                        >
                          <table
                            style={{
                              width: "100%",
                              borderCollapse: "collapse",
                              minWidth: 800,
                            }}
                          >
                            <thead>
                              <tr>
                                <th style={{ ...thStyle, textAlign: "left" }}>
                                  Тип оплаты
                                </th>
                                <th style={thStyle}>Сумма из iiko</th>
                                <th style={thStyle}>Расходы кассира</th>
                                <th style={thStyle}>Расчетный остаток</th>
                                <th style={thStyle}>Факт сдачи</th>
                                <th style={thStyle}>Разница излишек/недосдача</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((row, idx) => {
                                let iikoVal = iikoPayments[row.field] || 0;
                                let cashVal = cashierPayments[row.field] || 0;
                                let expVal = 0;

                                if (row.field === "cash") {
                                  cashVal = cashierPayments.encashment || 0;
                                  expVal = 0;
                                } else if (row.field === "encashment") {
                                  cashVal = cashierPayments.cash || 0;
                                  expVal = totalExpenses;
                                }

                                const calculatedBalance = iikoVal - expVal;
                                const diff = cashierTotals
                                  ? (row.field === "cash" ? calculatedBalance - cashVal : cashVal - calculatedBalance)
                                  : 0;

                                return (
                                  <tr key={idx}>
                                    <td
                                      style={{
                                        ...tdStyle,
                                        textAlign: "left",
                                        fontWeight: "600",
                                        background: "var(--bg-hover)",
                                      }}
                                    >
                                      {row.label}
                                    </td>
                                    <td style={tdStyle}>{fmtPrice(iikoVal)}</td>
                                    <td
                                      style={{
                                        ...tdStyle,
                                        color:
                                          expVal > 0 ? "#ef4444" : "#64748b",
                                      }}
                                    >
                                      {expVal > 0 ? fmtPrice(expVal) : "—"}
                                    </td>
                                    <td style={tdStyle}>{fmtPrice(calculatedBalance)}</td>
                                    <td
                                      style={{
                                        ...tdStyle,
                                        fontWeight: "700",
                                        color: "var(--text-main)",
                                        background: "#fafafa",
                                      }}
                                    >
                                      {cashierTotals ? fmtPrice(cashVal) : "—"}
                                    </td>
                                    <td
                                      style={{
                                        ...tdStyle,
                                        fontWeight: "800",
                                        color: !cashierTotals
                                          ? "#64748b"
                                          : diff < 0
                                          ? "#ef4444"
                                          : diff > 0
                                          ? "#10b981"
                                          : "#64748b",
                                        background:
                                          cashierTotals && diff !== 0
                                            ? diff < 0
                                              ? "#fef2f2"
                                              : "#f0fdf4"
                                            : "transparent",
                                      }}
                                    >
                                      {!cashierTotals
                                        ? "—"
                                        : (diff > 0 ? "+" : "") +
                                          (diff !== 0 ? fmtPrice(diff) : "0")}
                                    </td>
                                  </tr>
                                );
                              })}

                              {/* Total Row */}
                              {(() => {
                                let totalIiko = 0;
                                let totalCashier = 0;
                                let displayTotalExpenses = totalExpenses;

                                rows.forEach((row) => {
                                  let iikoVal = iikoPayments[row.field] || 0;
                                  let cashVal = cashierPayments[row.field] || 0;
                                  if (row.field === "cash") {
                                    cashVal = cashierPayments.encashment || 0;
                                  } else if (row.field === "encashment") {
                                    cashVal = cashierPayments.cash || 0;
                                  }

                                  totalIiko += iikoVal;
                                  totalCashier += cashVal;
                                });

                                const totalCalc = totalIiko - displayTotalExpenses;
                                const totalDiff = totalCashier - totalCalc;

                                return (
                                  <tr
                                    style={{
                                      background: "var(--bg-hover)",
                                      fontWeight: "800",
                                    }}
                                  >
                                    <td
                                      style={{
                                        ...tdStyle,
                                        textAlign: "left",
                                        borderTop: "2px solid #cbd5e1",
                                      }}
                                    >
                                      📊 ИТОГО СМЕНА
                                    </td>
                                    <td
                                      style={{
                                        ...tdStyle,
                                        borderTop: "2px solid #cbd5e1",
                                      }}
                                    >
                                      {fmtPrice(totalIiko)}
                                    </td>
                                    <td
                                      style={{
                                        ...tdStyle,
                                        borderTop: "2px solid #cbd5e1",
                                        color:
                                          displayTotalExpenses > 0
                                            ? "#ef4444"
                                            : "#64748b",
                                      }}
                                    >
                                      {displayTotalExpenses > 0
                                        ? fmtPrice(displayTotalExpenses)
                                        : "—"}
                                    </td>
                                    <td
                                      style={{
                                        ...tdStyle,
                                        borderTop: "2px solid #cbd5e1",
                                      }}
                                    >
                                      {fmtPrice(totalCalc)}
                                    </td>
                                    <td
                                      style={{
                                        ...tdStyle,
                                        borderTop: "2px solid #cbd5e1",
                                        background: "var(--bg-pill)",
                                      }}
                                    >
                                      {cashierTotals
                                        ? fmtPrice(totalCashier)
                                        : "—"}
                                    </td>
                                    <td
                                      style={{
                                        ...tdStyle,
                                        borderTop: "2px solid #cbd5e1",
                                        color: !cashierTotals
                                          ? "#64748b"
                                          : totalDiff < 0
                                          ? "#ef4444"
                                          : totalDiff > 0
                                          ? "#10b981"
                                          : "#64748b",
                                        background:
                                          cashierTotals && totalDiff !== 0
                                            ? totalDiff < 0
                                              ? "#fee2e2"
                                              : "#dcfce7"
                                            : "transparent",
                                      }}
                                    >
                                      {!cashierTotals
                                        ? "—"
                                        : (totalDiff > 0 ? "+" : "") +
                                          (totalDiff !== 0
                                            ? fmtPrice(totalDiff)
                                            : "0")}
                                    </td>
                                  </tr>
                                );
                              })()}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <HistoryList
                      history={periodReports}
                      loading={historyLoading}
                      onRefresh={loadHistory}
                      emptyText="История отчетов кассы пуста за выбранный период"
                    />
                  </div>
                </div>
              );
            })()
          ) : (
            <div
              style={{
                fontStyle: "italic",
                color: "var(--text-muted)",
                fontSize: 13,
                textAlign: "center",
                padding: 40,
              }}
            >
              Выберите период для построения отчета.
            </div>
          )}
        </div>
      )}

      {/* 📈 CATEGORIES REVENUE VIEW */}
      {!loading && subTab === "categories" && (
        <div style={{ animation: "fadeIn .25s ease" }}>
          {/* Period Selectors */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              alignItems: "center",
              marginBottom: 20,
            }}
          >
            <PeriodDropdown
              period={categoriesPeriod}
              setPeriod={setCategoriesPeriod}
              showSingleDay={true}
              customLabel="Период"
              onPeriodChange={(pId) => {
                if (pId === "single") {
                  loadCategories("single", categoriesSingleDate, categoriesSingleDate);
                } else if (pId !== "custom") {
                  loadCategories(pId);
                }
              }}
            />
          </div>

          {/* Date Pickers */}
          {categoriesPeriod === "single" && (
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 20 }}>
              <input
                type="date"
                value={categoriesSingleDate}
                onChange={(e) => {
                  setCategoriesSingleDate(e.target.value);
                  loadCategories("single", e.target.value, e.target.value);
                }}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-input)",
                  color: "var(--text-main)",
                  fontSize: 13,
                }}
              />
            </div>
          )}

          {categoriesPeriod === "custom" && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                alignItems: "center",
                marginBottom: 20,
                background: "var(--bg-card)",
                padding: 16,
                borderRadius: 12,
                border: "1px solid var(--border-color)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>С:</span>
                <input
                  type="date"
                  value={categoriesDates.from}
                  onChange={(e) => setCategoriesDates({ ...categoriesDates, from: e.target.value })}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid var(--border-color)",
                    background: "var(--bg-input)",
                    color: "var(--text-main)",
                    fontSize: 13,
                  }}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>По:</span>
                <input
                  type="date"
                  value={categoriesDates.to}
                  onChange={(e) => setCategoriesDates({ ...categoriesDates, to: e.target.value })}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid var(--border-color)",
                    background: "var(--bg-input)",
                    color: "var(--text-main)",
                    fontSize: 13,
                  }}
                />
              </div>
              <button
                onClick={() => loadCategories("custom", categoriesDates.from, categoriesDates.to)}
                className="btn btn-primary"
                style={{
                  padding: "7px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                Построить
              </button>
            </div>
          )}

          {categoriesData && categoriesData.length > 0 ? (
            (() => {
              // Group and aggregate data into Kitchen and Bar
              const mainGroups = {
                "Кухня": {
                  name: "Кухня",
                  emoji: "🍳",
                  total: 0,
                  subs: {},
                },
                "Бар": {
                  name: "Бар",
                  emoji: "🍹",
                  total: 0,
                  subs: {},
                },
              };
              let grandTotal = 0;
              
              categoriesData.forEach((row) => {
                const top = row["DishGroup.TopParent"] || "Без категории";
                const sub = row["DishGroup"] || "Без подгруппы";
                const amount = Math.abs(parseFloat(row["DishDiscountSumInt"] || 0));
                
                grandTotal += amount;
                
                if (top === "Бар") {
                  mainGroups["Бар"].total += amount;
                  if (!mainGroups["Бар"].subs[sub]) {
                    mainGroups["Бар"].subs[sub] = 0;
                  }
                  mainGroups["Бар"].subs[sub] += amount;
                } else {
                  mainGroups["Кухня"].total += amount;
                  if (!mainGroups["Кухня"].subs[top]) {
                    mainGroups["Кухня"].subs[top] = 0;
                  }
                  mainGroups["Кухня"].subs[top] += amount;
                }
              });

              const sortedGroups = Object.values(mainGroups)
                .filter((g) => g.total > 0)
                .sort((a, b) => b.total - a.total);

              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  {/* Summary Card */}
                  <div
                    style={{
                      background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
                      borderRadius: 16,
                      padding: "20px 24px",
                      color: "#ffffff",
                      boxShadow: "0 10px 25px rgba(124, 58, 237, 0.15)",
                    }}
                  >
                    <div style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.8, fontWeight: 600 }}>
                      Общая выручка по категориям
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 800, marginTop: 4 }}>
                      {fmtPrice(grandTotal)}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
                      Разделено на {sortedGroups.length} основные группы меню
                    </div>
                  </div>

                  {/* Categories Breakdown */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {sortedGroups.map((group) => {
                      const pct = grandTotal > 0 ? (group.total / grandTotal) * 100 : 0;
                      const isExpanded = !!expandedGroups[group.name];
                      const sortedSubs = Object.entries(group.subs).sort((a, b) => b[1] - a[1]);
                      
                      return (
                        <div
                          key={group.name}
                          style={{
                            background: "var(--bg-card)",
                            border: "1px solid var(--border-color)",
                            borderRadius: 16,
                            padding: "16px 20px",
                            boxShadow: "0 4px 15px rgba(0,0,0,0.02)",
                            transition: "all 0.2s ease",
                          }}
                        >
                          <div
                            onClick={() => {
                              setExpandedGroups({
                                ...expandedGroups,
                                [group.name]: !isExpanded,
                              });
                            }}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              cursor: "pointer",
                              userSelect: "none",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              <span style={{ fontSize: 20 }}>
                                {group.name === "Бар" ? "🍹" : "🍳"}
                              </span>
                              <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text-main)" }}>
                                {group.name}
                              </span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              <span style={{ fontWeight: 800, fontSize: 15, color: "#10b981" }}>
                                {fmtPrice(group.total)}
                              </span>
                              <span
                                style={{
                                  background: "var(--bg-active)",
                                  color: "var(--text-main)",
                                  fontSize: 11,
                                  fontWeight: 700,
                                  padding: "4px 8px",
                                  borderRadius: 8,
                                }}
                              >
                                {pct.toFixed(1)}%
                              </span>
                              <span
                                style={{
                                  fontSize: 10,
                                  color: "var(--text-muted)",
                                  transform: isExpanded ? "rotate(180deg)" : "rotate(0)",
                                  transition: "transform 0.2s ease",
                                }}
                              >
                                ▼
                              </span>
                            </div>
                          </div>

                          {/* Progress bar */}
                          <div
                            style={{
                              width: "100%",
                              height: 6,
                              background: "rgba(0,0,0,0.05)",
                              borderRadius: 3,
                              marginTop: 12,
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                width: `${pct}%`,
                                height: "100%",
                                background: "linear-gradient(90deg, #7c3aed 0%, #4f46e5 100%)",
                                borderRadius: 3,
                              }}
                            />
                          </div>

                          {/* Subcategories list */}
                          {isExpanded && (
                            <div
                              style={{
                                marginTop: 16,
                                borderTop: "1px solid var(--border-color)",
                                paddingTop: 12,
                                display: "flex",
                                flexDirection: "column",
                                gap: 10,
                              }}
                            >
                              {sortedSubs.map(([subName, subAmount]) => {
                                const subPct = group.total > 0 ? (subAmount / group.total) * 100 : 0;
                                const subEmoji = (() => {
                                  const n = subName.toLowerCase();
                                  if (n.includes("мохито")) return "🍹";
                                  if (n.includes("айсти") || n.includes("айс ти")) return "🍹";
                                  if (n.includes("кофе") || n.includes("американо") || n.includes("капучино")) return "☕";
                                  if (n.includes("чай")) return "🫖";
                                  if (n.includes("бабл")) return "🧋";
                                  if (n.includes("коктейл")) return "🍸";
                                  if (n.includes("шейк")) return "🥛";
                                  if (n.includes("смузи")) return "🥤";
                                  if (n.includes("фреш")) return "🥤";
                                  if (n.includes("локма")) return "🥞";
                                  if (n.includes("вафли")) return "🧇";
                                  if (n.includes("фондю")) return "🍫";
                                  if (n.includes("сладости") || n.includes("десерт")) return "🍰";
                                  if (n.includes("мороженое")) return "🍦";
                                  if (n.includes("доп")) return "🧁";
                                  return "🍽";
                                })();
                                return (
                                  <div
                                    key={subName}
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                      fontSize: 13,
                                      padding: "4px 0",
                                    }}
                                  >
                                    <span style={{ color: "var(--text-muted)", fontWeight: 500, display: "flex", alignItems: "center", gap: 8 }}>
                                      <span style={{ fontSize: 16 }}>{subEmoji}</span>
                                      <span>{subName}</span>
                                    </span>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                      <span style={{ fontWeight: 600, color: "var(--text-main)" }}>
                                        {fmtPrice(subAmount)}
                                      </span>
                                      <span
                                        style={{
                                          fontSize: 10,
                                          color: "var(--text-muted)",
                                          width: 38,
                                          textAlign: "right",
                                        }}
                                      >
                                        ({subPct.toFixed(0)}%)
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()
          ) : (
            <div
              style={{
                fontStyle: "italic",
                color: "var(--text-muted)",
                fontSize: 13,
                textAlign: "center",
                padding: 40,
              }}
            >
              Нет данных о выручке по категориям за выбранный период.
            </div>
          )}
        </div>
      )}

      {/* 🍽 TOP SALES VIEW */}
      {!loading && subTab === "top" && (
        <div>
          {/* Top Sales Period Selectors */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              alignItems: "center",
              marginBottom: 20,
            }}
          >
            <PeriodDropdown
              period={topPeriod}
              setPeriod={setTopPeriod}
              customLabel="Период"
              onPeriodChange={(pId) => {
                if (pId !== "custom") loadTop(pId);
              }}
            />

            {topPeriod === "custom" && (
              <div
                style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}
              >
                <input
                  type="date"
                  value={topDates.from}
                  onChange={(e) =>
                    setTopDates({ ...topDates, from: e.target.value })
                  }
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid var(--border-color)",
                    fontSize: 12,
                  }}
                />
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>до</span>
                <input
                  type="date"
                  value={topDates.to}
                  onChange={(e) =>
                    setTopDates({ ...topDates, to: e.target.value })
                  }
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid var(--border-color)",
                    fontSize: 12,
                  }}
                />
                <button
                  onClick={() => loadTop("custom", topDates.from, topDates.to)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    background: "#f59e0b",
                    color: "#fff",
                    border: "none",
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  ОК
                </button>
              </div>
            )}
          </div>

          {topData ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                gap: 16,
              }}
            >
              {topData.length > 0 ? (
                topData.map((cat, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: "var(--bg-card)",
                      borderRadius: 16,
                      border: "1px solid var(--border-color)",
                      padding: 20,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 14,
                        borderBottom: "1px solid #f1f5f9",
                        paddingBottom: 8,
                      }}
                    >
                      <h4
                        style={{
                          margin: 0,
                          fontSize: 14,
                          fontWeight: 800,
                          color: "var(--text-main)",
                        }}
                      >
                        📂 {cat.name}
                      </h4>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#f59e0b",
                          background: "rgba(245, 158, 11, 0.08)",
                          padding: "2px 8px",
                          borderRadius: 6,
                        }}
                      >
                        {fmtPrice(cat.totalRevenue)}
                      </span>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                      }}
                    >
                      {(() => {
                        const dishes = cat.dishes || [];
                        const popularDishes = dishes.filter(
                          (d) => d.amount >= topThreshold
                        );
                        const weakDishes = dishes.filter(
                          (d) => d.amount < topThreshold
                        );
                        const weakDishesSorted = [...weakDishes].sort(
                          (a, b) => a.amount - b.amount
                        );

                        return (
                          <>
                            {popularDishes.length > 0 && (
                              <div style={{ marginBottom: 12 }}>
                                <div
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 800,
                                    color: "#ef4444",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.5px",
                                    marginBottom: 8,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 4,
                                  }}
                                >
                                  🔥 Популярные ({popularDishes.length})
                                </div>
                                <div
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 10,
                                  }}
                                >
                                  {popularDishes.map((dish, i) => (
                                    <div
                                      key={i}
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 10,
                                        fontSize: 13,
                                      }}
                                    >
                                      <span
                                        style={{
                                          fontSize: 16,
                                          width: 20,
                                          textAlign: "center",
                                        }}
                                      >
                                        {i === 0
                                          ? "🥇"
                                          : i === 1
                                          ? "🥈"
                                          : i === 2
                                          ? "🥉"
                                          : "•"}
                                      </span>
                                      <div
                                        style={{
                                          flex: 1,
                                          fontWeight: 600,
                                          color: "var(--text-main)",
                                        }}
                                      >
                                        {dish.name}
                                      </div>
                                      <div
                                        style={{
                                          color: "var(--text-muted)",
                                          textAlign: "right",
                                        }}
                                      >
                                        <div
                                          style={{
                                            fontWeight: 700,
                                            color: "var(--text-main)",
                                          }}
                                        >
                                          {dish.amount} шт
                                        </div>
                                        <div style={{ fontSize: 11 }}>
                                          {fmtPrice(dish.revenue)}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {weakDishesSorted.length > 0 && (
                              <div>
                                <div
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 800,
                                    color: "var(--text-muted)",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.5px",
                                    marginBottom: 8,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 4,
                                  }}
                                >
                                  💤 Слабые продажи ({weakDishesSorted.length})
                                </div>
                                <div
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 10,
                                  }}
                                >
                                  {weakDishesSorted.map((dish, i) => (
                                    <div
                                      key={i}
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 10,
                                        fontSize: 13,
                                      }}
                                    >
                                      <span
                                        style={{
                                          fontSize: 14,
                                          width: 20,
                                          textAlign: "center",
                                          color: "var(--text-muted)",
                                        }}
                                      >
                                        •
                                      </span>
                                      <div
                                        style={{
                                          flex: 1,
                                          fontWeight: 500,
                                          color: "var(--text-muted)",
                                        }}
                                      >
                                        {dish.name}
                                      </div>
                                      <div
                                        style={{
                                          color: "var(--text-muted)",
                                          textAlign: "right",
                                        }}
                                      >
                                        <div
                                          style={{
                                            fontWeight: 600,
                                            color: "var(--text-muted)",
                                          }}
                                        >
                                          {dish.amount} шт
                                        </div>
                                        <div style={{ fontSize: 11 }}>
                                          {fmtPrice(dish.revenue)}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                ))
              ) : (
                <div
                  style={{
                    fontStyle: "italic",
                    color: "var(--text-muted)",
                    fontSize: 13,
                    textAlign: "center",
                    padding: 40,
                    gridColumn: "1 / -1",
                  }}
                >
                  Нет проданных товаров за этот период.
                </div>
              )}
            </div>
          ) : (
            <div
              style={{
                fontStyle: "italic",
                color: "var(--text-muted)",
                fontSize: 13,
                textAlign: "center",
                padding: 40,
              }}
            >
              Выберите период для построения отчета.
            </div>
          )}
        </div>
      )}

      {/* 🤵 TOP WAITERS VIEW */}
      {!loading && subTab === "waiters" && (
        <div>
          {/* Waiters Period Selectors */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              alignItems: "center",
              marginBottom: 20,
            }}
          >
            <PeriodDropdown
              period={waitersPeriod}
              setPeriod={setWaitersPeriod}
              customLabel="Период"
              onPeriodChange={(pId) => {
                if (pId !== "custom") loadWaiters(pId);
              }}
            />

            {waitersPeriod === "custom" && (
              <div
                style={{
                  display: "inline-flex",
                  gap: 6,
                  alignItems: "center",
                  marginLeft: 10,
                }}
              >
                <input
                  type="date"
                  value={waitersDates.from}
                  onChange={(e) =>
                    setWaitersDates({ ...waitersDates, from: e.target.value })
                  }
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid var(--border-color)",
                    fontSize: 12,
                  }}
                />
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>до</span>
                <input
                  type="date"
                  value={waitersDates.to}
                  onChange={(e) =>
                    setWaitersDates({ ...waitersDates, to: e.target.value })
                  }
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid var(--border-color)",
                    fontSize: 12,
                  }}
                />
                <button
                  onClick={() =>
                    loadWaiters("custom", waitersDates.from, waitersDates.to)
                  }
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    background: "#0284c7",
                    color: "#fff",
                    border: "none",
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  ОК
                </button>
              </div>
            )}
          </div>

          {waitersData ? (
            <div
              style={{
                background: "var(--bg-card)",
                borderRadius: 16,
                border: "1px solid var(--border-color)",
                padding: 20,
                boxShadow: "0 4px 15px rgba(0,0,0,0.02)",
              }}
            >
              <h3
                style={{
                  margin: "0 0 20px",
                  fontSize: 16,
                  fontWeight: 800,
                  color: "var(--text-main)",
                }}
              >
                🏆 Продажи по сотрудникам / официантам
              </h3>

              {waitersData.length > 0 ? (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 12 }}
                >
                  {waitersData.map((waiter, idx) => {
                    const maxSales = waitersData[0].sales || 1;
                    const pctOfMax = (waiter.sales / maxSales) * 100;
                    return (
                      <div
                        key={idx}
                        style={{
                          padding: "12px 14px",
                          borderRadius: 12,
                          border: "1px solid #f1f5f9",
                          background:
                            idx === 0
                              ? "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)"
                              : "#fff",
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                          position: "relative",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            zIndex: 1,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 16,
                                fontWeight: 800,
                                color: "var(--text-muted)",
                                width: 24,
                              }}
                            >
                              {idx === 0
                                ? "🥇"
                                : idx === 1
                                ? "🥈"
                                : idx === 2
                                ? "🥉"
                                : `${idx + 1}.`}
                            </span>
                            <span
                              style={{
                                fontSize: 13,
                                fontWeight: 700,
                                color: "var(--text-main)",
                              }}
                            >
                              {waiter.name}
                            </span>
                          </div>
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 800,
                              color: "#0284c7",
                            }}
                          >
                            {fmtPrice(waiter.sales)}
                          </span>
                        </div>

                        {/* Extra Waiter Metrics */}
                        <div
                          style={{
                            display: "flex",
                            gap: 16,
                            fontSize: 11,
                            color: "var(--text-muted)",
                            marginTop: 2,
                            marginBottom: 2,
                            zIndex: 1,
                          }}
                        >
                          <span>
                            🧾 Чеков:{" "}
                            <strong style={{ color: "var(--text-main)" }}>
                              {waiter.orders}
                            </strong>
                          </span>
                          {waiter.refunds > 0 && (
                            <span style={{ color: "#ef4444" }}>
                              🔄 Возвратов: <strong>{waiter.refunds}</strong>
                            </span>
                          )}
                          <span>
                            📈 Ср. чек:{" "}
                            <strong style={{ color: "var(--text-main)" }}>
                              {fmtPrice(waiter.avgCheck)}
                            </strong>
                          </span>
                        </div>

                        {/* Progress Bar visual indicator */}
                        <div
                          style={{
                            width: "100%",
                            height: 6,
                            borderRadius: 3,
                            background: "var(--bg-pill)",
                            overflow: "hidden",
                            marginTop: 4,
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              borderRadius: 3,
                              background: idx === 0 ? "#0284c7" : "#38bdf8",
                              width: `${pctOfMax}%`,
                              transition: "width .5s ease",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div
                  style={{
                    fontStyle: "italic",
                    color: "var(--text-muted)",
                    fontSize: 13,
                    textAlign: "center",
                    padding: "40px 0",
                  }}
                >
                  Нет продаж сотрудников за этот период.
                </div>
              )}
            </div>
          ) : (
            <div
              style={{
                fontStyle: "italic",
                color: "var(--text-muted)",
                fontSize: 13,
                textAlign: "center",
                padding: 40,
              }}
            >
              Выберите период для построения отчета.
            </div>
          )}
        </div>
      )}

      {/* 💰 CASH & EXPENSES VIEW */}
      {!loading && subTab === "cash_expenses" && (
        <div>
          {/* Period Selectors */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              alignItems: "center",
              marginBottom: 20,
            }}
          >
            <PeriodDropdown
              period={expensePeriod}
              setPeriod={setExpensePeriod}
              customLabel="Период"
              onPeriodChange={(pId) => {
                if (pId !== "custom") loadCashExpenses(pId);
              }}
            />

            {expensePeriod === "custom" && (
              <div
                style={{
                  display: "inline-flex",
                  gap: 6,
                  alignItems: "center",
                  marginLeft: 10,
                }}
              >
                <input
                  type="date"
                  value={expenseDates.from}
                  onChange={(e) =>
                    setExpenseDates({ ...expenseDates, from: e.target.value })
                  }
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid var(--border-color)",
                    fontSize: 12,
                    background: "var(--bg-card)",
                    color: "var(--text-main)",
                  }}
                />
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>до</span>
                <input
                  type="date"
                  value={expenseDates.to}
                  onChange={(e) =>
                    setExpenseDates({ ...expenseDates, to: e.target.value })
                  }
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid var(--border-color)",
                    fontSize: 12,
                    background: "var(--bg-card)",
                    color: "var(--text-main)",
                  }}
                />
                <button
                  onClick={() =>
                    loadCashExpenses("custom", expenseDates.from, expenseDates.to)
                  }
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    background: "#ef4444",
                    color: "#fff",
                    border: "none",
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  ОК
                </button>
              </div>
            )}

            <button
              onClick={() => setShowAddExpenseModal(true)}
              style={{
                marginLeft: "auto",
                padding: "8px 14px",
                borderRadius: 8,
                background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                color: "#fff",
                border: "none",
                fontWeight: 700,
                fontSize: 12,
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(239, 68, 68, 0.2)",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {I.plus} Добавить расход
            </button>
          </div>

          {cashExpensesData ? (
            <div>
              {/* Summary Cards */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 16,
                  marginBottom: 24,
                }}
              >
                <div style={cardStyle("linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)", "1px solid #6ee7b7")}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#065f46", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    💰 Остаток в сейфе (Итоговый баланс)
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: "#064e3b", marginTop: 8 }}>
                    {fmtPrice(cashExpensesData.allTimeBalance)}
                  </div>
                  <div style={{ fontSize: 11, color: "#065f46", marginTop: 4 }}>
                    Все сданные наличные за всё время минус все расходы из сейфа
                  </div>
                </div>

                <div style={cardStyle("linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)", "1px solid #7dd3fc")}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#0369a1", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    💵 Сдано наличными за период
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: "#0c4a6e", marginTop: 8 }}>
                    {fmtPrice(cashExpensesData.periodNetCashTotal)}
                  </div>
                  <div style={{ fontSize: 11, color: "#0369a1", marginTop: 4 }}>
                    Сумма наличных средств, поступивших от кассиров за выбранные даты
                  </div>
                </div>

                <div style={cardStyle("linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)", "1px solid #fca5a5")}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#991b1b", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    💸 Расходы из сейфа за период
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: "#7f1d1d", marginTop: 8 }}>
                    {fmtPrice(cashExpensesData.periodAdminExpensesTotal)}
                  </div>
                  <div style={{ fontSize: 11, color: "#991b1b", marginTop: 4 }}>
                    Административные и хозяйственные списания из сейфа за выбранные даты
                  </div>
                </div>
              </div>

              {/* Two Column Layout */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
                  gap: 20,
                  alignItems: "start",
                }}
              >
                {/* Left: Cashier Reports */}
                <div
                  style={{
                    background: "var(--bg-card)",
                    borderRadius: 16,
                    border: "1px solid var(--border-color)",
                    padding: 20,
                    boxShadow: "0 4px 15px rgba(0,0,0,0.02)",
                  }}
                >
                  <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 800, color: "var(--text-main)" }}>
                    📥 Отчеты кассы по дням
                  </h3>
                  {cashExpensesData.cashReports.length > 0 ? (
                    <div style={{ overflowX: "auto" }}>
                      {(() => {
                        const ITEMS_PER_PAGE = 10;
                        const cashReportsTotalPages = Math.ceil(cashExpensesData.cashReports.length / ITEMS_PER_PAGE);
                        const indexOfLastCashReport = cashReportsPage * ITEMS_PER_PAGE;
                        const indexOfFirstCashReport = indexOfLastCashReport - ITEMS_PER_PAGE;
                        const currentCashReports = cashExpensesData.cashReports.slice(indexOfFirstCashReport, indexOfLastCashReport);

                        return (
                          <>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                              <thead>
                                <tr style={{ borderBottom: "1px solid var(--border-color)", color: "var(--text-muted)" }}>
                                  <th style={{ padding: "8px 4px", textAlign: "left" }}>Дата</th>
                                  <th style={{ padding: "8px 4px", textAlign: "right" }}>Выручка (нал.)</th>
                                  <th style={{ padding: "8px 4px", textAlign: "right" }}>Расход</th>
                                  <th style={{ padding: "8px 4px", textAlign: "right" }}>Сдано</th>
                                </tr>
                              </thead>
                              <tbody>
                                {currentCashReports.map((report) => (
                                  <tr key={report.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                                    <td style={{ padding: "10px 4px", fontWeight: 600, color: "var(--text-main)" }}>{report.date}</td>
                                    <td style={{ padding: "10px 4px", textAlign: "right", fontWeight: 700, color: "var(--text-main)" }}>
                                      {fmtPrice(report.grossCash + report.cashierExpenses)}
                                    </td>
                                    <td style={{ padding: "10px 4px", textAlign: "right", color: "#ef4444" }}>
                                      {fmtPrice(report.cashierExpenses)}
                                    </td>
                                    <td style={{ padding: "10px 4px", textAlign: "right", fontWeight: 700, color: "var(--text-success)" }}>
                                      {fmtPrice(report.grossCash)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>

                            {/* Pagination Controls */}
                            {cashReportsTotalPages > 1 && (
                              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10, marginTop: 16 }}>
                                <button
                                  type="button"
                                  disabled={cashReportsPage === 1}
                                  onClick={() => setCashReportsPage((p) => p - 1)}
                                  style={{
                                    padding: "4px 8px",
                                    borderRadius: 6,
                                    border: "1px solid var(--border-color)",
                                    background: "var(--bg-card)",
                                    color: "var(--text-main)",
                                    cursor: cashReportsPage === 1 ? "not-allowed" : "pointer",
                                    opacity: cashReportsPage === 1 ? 0.5 : 1,
                                    fontSize: 11,
                                    fontWeight: 600,
                                  }}
                                >
                                  ◀ Назад
                                </button>
                                <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>
                                  Стр. {cashReportsPage} из {cashReportsTotalPages}
                                </span>
                                <button
                                  type="button"
                                  disabled={cashReportsPage === cashReportsTotalPages}
                                  onClick={() => setCashReportsPage((p) => p + 1)}
                                  style={{
                                    padding: "4px 8px",
                                    borderRadius: 6,
                                    border: "1px solid var(--border-color)",
                                    background: "var(--bg-card)",
                                    color: "var(--text-main)",
                                    cursor: cashReportsPage === cashReportsTotalPages ? "not-allowed" : "pointer",
                                    opacity: cashReportsPage === cashReportsTotalPages ? 0.5 : 1,
                                    fontSize: 11,
                                    fontWeight: 600,
                                  }}
                                >
                                  Вперед ▶
                                </button>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  ) : (
                    <div style={{ fontStyle: "italic", color: "var(--text-muted)", padding: 20, textAlign: "center" }}>
                      Нет отчетов кассы за этот период.
                    </div>
                  )}
                </div>

                {/* Right: Administrative Expenses */}
                <div
                  style={{
                    background: "var(--bg-card)",
                    borderRadius: 16,
                    border: "1px solid var(--border-color)",
                    padding: 20,
                    boxShadow: "0 4px 15px rgba(0,0,0,0.02)",
                  }}
                >
                  <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 800, color: "var(--text-main)" }}>
                    📤 Административные расходы (списания)
                  </h3>
                  {cashExpensesData.adminExpenses.length > 0 ? (
                    <div style={{ overflowX: "auto" }}>
                      {(() => {
                        const ITEMS_PER_PAGE = 10;
                        const adminExpensesTotalPages = Math.ceil(cashExpensesData.adminExpenses.length / ITEMS_PER_PAGE);
                        const indexOfLastAdminExpense = adminExpensesPage * ITEMS_PER_PAGE;
                        const indexOfFirstAdminExpense = indexOfLastAdminExpense - ITEMS_PER_PAGE;
                        const currentAdminExpenses = cashExpensesData.adminExpenses.slice(indexOfFirstAdminExpense, indexOfLastAdminExpense);

                        return (
                          <>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                              <thead>
                                <tr style={{ borderBottom: "1px solid var(--border-color)", color: "var(--text-muted)", textAlign: "left" }}>
                                  <th style={{ padding: "8px 4px" }}>Дата</th>
                                  <th style={{ padding: "8px 4px" }}>Название</th>
                                  <th style={{ padding: "8px 4px" }}>Сумма</th>
                                  <th style={{ padding: "8px 4px", width: 40 }}></th>
                                </tr>
                              </thead>
                              <tbody>
                                {currentAdminExpenses.map((expense) => (
                                  <tr key={expense.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                                    <td style={{ padding: "10px 4px", fontWeight: 600, color: "var(--text-main)" }}>{expense.date}</td>
                                    <td style={{ padding: "10px 4px", color: "var(--text-main)" }}>{expense.name}</td>
                                    <td style={{ padding: "10px 4px", fontWeight: 700, color: "#ef4444" }}>{fmtPrice(expense.amount)}</td>
                                    <td style={{ padding: "10px 4px" }}>
                                      <button
                                        onClick={() => handleDeleteExpense(expense.id)}
                                        style={{
                                          background: "none",
                                          border: "none",
                                          color: "#ef4444",
                                          cursor: "pointer",
                                          padding: 4,
                                          display: "flex",
                                          alignItems: "center",
                                        }}
                                        title="Удалить"
                                      >
                                        {I.trash}
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>

                            {/* Pagination Controls */}
                            {adminExpensesTotalPages > 1 && (
                              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10, marginTop: 16 }}>
                                <button
                                  type="button"
                                  disabled={adminExpensesPage === 1}
                                  onClick={() => setAdminExpensesPage((p) => p - 1)}
                                  style={{
                                    padding: "4px 8px",
                                    borderRadius: 6,
                                    border: "1px solid var(--border-color)",
                                    background: "var(--bg-card)",
                                    color: "var(--text-main)",
                                    cursor: adminExpensesPage === 1 ? "not-allowed" : "pointer",
                                    opacity: adminExpensesPage === 1 ? 0.5 : 1,
                                    fontSize: 11,
                                    fontWeight: 600,
                                  }}
                                >
                                  ◀ Назад
                                </button>
                                <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>
                                  Стр. {adminExpensesPage} из {adminExpensesTotalPages}
                                </span>
                                <button
                                  type="button"
                                  disabled={adminExpensesPage === adminExpensesTotalPages}
                                  onClick={() => setAdminExpensesPage((p) => p + 1)}
                                  style={{
                                    padding: "4px 8px",
                                    borderRadius: 6,
                                    border: "1px solid var(--border-color)",
                                    background: "var(--bg-card)",
                                    color: "var(--text-main)",
                                    cursor: adminExpensesPage === adminExpensesTotalPages ? "not-allowed" : "pointer",
                                    opacity: adminExpensesPage === adminExpensesTotalPages ? 0.5 : 1,
                                    fontSize: 11,
                                    fontWeight: 600,
                                  }}
                                >
                                  Вперед ▶
                                </button>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  ) : (
                    <div style={{ fontStyle: "italic", color: "var(--text-muted)", padding: 20, textAlign: "center" }}>
                      Нет расходов за этот период.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ fontStyle: "italic", color: "var(--text-muted)", padding: 40, textAlign: "center" }}>
              Выберите период для построения отчета.
            </div>
          )}
        </div>
      )}

      {/* 👥 WAGES VIEW */}
      {!loading && subTab === "wages" && (
        <div>
          {/* Period Selectors */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              alignItems: "center",
              marginBottom: 20,
            }}
          >
            <PeriodDropdown
              period={wagesPeriod}
              setPeriod={setWagesPeriod}
              customLabel="Период"
              onPeriodChange={(pId) => {
                if (pId !== "custom") loadWages(pId);
              }}
            />

            {wagesPeriod === "custom" && (
              <div
                style={{
                  display: "inline-flex",
                  gap: 6,
                  alignItems: "center",
                  marginLeft: 10,
                }}
              >
                <input
                  type="date"
                  value={wagesDates.from}
                  onChange={(e) =>
                    setWagesDates({ ...wagesDates, from: e.target.value })
                  }
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid var(--border-color)",
                    fontSize: 12,
                    background: "var(--bg-card)",
                    color: "var(--text-main)",
                  }}
                />
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>до</span>
                <input
                  type="date"
                  value={wagesDates.to}
                  onChange={(e) =>
                    setWagesDates({ ...wagesDates, to: e.target.value })
                  }
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid var(--border-color)",
                    fontSize: 12,
                    background: "var(--bg-card)",
                    color: "var(--text-main)",
                  }}
                />
                <button
                  onClick={() =>
                    loadWages("custom", wagesDates.from, wagesDates.to)
                  }
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    background: "#ef4444",
                    color: "#fff",
                    border: "none",
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  ОК
                </button>
              </div>
            )}

            {wagesData && wagesData.days && wagesData.days.length > 0 && (
              <button
                onClick={handleExportWagesToExcel}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "1px solid #10b981",
                  background: "transparent",
                  color: "#10b981",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  marginLeft: "auto",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "all 0.15s ease",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = "rgba(16, 185, 129, 0.05)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                📥 Экспорт в Excel
              </button>
            )}
          </div>

          {wagesData ? (
            <div>
              {/* Summary Cards */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 16,
                  marginBottom: 24,
                }}
              >
                <div style={cardStyle("linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)", "1px solid #6ee7b7")}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#065f46", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    👥 Всего выплачено ЗП за период
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: "#064e3b", marginTop: 8 }}>
                    {fmtPrice(wagesData.periodTotalPaid)}
                  </div>
                  <div style={{ fontSize: 11, color: "#065f46", marginTop: 4 }}>
                    Сумма всех дневных выплат сотрудникам
                  </div>
                </div>

                <div style={cardStyle("linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)", "1px solid #7dd3fc")}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#0369a1", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    📅 Средняя выплата в рабочий день
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: "#0c4a6e", marginTop: 8 }}>
                    {fmtPrice(wagesData.avgDailyPaid)}
                  </div>
                  <div style={{ fontSize: 11, color: "#0369a1", marginTop: 4 }}>
                    Средняя сумма выплат на дни со сменами
                  </div>
                </div>

                <div style={cardStyle("linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%)", "1px solid #d8b4fe")}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#6b21a8", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    📅 Последние данные внесены за
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: "#581c87", marginTop: 8 }}>
                    {wagesData.latestWageDate || "Нет данных"}
                  </div>
                  <div style={{ fontSize: 11, color: "#6b21a8", marginTop: 4 }}>
                    Дата последней записи с заработной платой
                  </div>
                </div>
              </div>

              {/* Two Column Layout */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
                  gap: 20,
                  alignItems: "start",
                }}
              >
                {/* Left: Daily Summaries */}
                <div
                  style={{
                    background: "var(--bg-card)",
                    borderRadius: 16,
                    border: "1px solid var(--border-color)",
                    padding: 20,
                    boxShadow: "0 4px 15px rgba(0,0,0,0.02)",
                  }}
                >
                  <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 800, color: "var(--text-main)" }}>
                    📅 Выплаты по дням
                  </h3>
                  {wagesData.days.length > 0 ? (
                    <div style={{ overflowX: "auto" }}>
                      {(() => {
                        const ITEMS_PER_PAGE = 10;
                        const totalPages = Math.ceil(wagesData.days.length / ITEMS_PER_PAGE);
                        const indexOfLast = wagesPage * ITEMS_PER_PAGE;
                        const indexOfFirst = indexOfLast - ITEMS_PER_PAGE;
                        const currentDays = wagesData.days.slice(indexOfFirst, indexOfLast);

                        return (
                          <>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                              <thead>
                                <tr style={{ borderBottom: "1px solid var(--border-color)", color: "var(--text-muted)" }}>
                                  <th style={{ padding: "8px 4px", textAlign: "left" }}>Дата</th>
                                  <th style={{ padding: "8px 4px", textAlign: "right" }}>Сотрудников</th>
                                  <th style={{ padding: "8px 4px", textAlign: "right" }}>Всего выплачено</th>
                                  <th style={{ padding: "8px 4px", width: 30 }}></th>
                                </tr>
                              </thead>
                              <tbody>
                                {currentDays.map((day) => {
                                  const isSelected = selectedWageDay?.date === day.date;
                                  return (
                                    <tr 
                                      key={day.date} 
                                      onClick={() => setSelectedWageDay(day)}
                                      style={{ 
                                        borderBottom: "1px solid var(--border-color)",
                                        cursor: "pointer",
                                        background: isSelected ? "var(--bg-hover)" : "none",
                                      }}
                                    >
                                      <td style={{ padding: "12px 4px", fontWeight: 600, color: "var(--text-main)" }}>
                                        {day.date}
                                      </td>
                                      <td style={{ padding: "12px 4px", textAlign: "right", color: "var(--text-main)" }}>
                                        {day.totalEmployees}
                                      </td>
                                      <td style={{ padding: "12px 4px", textAlign: "right", fontWeight: 700, color: "var(--text-main)" }}>
                                        {fmtPrice(day.totalPaid)}
                                      </td>
                                      <td style={{ padding: "12px 4px", textAlign: "right", color: "var(--text-muted)" }}>
                                        ▶
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>

                            {totalPages > 1 && (
                              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10, marginTop: 16 }}>
                                <button
                                  type="button"
                                  disabled={wagesPage === 1}
                                  onClick={() => setWagesPage((p) => p - 1)}
                                  style={{
                                    padding: "4px 8px",
                                    borderRadius: 6,
                                    border: "1px solid var(--border-color)",
                                    background: "var(--bg-card)",
                                    color: "var(--text-main)",
                                    cursor: wagesPage === 1 ? "not-allowed" : "pointer",
                                    opacity: wagesPage === 1 ? 0.5 : 1,
                                    fontSize: 11,
                                    fontWeight: 600,
                                  }}
                                >
                                  ◀ Назад
                                </button>
                                <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>
                                  Стр. {wagesPage} из {totalPages}
                                </span>
                                <button
                                  type="button"
                                  disabled={wagesPage === totalPages}
                                  onClick={() => setWagesPage((p) => p + 1)}
                                  style={{
                                    padding: "4px 8px",
                                    borderRadius: 6,
                                    border: "1px solid var(--border-color)",
                                    background: "var(--bg-card)",
                                    color: "var(--text-main)",
                                    cursor: wagesPage === totalPages ? "not-allowed" : "pointer",
                                    opacity: wagesPage === totalPages ? 0.5 : 1,
                                    fontSize: 11,
                                    fontWeight: 600,
                                  }}
                                >
                                  Вперед ▶
                                </button>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  ) : (
                    <div style={{ fontStyle: "italic", color: "var(--text-muted)", padding: 20, textAlign: "center" }}>
                      Нет отчетов по заработной плате за этот период.
                      {wagesData.latestWageDate && (
                        <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-main)", fontWeight: 600 }}>
                          📅 Последний внесенный отчет: <span style={{ color: "#ef4444" }}>{wagesData.latestWageDate}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Right: Detailed list for selected day */}
                <div
                  style={{
                    background: "var(--bg-card)",
                    borderRadius: 16,
                    border: "1px solid var(--border-color)",
                    padding: 20,
                    boxShadow: "0 4px 15px rgba(0,0,0,0.02)",
                  }}
                >
                  <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 800, color: "var(--text-main)" }}>
                    👥 Детализация за день: {selectedWageDay ? selectedWageDay.date : "Выберите день слева"}
                  </h3>
                  {selectedWageDay ? (
                    <div>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid var(--border-color)", color: "var(--text-muted)", textAlign: "left" }}>
                            <th style={{ padding: "8px 4px" }}>Сотрудник</th>
                            <th style={{ padding: "8px 4px", textAlign: "right" }}>Выплачено (UZS)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedWageDay.employees.map((emp, idx) => (
                            <tr key={idx} style={{ borderBottom: "1px solid var(--border-color)" }}>
                              <td style={{ padding: "10px 4px", fontWeight: 600, color: "var(--text-main)" }}>
                                {emp.name}
                              </td>
                              <td style={{ padding: "10px 4px", textAlign: "right", fontWeight: 700, color: "var(--text-main)" }}>
                                {fmtPrice(emp.wage)}
                              </td>
                            </tr>
                          ))}
                          <tr style={{ fontWeight: 800 }}>
                            <td style={{ padding: "12px 4px", color: "var(--text-main)" }}>Итого за день:</td>
                            <td style={{ padding: "12px 4px", textAlign: "right", color: "var(--text-success)" }}>
                              {fmtPrice(selectedWageDay.totalPaid)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ fontStyle: "italic", color: "var(--text-muted)", padding: 20, textAlign: "center" }}>
                      Выберите конкретный день в левой таблице, чтобы посмотреть детализацию выданных зарплат.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ fontStyle: "italic", color: "var(--text-muted)", padding: 40, textAlign: "center" }}>
              Загрузка отчетов о заработной плате...
            </div>
          )}
        </div>
      )}

      {/* 📅 ATTENDANCE VIEW */}
      {!loading && subTab === "attendance" && (
        <div>
          {/* Controls: Date selection, Role filter, Search */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 16,
              alignItems: "center",
              marginBottom: 20,
              background: "var(--bg-card)",
              borderRadius: 16,
              border: "1px solid var(--border-color)",
              padding: 16,
              boxShadow: "0 4px 15px rgba(0,0,0,0.02)",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                Выбрать дату
              </label>
              <input
                type="date"
                value={attendanceDate}
                onChange={(e) => {
                  setAttendanceDate(e.target.value);
                  loadAttendance(e.target.value);
                }}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-card)",
                  color: "var(--text-main)",
                  fontSize: 13,
                  fontWeight: 600,
                  outline: "none",
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 200 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                Поиск сотрудника
              </label>
              <input
                type="text"
                placeholder="Введите имя для поиска..."
                value={attendanceSearch}
                onChange={(e) => setAttendanceSearch(e.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-card)",
                  color: "var(--text-main)",
                  fontSize: 13,
                  outline: "none",
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                Фильтр ролей
              </label>
              <select
                value={attendanceRoleFilter}
                onChange={(e) => setAttendanceRoleFilter(e.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-card)",
                  color: "var(--text-main)",
                  fontSize: 13,
                  fontWeight: 600,
                  outline: "none",
                }}
              >
                <option value="all">Все роли</option>
                <option value="ADM">Администраторы (ADM)</option>
                <option value="BAR">Бармены (BAR)</option>
                <option value="KITCH">Кухня (KITCH)</option>
                <option value="WAIT">Официанты (WAIT)</option>
                <option value="CLEAN">Мойка/Уборка (CLEAN)</option>
                <option value="STAFF">Прочий персонал (STAFF)</option>
              </select>
            </div>
          </div>

          {attendanceData ? (() => {
            // Apply search & role filters
            const filtered = attendanceData.filter(emp => {
              const matchesSearch = emp.name.toLowerCase().includes(attendanceSearch.toLowerCase());
              let matchesRole = true;
              if (attendanceRoleFilter !== "all") {
                if (attendanceRoleFilter === "KITCH") {
                  matchesRole = emp.role.includes("COOK") || emp.role.includes("KITCH") || emp.role.includes("KCH") || emp.role.includes("ШЕФ");
                } else if (attendanceRoleFilter === "CLEAN") {
                  matchesRole = emp.role.includes("CLEAN") || emp.role.includes("WASH") || emp.role.includes("ПОСУД");
                } else if (attendanceRoleFilter === "WAIT") {
                  matchesRole = emp.role.includes("WAIT") || emp.role.includes("ОФИЦ");
                } else {
                  matchesRole = emp.role.includes(attendanceRoleFilter);
                }
              }
              return matchesSearch && matchesRole;
            });

            const present = filtered.filter(e => e.isActive);
            const absent = filtered.filter(e => !e.isActive);

            // Time formatter helper
            const formatTime = (isoString) => {
              if (!isoString) return "";
              try {
                const dateObj = new Date(isoString);
                return dateObj.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
              } catch (e) {
                return isoString;
              }
            };

            // Shift duration calculator helper
            const getDuration = (fromStr, toStr) => {
              if (!fromStr) return "";
              const fromTime = new Date(fromStr).getTime();
              const toTime = toStr ? new Date(toStr).getTime() : Date.now();
              const diffMs = toTime - fromTime;
              if (diffMs < 0) return "0 ч";
              const hours = Math.floor(diffMs / (1000 * 60 * 60));
              const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
              return `${hours} ч ${mins} мин`;
            };

            return (
              <div>
                {/* Summary Cards */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 16,
                    marginBottom: 24,
                  }}
                >
                  <div style={cardStyle("linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%)", "1px solid #d8b4fe")}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#6b21a8", textTransform: "uppercase", letterSpacing: 0.5 }}>
                      👥 Всего в штате
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: "#581c87", marginTop: 8 }}>
                      {filtered.length}
                    </div>
                    <div style={{ fontSize: 11, color: "#6b21a8", marginTop: 4 }}>
                      С учетом фильтра ролей и поиска
                    </div>
                  </div>

                  <div style={cardStyle("linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)", "1px solid #6ee7b7")}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#065f46", textTransform: "uppercase", letterSpacing: 0.5 }}>
                      🟢 На смене сегодня
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: "#064e3b", marginTop: 8 }}>
                      {present.length}
                    </div>
                    <div style={{ fontSize: 11, color: "#065f46", marginTop: 4 }}>
                      Сотрудники, открывшие смену в iiko
                    </div>
                  </div>

                  <div style={cardStyle("linear-gradient(135deg, #f1f5f9 0%, #cbd5e1 100%)", "1px solid #94a3b8")}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: 0.5 }}>
                      ⚪ Отсутствуют
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: "#0f172a", marginTop: 8 }}>
                      {absent.length}
                    </div>
                    <div style={{ fontSize: 11, color: "#334155", marginTop: 4 }}>
                      Нет отметки о выходе на смену
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
                    gap: 20,
                    alignItems: "start",
                  }}
                >
                  {/* Left: Active Shifts */}
                  <div
                    style={{
                      background: "var(--bg-card)",
                      borderRadius: 16,
                      border: "1px solid var(--border-color)",
                      padding: 20,
                      boxShadow: "0 4px 15px rgba(0,0,0,0.02)",
                    }}
                  >
                    <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 800, color: "var(--text-success)", display: "flex", alignItems: "center", gap: 8 }}>
                      <span>🟢 Вышли на смену ({present.length})</span>
                    </h3>
                    {present.length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {present.map((emp) => (
                          <div
                            key={emp.id}
                            style={{
                              background: "rgba(16, 185, 129, 0.04)",
                              border: "1px solid rgba(16, 185, 129, 0.2)",
                              borderRadius: 12,
                              padding: 14,
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                              <span style={{ fontWeight: 700, fontSize: 13, color: "var(--text-main)" }}>{emp.name}</span>
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  padding: "2px 8px",
                                  borderRadius: 6,
                                  background: "rgba(16, 185, 129, 0.15)",
                                  color: "#059669",
                                  textTransform: "uppercase",
                                }}
                              >
                                {emp.role}
                              </span>
                            </div>
                            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                              {emp.shifts.map((shift, idx) => (
                                <div key={idx} style={{ marginTop: idx > 0 ? 4 : 0 }}>
                                  🕒 Вышел на смену в: <span style={{ fontWeight: 700, color: "var(--text-main)" }}>{formatTime(shift.dateFrom)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontStyle: "italic", color: "var(--text-muted)", padding: 20, textAlign: "center" }}>
                        Никто не вышел на смену.
                      </div>
                    )}
                  </div>

                  {/* Right: Absent / Not in shift */}
                  <div
                    style={{
                      background: "var(--bg-card)",
                      borderRadius: 16,
                      border: "1px solid var(--border-color)",
                      padding: 20,
                      boxShadow: "0 4px 15px rgba(0,0,0,0.02)",
                    }}
                  >
                    <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 800, color: "var(--text-muted)" }}>
                      ⚪ Отсутствуют сегодня ({absent.length})
                    </h3>
                    {absent.length > 0 ? (
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                          gap: 10,
                          maxHeight: 500,
                          overflowY: "auto",
                          paddingRight: 4,
                        }}
                      >
                        {absent.map((emp) => (
                          <div
                            key={emp.id}
                            style={{
                              background: "var(--bg-hover)",
                              border: "1px solid var(--border-color)",
                              borderRadius: 10,
                              padding: 10,
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <span style={{ fontWeight: 600, fontSize: 12, color: "var(--text-main)" }}>{emp.name}</span>
                            <span style={{ fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                              {emp.role}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontStyle: "italic", color: "var(--text-muted)", padding: 20, textAlign: "center" }}>
                        Все сотрудники вышли на смену!
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })() : (
            <div style={{ fontStyle: "italic", color: "var(--text-muted)", padding: 40, textAlign: "center" }}>
              Загрузка смен сотрудников...
            </div>
          )}
        </div>
      )}

      {/* Add Expense Modal */}
      {showAddExpenseModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: "var(--bg-card)",
              borderRadius: 16,
              border: "1px solid var(--border-color)",
              padding: 24,
              width: "100%",
              maxWidth: 400,
              boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
            }}
          >
            <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 800, color: "var(--text-main)" }}>
              📝 Внести новый расход
            </h3>
            <form onSubmit={handleAddExpense} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 4 }}>
                  Название расхода
                </label>
                <input
                  type="text"
                  required
                  placeholder="Например, Закупка хозтоваров"
                  value={expenseForm.name}
                  onChange={(e) => setExpenseForm({ ...expenseForm, name: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--border-color)",
                    fontSize: 13,
                    background: "var(--bg-card)",
                    color: "var(--text-main)",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 4 }}>
                  Сумма (UZS)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="Например, 150000"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--border-color)",
                    fontSize: 13,
                    background: "var(--bg-card)",
                    color: "var(--text-main)",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 4 }}>
                  Дата расхода
                </label>
                <input
                  type="date"
                  required
                  value={expenseForm.date}
                  onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--border-color)",
                    fontSize: 13,
                    background: "var(--bg-card)",
                    color: "var(--text-main)",
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setShowAddExpenseModal(false)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: "1px solid var(--border-color)",
                    background: "var(--bg-card)",
                    color: "var(--text-muted)",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: "none",
                    background: "#ef4444",
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Добавить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  TAX REPORT VIEW — Tax and 1C export report (sales / ingredients / writeoffs)
// ═══════════════════════════════════════════════════════════════
function TaxReportView({ showToast, loggedInUser }) {
  const [period, setPeriod] = useState("this_month");
  const [dates, setDates] = useState(() => {
    const now = new Date();
    const tzNow = new Date(now.getTime() + 5 * 60 * 60 * 1000);
    const format = (d) => d.toISOString().split("T")[0];
    const d1 = new Date(tzNow.getFullYear(), tzNow.getMonth(), 1, 12, 0, 0);
    return { from: format(d1), to: format(tzNow) };
  });
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState("sales");
  const [searchQuery, setSearchQuery] = useState("");

  const getDatesForPeriod = (periodType) => {
    const now = new Date();
    const tzNow = new Date(now.getTime() + 5 * 60 * 60 * 1000);
    const format = (d) => d.toISOString().split("T")[0];

    switch (periodType) {
      case "today":
        return { from: format(tzNow), to: format(tzNow) };
      case "yesterday": {
        const y = new Date(tzNow.getTime() - 24 * 60 * 60 * 1000);
        return { from: format(y), to: format(y) };
      }
      case "this_week": {
        const day = tzNow.getDay();
        const diff = tzNow.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(tzNow.getFullYear(), tzNow.getMonth(), diff, 12, 0, 0);
        return { from: format(monday), to: format(tzNow) };
      }
      case "last_week": {
        const day = tzNow.getDay();
        const diffToMonday = tzNow.getDate() - day + (day === 0 ? -6 : 1);
        const lastMonday = new Date(tzNow.getFullYear(), tzNow.getMonth(), diffToMonday - 7, 12, 0, 0);
        const lastSunday = new Date(tzNow.getFullYear(), tzNow.getMonth(), diffToMonday - 1, 12, 0, 0);
        return { from: format(lastMonday), to: format(lastSunday) };
      }
      case "last_10_days": {
        const d1 = new Date(tzNow.getTime() - 9 * 24 * 60 * 60 * 1000);
        return { from: format(d1), to: format(tzNow) };
      }
      case "this_month": {
        const d1 = new Date(tzNow.getFullYear(), tzNow.getMonth(), 1, 12, 0, 0);
        return { from: format(d1), to: format(tzNow) };
      }
      case "last_month": {
        const d1 = new Date(tzNow.getFullYear(), tzNow.getMonth() - 1, 1, 12, 0, 0);
        const d2 = new Date(tzNow.getFullYear(), tzNow.getMonth(), 0, 12, 0, 0);
        return { from: format(d1), to: format(d2) };
      }
      case "all_time": {
        const start = new Date(2020, 0, 1, 12, 0, 0);
        return { from: format(start), to: format(tzNow) };
      }
      default:
        return { from: "", to: "" };
    }
  };

  const loadReport = async (periodType, customFrom = "", customTo = "") => {
    let from = customFrom || dates.from;
    let to = customTo || dates.to;
    if (periodType !== "custom") {
      const pDates = getDatesForPeriod(periodType);
      from = pDates.from;
      to = pDates.to;
      setDates(pDates);
    }
    if (!from || !to) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/iiko/analytics/tax-report?from=${from}&to=${to}`, {
        headers: {
          "x-user-role": loggedInUser.role || ""
        }
      });
      const resData = await res.json();
      if (res.ok && resData.success) {
        setData(resData);
      } else {
        const err = resData?.error || "Ошибка при формировании отчета";
        setError(err);
        showToast(err, "error");
      }
    } catch (e) {
      setError("Ошибка сети при загрузке отчета");
      showToast("Ошибка сети при загрузке отчета", "error");
    } finally {
      setLoading(false);
    }
  };

  const handlePeriodChange = (pId) => {
    setPeriod(pId);
    if (pId !== "custom") {
      loadReport(pId);
    }
  };

  useEffect(() => {
    loadReport(period);
  }, []);

  const formatNumber = (num) => {
    if (num === null || num === undefined) return "0";
    return parseFloat(Number(num).toFixed(3)).toLocaleString("ru-RU");
  };

  const formatMoney = (amount) => {
    if (amount === null || amount === undefined) return "0 сум";
    return Math.round(amount).toLocaleString("ru-RU") + " сум";
  };

  const getFilteredData = () => {
    if (!data) return [];
    const query = searchQuery.trim().toLowerCase();
    
    if (activeSubTab === "sales") {
      const list = data.sales || [];
      if (!query) return list;
      return list.filter(item => 
        (item.name || "").toLowerCase().includes(query) ||
        (item.code || "").toLowerCase().includes(query)
      );
    } else if (activeSubTab === "ingredients") {
      const list = data.ingredients || [];
      if (!query) return list;
      return list.filter(item => 
        (item.name || "").toLowerCase().includes(query) ||
        (item.code || "").toLowerCase().includes(query)
      );
    } else if (activeSubTab === "writeoffs") {
      const list = data.writeoffs || [];
      if (!query) return list;
      return list.filter(item => 
        (item.productName || "").toLowerCase().includes(query) ||
        (item.code || "").toLowerCase().includes(query) ||
        (item.storeName || "").toLowerCase().includes(query) ||
        (item.accountName || "").toLowerCase().includes(query) ||
        (item.number || "").toLowerCase().includes(query)
      );
    }
    return [];
  };

  const handleExport = () => {
    const list = getFilteredData();
    if (!list || list.length === 0) {
      showToast("Нет данных для экспорта", "info");
      return;
    }

    let csvContent = "\ufeff";
    if (activeSubTab === "sales") {
      csvContent += "Артикул;Название блюда;Количество (шт)\n";
      list.forEach(item => {
        csvContent += `"${item.code || ""}";"${item.name || ""}";${item.quantity}\n`;
      });
    } else if (activeSubTab === "ingredients") {
      csvContent += "Артикул;Название ингредиента;Расход;Ед. изм.;Цена;Сумма (UZS)\n";
      list.forEach(item => {
        csvContent += `"${item.code || ""}";"${item.name || ""}";${String(item.quantity).replace(".", ",")};"${item.unit || "шт"}";${String(Math.round(item.price || 0)).replace(".", ",")};${Math.round(item.cost || 0)}\n`;
      });
    } else if (activeSubTab === "writeoffs") {
      csvContent += "Дата;Номер;Склад;Счет затрат;Артикул;Товар;Количество;Сумма (UZS)\n";
      list.forEach(item => {
        csvContent += `"${item.date || ""}";"${item.number || ""}";"${item.storeName || ""}";"${item.accountName || ""}";"${item.code || ""}";"${item.productName || ""}";${String(item.quantity).replace(".", ",")};${Math.round(item.cost)}\n`;
      });
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `tax_report_${activeSubTab}_${dates.from}_to_${dates.to}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Отчет успешно экспортирован", "success");
  };

  const filteredItems = getFilteredData();

  return (
    <div style={{ padding: "20px 24px", maxWidth: 1200, margin: "0 auto", paddingBottom: 100 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "var(--text-main)" }}>
            🧾 Налоговый отчет / Экспорт 1С
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.4 }}>
            Выгрузка реализации блюд, списания ингредиентов (рекурсивный расчет ТТК) и актов списаний для налогов и 1С.
          </p>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 24, background: "var(--bg-card)", padding: 16, borderRadius: 12, border: "1px solid var(--border-color)" }}>
        <PeriodDropdown
          period={period}
          setPeriod={setPeriod}
          onPeriodChange={handlePeriodChange}
          customLabel="Свой период"
        />

        {period === "custom" && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            <input
              type="date"
              value={dates.from}
              onChange={(e) => setDates({ ...dates, from: e.target.value })}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid var(--border-color)",
                background: "var(--bg-card)",
                color: "var(--text-main)",
                fontSize: 13,
                outline: "none"
              }}
            />
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>до</span>
            <input
              type="date"
              value={dates.to}
              onChange={(e) => setDates({ ...dates, to: e.target.value })}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid var(--border-color)",
                background: "var(--bg-card)",
                color: "var(--text-main)",
                fontSize: 13,
                outline: "none"
              }}
            />
            <button
              onClick={() => loadReport("custom", dates.from, dates.to)}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "none",
                background: "var(--color-primary)",
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                transition: "opacity 0.2s"
              }}
            >
              Сформировать
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 300, gap: 12 }}>
          <div className="spinner" style={{
            width: 32,
            height: 32,
            border: "3px solid var(--border-color)",
            borderTop: "3px solid var(--color-primary)",
            borderRadius: "50%",
            animation: "spin 1s linear infinite"
          }}></div>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Загрузка отчета и расчет ТТК...</span>
        </div>
      ) : error ? (
        <div style={{ background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.15)", borderRadius: 12, padding: 20, textAlign: "center", color: "#ef4444", fontSize: 14 }}>
          ⚠️ {error}
        </div>
      ) : data ? (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 4, background: "var(--bg-pill)", padding: 4, borderRadius: 10 }}>
              {[
                { id: "sales", label: "🍔 Реализация" },
                { id: "ingredients", label: "🌾 Расход сырья" },
                { id: "writeoffs", label: "🗑️ Списания" }
              ].map(sub => (
                <button
                  key={sub.id}
                  onClick={() => setActiveSubTab(sub.id)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: "none",
                    background: activeSubTab === sub.id ? "var(--bg-card)" : "transparent",
                    color: activeSubTab === sub.id ? "var(--text-main)" : "var(--text-muted)",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    boxShadow: activeSubTab === sub.id ? "0 2px 8px rgba(0,0,0,0.05)" : "none",
                    transition: "all 0.2s"
                  }}
                >
                  {sub.label}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8, flex: 1, justifyContent: "flex-end", minWidth: 280 }}>
              <input
                type="text"
                placeholder="Поиск по названию или коду..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-card)",
                  color: "var(--text-main)",
                  fontSize: 13,
                  width: "100%",
                  maxWidth: 240,
                  outline: "none"
                }}
              />
              <button
                onClick={handleExport}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-card)",
                  color: "var(--text-main)",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6
                }}
              >
                📥 Экспорт CSV
              </button>
            </div>
          </div>

          <div style={{ background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border-color)", overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "var(--bg-pill)", borderBottom: "1px solid var(--border-color)" }}>
                    <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text-muted)", width: 50 }}>№</th>
                    {activeSubTab === "sales" && (
                      <>
                        <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text-muted)", width: 120 }}>Код</th>
                        <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text-muted)" }}>Название блюда</th>
                        <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text-muted)", width: 120, textAlign: "right" }}>Кол-во</th>
                      </>
                    )}
                    {activeSubTab === "ingredients" && (
                      <>
                        <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text-muted)", width: 120 }}>Код</th>
                        <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text-muted)" }}>Название ингредиента</th>
                        <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text-muted)", width: 120, textAlign: "right" }}>Расход</th>
                        <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text-muted)", width: 100 }}>Ед. изм.</th>
                        <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text-muted)", width: 140, textAlign: "right" }}>Сумма</th>
                      </>
                    )}
                    {activeSubTab === "writeoffs" && (
                      <>
                        <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text-muted)", width: 100 }}>Дата</th>
                        <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text-muted)", width: 100 }}>Акт</th>
                        <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text-muted)", width: 140 }}>Склад</th>
                        <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text-muted)", width: 140 }}>Счет затрат</th>
                        <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text-muted)", width: 100 }}>Код</th>
                        <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text-muted)" }}>Товар</th>
                        <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text-muted)", width: 100, textAlign: "right" }}>Кол-во</th>
                        <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text-muted)", width: 120, textAlign: "right" }}>Сумма</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={10} style={{ padding: "40px 16px", textAlign: "center", color: "var(--text-muted)", fontStyle: "italic" }}>
                        Данные не найдены
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item, idx) => (
                      <tr
                        key={idx}
                        style={{
                          borderBottom: "1px solid var(--border-color)",
                          background: idx % 2 === 1 ? "var(--bg-pill)" : "transparent"
                        }}
                      >
                        <td style={{ padding: "12px 16px", color: "var(--text-muted)" }}>{idx + 1}</td>
                        {activeSubTab === "sales" && (
                          <>
                            <td style={{ padding: "12px 16px", fontFamily: "monospace" }}>{item.code || "—"}</td>
                            <td style={{ padding: "12px 16px", fontWeight: 600 }}>{item.name}</td>
                            <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 700 }}>{item.quantity} шт</td>
                          </>
                        )}
                        {activeSubTab === "ingredients" && (
                          <>
                            <td style={{ padding: "12px 16px", fontFamily: "monospace" }}>{item.code || "—"}</td>
                            <td style={{ padding: "12px 16px", fontWeight: 600 }}>{item.name}</td>
                            <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 700 }}>{formatNumber(item.quantity)}</td>
                            <td style={{ padding: "12px 16px", color: "var(--text-muted)" }}>{item.unit || "шт"}</td>
                            <td style={{ padding: "12px 16px", textAlign: "right", color: "var(--text-main)", fontWeight: 700 }}>{formatMoney(item.cost)}</td>
                          </>
                        )}
                        {activeSubTab === "writeoffs" && (
                          <>
                            <td style={{ padding: "12px 16px" }}>{item.date}</td>
                            <td style={{ padding: "12px 16px", fontWeight: 500 }}>{item.number}</td>
                            <td style={{ padding: "12px 16px", color: "var(--text-muted)" }}>{item.storeName}</td>
                            <td style={{ padding: "12px 16px", color: "var(--text-muted)" }}>{item.accountName}</td>
                            <td style={{ padding: "12px 16px", fontFamily: "monospace" }}>{item.code || "—"}</td>
                            <td style={{ padding: "12px 16px", fontWeight: 600 }}>{item.productName}</td>
                            <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 700 }}>{formatNumber(item.quantity)}</td>
                            <td style={{ padding: "12px 16px", textAlign: "right", color: "#ef4444", fontWeight: 700 }}>{formatMoney(item.cost)}</td>
                          </>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, padding: "60px 20px", textAlign: "center", color: "var(--text-muted)" }}>
          🗓️ Выберите период и нажмите кнопку «Сформировать»
        </div>
      )}
    </div>
  );
}
