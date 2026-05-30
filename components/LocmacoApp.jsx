"use client";
import { useState, useEffect, useRef } from "react";

const FALLBACK_SUPPLIERS = [
  { id: "16c6e655-945c-4002-a117-934749aea133", name: "КПК" },
  {
    id: "3bdcfdbb-e66c-4b16-9025-03dedb7905fa",
    name: "Наличка без поставщика",
  },
];

const FALLBACK_STORES = [
  { id: "1239d270-1bbe-f64f-b7ea-5f00518ef508", name: "Основной склад" },
  { id: "6be6e519-c4d8-4461-9333-7810062486ed", name: "Кухня" },
  { id: "c1a132f0-5a33-4f0b-a47b-5b6d8f381c9f", name: "Бар" },
  { id: "6da08473-087b-4efb-ad9e-ba14e8999fae", name: "Мойка" },
  { id: "0cf0f2c5-891c-412c-8ab7-7b2bacdd2b01", name: "Посуда" },
  { id: "9101f69e-ab51-44b6-8c1a-f80e84d8eec3", name: "Хоз товары" },
];

const STORE_ICONS = {
  "1239d270-1bbe-f64f-b7ea-5f00518ef508": "🏭",
  "6be6e519-c4d8-4461-9333-7810062486ed": "👨‍🍳",
  "c1a132f0-5a33-4f0b-a47b-5b6d8f381c9f": "🍸",
  "6da08473-087b-4efb-ad9e-ba14e8999fae": "🧹",
  "0cf0f2c5-891c-412c-8ab7-7b2bacdd2b01": "🍽",
  "9101f69e-ab51-44b6-8c1a-f80e84d8eec3": "🧰",
};

const API = {
  async get(ep) {
    try {
      const r = await fetch(`/api/iiko${ep}`);
      if (!r.ok) throw new Error(`${r.status}`);
      return await r.json();
    } catch (e) {
      console.error(`API GET ${ep}:`, e);
      return null;
    }
  },
  async post(ep, body) {
    try {
      const r = await fetch(`/api/iiko${ep}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(`${r.status}`);
      return await r.json();
    } catch (e) {
      console.error(`API POST ${ep}:`, e);
      return null;
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
  createInvoice(data) {
    return this.post("/invoice", data);
  },
  createTransfer(data) {
    return this.post("/transfer", data);
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
  login(code) {
    return this.post("/login", { code });
  },
};

const fmt = (n) => new Intl.NumberFormat("ru-RU").format(Math.round(n));
const fmtPrice = (n) => fmt(n) + " сум";

const I = {
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
};

export default function LocmacoApp() {
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [loginCode, setLoginCode] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [tab, setTab] = useState("menu");
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState(FALLBACK_SUPPLIERS);
  const [stores, setStores] = useState(FALLBACK_STORES);
  const [productsLoading, setProductsLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Check localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("user");
    if (saved) {
      try {
        setLoggedInUser(JSON.parse(saved));
      } catch (e) {
        localStorage.removeItem("user");
      }
    }
  }, []);

  const loadData = async () => {
    setProductsLoading(true);
    const [p, sup, st] = await Promise.all([
      API.getProducts(),
      API.getSuppliers(),
      API.getStores(),
    ]);
    if (p && Array.isArray(p) && p.length > 0) setProducts(p);
    if (sup && Array.isArray(sup) && sup.length > 0) setSuppliers(sup);
    if (st && Array.isArray(st) && st.length > 0) setStores(st);
    setProductsLoading(false);
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    const res = await API.getHistory();
    if (res && res.success && Array.isArray(res.history)) {
      setHistory(res.history);
    }
    setHistoryLoading(false);
  };

  useEffect(() => {
    if (loggedInUser) {
      loadData();
      loadHistory();
    }
  }, [loggedInUser]);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const tabs = [
    { id: "incoming", label: "Приход", icon: I.inbox },
    { id: "transfer", label: "Перемещение", icon: I.transfer },
    { id: "inventory", label: "Инвентаризация", icon: I.inventory },
    { id: "cash", label: "Касса", icon: I.cash },
  ];

  const ROLE_NAMES = {
    admin: "Админ",
    director: "Руководитель",
    supplier: "Снабженец",
    kitchen: "Шеф-повар",
    bar: "Бармен",
  };

  if (!loggedInUser) {
    const handleLogin = async (e) => {
      if (e) e.preventDefault();
      if (loginCode.length < 4) {
        setLoginError("Введите 4-значный код");
        return;
      }
      setLoginLoading(true);
      setLoginError("");
      const res = await API.login(loginCode);
      setLoginLoading(false);
      if (res && res.success && res.user) {
        setLoggedInUser(res.user);
        localStorage.setItem("user", JSON.stringify(res.user));
      } else {
        setLoginError(res?.error || "Неверный код доступа");
      }
    };

    const pressPin = (num) => {
      setLoginError("");
      if (loginCode.length < 4) {
        setLoginCode(prev => prev + num);
      }
    };

    const deletePin = () => {
      setLoginError("");
      setLoginCode(prev => prev.slice(0, -1));
    };

    const pinBtn = {
      background: "rgba(255, 255, 255, 0.05)",
      border: "1px solid rgba(255, 255, 255, 0.1)",
      borderRadius: 16,
      height: 55,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 20,
      fontWeight: 700,
      color: "#fff",
      cursor: "pointer",
      transition: "all 0.15s ease",
      outline: "none",
    };

    return (
      <div
        style={{
          fontFamily: "'DM Sans','Segoe UI',system-ui,sans-serif",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)",
          color: "#fff",
          padding: "20px",
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
          .pin-btn:active {
            transform: scale(0.95);
            background: rgba(255, 255, 255, 0.2) !important;
          }
          .pin-btn:hover {
            background: rgba(255, 255, 255, 0.1) !important;
            border-color: rgba(255, 255, 255, 0.2) !important;
          }
        `}</style>

        <div
          style={{
            maxWidth: 400,
            width: "100%",
            background: "rgba(30, 41, 59, 0.7)",
            backdropFilter: "blur(16px)",
            borderRadius: 24,
            border: "1px solid rgba(255, 255, 255, 0.1)",
            padding: "40px 30px",
            boxShadow: "0 20px 40px rgba(0, 0, 0, 0.4)",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: 18,
              background: "linear-gradient(135deg,#22d3ee,#818cf8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: 24,
              color: "#fff",
              margin: "0 auto 20px",
              boxShadow: "0 8px 16px rgba(129, 140, 248, 0.3)",
            }}
          >
            L
          </div>
          <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px" }}>
            The Lokmaco
          </h2>
          <p style={{ margin: "0 0 32px", fontSize: 13, color: "#94a3b8" }}>
            Введите 4-значный пин-код доступа
          </p>

          <form onSubmit={handleLogin}>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: 16,
                marginBottom: 32,
              }}
            >
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: 14,
                    border: loginCode[i]
                      ? "2px solid #818cf8"
                      : "2px solid rgba(255,255,255,0.15)",
                    background: loginCode[i] ? "rgba(129, 140, 248, 0.15)" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 24,
                    fontWeight: 700,
                    color: "#fff",
                    transition: "all 0.15s ease",
                  }}
                >
                  {loginCode[i] ? "•" : ""}
                </div>
              ))}
            </div>

            {loginError && (
              <div
                style={{
                  color: "#f87171",
                  fontSize: 13,
                  fontWeight: 500,
                  marginBottom: 20,
                  animation: "shake 0.3s ease",
                }}
              >
                ⚠️ {loginError}
              </div>
            )}

            {/* Premium PIN Pad */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 16,
                maxWidth: 280,
                margin: "0 auto 30px",
              }}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => pressPin(num)}
                  className="pin-btn"
                  style={pinBtn}
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={deletePin}
                className="pin-btn"
                style={{ ...pinBtn, fontSize: 14, fontWeight: 500, color: "#94a3b8" }}
              >
                Стереть
              </button>
              <button
                type="button"
                onClick={() => pressPin(0)}
                className="pin-btn"
                style={pinBtn}
              >
                0
              </button>
              <button
                type="submit"
                disabled={loginLoading}
                className="pin-btn"
                style={{
                  ...pinBtn,
                  background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 700,
                  border: "none",
                  boxShadow: "0 4px 12px rgba(99, 102, 241, 0.2)",
                }}
              >
                {loginLoading ? I.loader : "Войти"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        fontFamily: "'DM Sans','Segoe UI',system-ui,sans-serif",
        minHeight: "100vh",
        background: "#f5f7fa",
        color: "#0f1729",
      }}
    >
      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeUp { from { opacity: 0; transform: translate(-50%, 10px); } to { opacity: 1; transform: translate(-50%, 0); } }
        @media (max-width: 767px) {
          .desktop-nav {
            display: none !important;
          }
        }
        .dashboard-card {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        .dashboard-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 16px 30px rgba(0, 0, 0, 0.15) !important;
          filter: brightness(1.05);
        }
        .dashboard-card:active {
          transform: translateY(0);
        }
      `}</style>

      <header
        style={{
          background: "#0f1729",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div
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
                background: "linear-gradient(135deg,#22d3ee,#818cf8)",
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
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>
                The Lokmaco
              </div>
              <div
                style={{
                  color: "#64748b",
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
            <div style={{ textAlign: "right" }}>
              <div style={{ color: "#fff", fontWeight: 600, fontSize: 13 }}>
                {loggedInUser.name}
              </div>
              <div style={{ color: "#64748b", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
                {ROLE_NAMES[loggedInUser.role] || loggedInUser.role}
              </div>
            </div>
            <button
              onClick={() => {
                localStorage.removeItem("user");
                setLoggedInUser(null);
              }}
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
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
              </svg>
            </button>
          </div>
        </div>
      </header>

      <nav
        className="desktop-nav"
        style={{
          background: "#fff",
          borderBottom: "1px solid #e5e8ee",
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
          {tabs.map((t) => (
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
                color: tab === t.id ? "#6366f1" : "#64748b",
                borderBottom:
                  tab === t.id ? "2px solid #6366f1" : "2px solid transparent",
              }}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {tab !== "menu" && (
        <div style={{ maxWidth: 1120, margin: "16px auto 0", padding: "0 20px" }}>
          <button
            onClick={() => setTab("menu")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 18px",
              borderRadius: 12,
              background: "#fff",
              border: "1px solid #e2e8f0",
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
        style={{ maxWidth: 1120, margin: "0 auto", padding: "20px 20px 100px" }}
      >
        {tab === "menu" && (
          <div style={{ animation: "fadeIn .25s ease" }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1e293b", marginBottom: 24, letterSpacing: "-0.5px" }}>
              Выберите операцию
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
              <button
                onClick={() => setTab("incoming")}
                style={{
                  textAlign: "left",
                  padding: 24,
                  borderRadius: 20,
                  border: "none",
                  background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                  color: "#fff",
                  cursor: "pointer",
                  boxShadow: "0 10px 25px rgba(99, 102, 241, 0.25)",
                  outline: "none",
                }}
                className="dashboard-card"
              >
                <div style={{ fontSize: 32, marginBottom: 12 }}>📥</div>
                <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Приход накладных</div>
                <div style={{ fontSize: 13, opacity: 0.8 }}>Оформление новых поставок товаров в iiko</div>
              </button>

              <button
                onClick={() => setTab("transfer")}
                style={{
                  textAlign: "left",
                  padding: 24,
                  borderRadius: 20,
                  border: "none",
                  background: "linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)",
                  color: "#fff",
                  cursor: "pointer",
                  boxShadow: "0 10px 25px rgba(6, 182, 212, 0.25)",
                  outline: "none",
                }}
                className="dashboard-card"
              >
                <div style={{ fontSize: 32, marginBottom: 12 }}>🔁</div>
                <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Перемещение</div>
                <div style={{ fontSize: 13, opacity: 0.8 }}>Внутреннее перемещение продуктов между складами</div>
              </button>

              <button
                onClick={() => setTab("inventory")}
                style={{
                  textAlign: "left",
                  padding: 24,
                  borderRadius: 20,
                  border: "none",
                  background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                  color: "#fff",
                  cursor: "pointer",
                  boxShadow: "0 10px 25px rgba(124, 58, 237, 0.25)",
                  outline: "none",
                }}
                className="dashboard-card"
              >
                <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
                <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Инвентаризация</div>
                <div style={{ fontSize: 13, opacity: 0.8 }}>Фактический пересчет остатков с автосохранением</div>
              </button>

              <button
                onClick={() => setTab("cash")}
                style={{
                  textAlign: "left",
                  padding: 24,
                  borderRadius: 20,
                  border: "none",
                  background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  color: "#fff",
                  cursor: "pointer",
                  boxShadow: "0 10px 25px rgba(16, 185, 129, 0.25)",
                  outline: "none",
                }}
                className="dashboard-card"
              >
                <div style={{ fontSize: 32, marginBottom: 12 }}>💵</div>
                <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Сдать кассу</div>
                <div style={{ fontSize: 13, opacity: 0.8 }}>Отчет кассовой смены и расходов для руководства</div>
              </button>
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
        {tab === "cash" && (
          <CashView
            showToast={showToast}
            loggedInUser={loggedInUser}
            loadHistory={loadHistory}
            history={history.filter((h) => h.action_type === "cash")}
            historyLoading={historyLoading}
          />
        )}
      </main>

      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 20,
            left: "50%",
            transform: "translateX(-50%)",
            background: toast.type === "error" ? "#ef4444" : "#1e293b",
            color: "#fff",
            padding: "10px 22px",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 500,
            boxShadow: "0 6px 20px rgba(0,0,0,0.2)",
            zIndex: 300,
            animation: "fadeUp .2s ease",
          }}
        >
          {toast.msg}
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
    setItems((prev) => {
      if (prev.find((i) => i.product_id === p.id)) return prev;
      return [
        ...prev,
        {
          product_id: p.id,
          product_name: p.name,
          quantity: "",
          unit: p.mainUnit || "шт",
          totalPrice: "",
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
        name: loggedInUser.name
      }
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
        <HistoryList
          history={history}
          loading={historyLoading}
          onRefresh={loadHistory}
          emptyText="История приходов пуста"
        />
      )}
      {mode === "new" && (
        <div
          style={{
            background: "#fff",
            borderRadius: 14,
            border: "1px solid #e8ecf0",
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
                        border: "1px solid #e8ecf0",
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
                                <div style={{ fontSize: 10, color: "#94a3b8" }}>
                                  {it.unit}
                                </div>
                              </td>
                              <td style={{ ...td, textAlign: "center" }}>
                                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
                                  <input
                                    type="number"
                                    value={it.quantity}
                                    onChange={(e) =>
                                      updateItem(idx, "quantity", it.unit === "шт" ? e.target.value.split(".")[0].split(",")[0] : e.target.value)
                                    }
                                    placeholder="0"
                                    style={numInput}
                                  />
                                  <span style={{ fontSize: 12, color: "#64748b", minWidth: 24, textAlign: "left", fontWeight: 600 }}>
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
                  {items.length > 0 && grandTotal > 0 && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        fontSize: 16,
                        fontWeight: 800,
                        margin: "12px 0",
                      }}
                    >
                      Итого: {fmtPrice(grandTotal)}
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
//  TRANSFER — откуда → куда → товары (поиск + кол-во) → провести
// ═══════════════════════════════════════════════════════════════

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
        name: loggedInUser.name
      }
    });
    setSubmitting(false);
    if (result?.success) {
      showToast("Перемещение проведено!");
      loadHistory();
      setMode("idle");
      setStep(0);
      setItems([]);
      setForm({ fromId: "", fromName: "", toId: "", toName: "", comment: "" });
    } else showToast("Ошибка перемещения", "error");
  };

  const availableTo = stores.filter((s) => s.id !== form.fromId);

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
        <HistoryList
          history={history}
          loading={historyLoading}
          onRefresh={loadHistory}
          emptyText="История перемещений пуста"
        />
      )}
      {mode === "new" && (
        <div
          style={{
            background: "#fff",
            borderRadius: 14,
            border: "1px solid #e8ecf0",
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
                        border: "1px solid #e8ecf0",
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
                                <div style={{ fontSize: 10, color: "#94a3b8" }}>
                                  {it.unit}
                                </div>
                              </td>
                              <td style={{ ...td, textAlign: "center" }}>
                                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
                                  <input
                                    type="number"
                                    value={it.quantity}
                                    onChange={(e) =>
                                      updateItem(idx, "quantity", it.unit === "шт" ? e.target.value.split(".")[0].split(",")[0] : e.target.value)
                                    }
                                    placeholder="0"
                                    style={numInput}
                                  />
                                  <span style={{ fontSize: 12, color: "#64748b", minWidth: 24, textAlign: "left", fontWeight: 600 }}>
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
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    storeId: "",
    storeName: "",
    comment: "",
  });
  const [items, setItems] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);

  // Load draft when store is selected
  useEffect(() => {
    if (form.storeId) {
      const saved = localStorage.getItem("locmaco_inventory_draft_" + form.storeId);
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
        } catch (e) {
          setItems([]);
        }
      } else {
        setItems([]);
      }
    } else {
      setItems([]);
    }
  }, [form.storeId]);

  // Save draft on items change
  useEffect(() => {
    if (form.storeId) {
      if (items.length > 0) {
        localStorage.setItem("locmaco_inventory_draft_" + form.storeId, JSON.stringify(items));
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
      },
    });
    setSubmitting(false);
    if (result?.success) {
      showToast("Инвентаризация проведена!");
      localStorage.removeItem("locmaco_inventory_draft_" + form.storeId);
      loadHistory();
      setMode("idle");
      setStep(0);
      setItems([]);
      setForm({ storeId: "", storeName: "", comment: "" });
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
              setStep(0);
            }}
          >
            {I.plus} Пересчет
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
        <HistoryList
          history={history}
          loading={historyLoading}
          onRefresh={loadHistory}
          emptyText="История инвентаризаций пуста"
        />
      )}
      {mode === "new" && (
        <div
          style={{
            background: "#fff",
            borderRadius: 14,
            border: "1px solid #e8ecf0",
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
                <span>🏢 Склад: <b>{form.storeName}</b></span>
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
                    color: "#166534",
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
                        border: "1px solid #e8ecf0",
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
                                <div style={{ fontSize: 10, color: "#94a3b8" }}>
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
                                      updateItem(idx, "quantity", it.unit === "шт" ? e.target.value.split(".")[0].split(",")[0] : e.target.value)
                                    }
                                    placeholder="0"
                                    style={numInput}
                                  />
                                  <span
                                    style={{
                                      fontSize: 12,
                                      color: "#64748b",
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
  const [submitting, setSubmitting] = useState(false);

  const handleFieldChange = (field, val) => {
    setForm((p) => ({ ...p, [field]: val }));
  };

  const addExpense = () => {
    setExpenses((p) => [...p, { id: Date.now(), name: "", amount: "" }]);
  };

  const updateExpense = (id, field, value) => {
    setExpenses((p) => p.map((exp) => (exp.id === id ? { ...exp, [field]: value } : exp)));
  };

  const removeExpense = (id) => {
    setExpenses((p) => p.filter((exp) => exp.id !== id));
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    const hasValues = Object.values(form).some((v) => v !== "") || expenses.length > 0;
    if (!hasValues) {
      showToast("Заполните хотя бы одно поле", "error");
      return;
    }
    setSubmitting(true);
    const result = await API.createCash({
      date: form.date,
      payments: {
        cash: form.cash,
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
      surplus: form.surplus,
      shortage: form.shortage,
      comment: form.comment,
      user: {
        tg_id: loggedInUser.tg_id,
        name: loggedInUser.name,
      },
    });
    setSubmitting(false);
    if (result?.success) {
      showToast("Отчет кассы сохранен!");
      setForm({
        date: getTodayTashkent(),
        cash: "",
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
      loadHistory();
    } else {
      showToast("Ошибка сохранения", "error");
    }
  };

  const totalSales =
    (parseFloat(form.cash) || 0) +
    (parseFloat(form.uzcard) || 0) +
    (parseFloat(form.humo) || 0) +
    (parseFloat(form.online) || 0) +
    (parseFloat(form.rahmat) || 0) +
    (parseFloat(form.uzum) || 0) +
    (parseFloat(form.yandex) || 0);

  const totalExpenses = expenses.reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);

  const isManager = loggedInUser.role === "admin" || loggedInUser.role === "director";

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
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Отчет кассы</h2>
      </div>

      <div
        style={{
          background: "#fff",
          borderRadius: 14,
          border: "1px solid #e8ecf0",
          padding: 24,
          marginBottom: 24,
        }}
      >
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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

          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#475569" }}>
            💵 Выручка по типам оплат
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 16 }}>
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
              background: "#f8fafc",
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
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#475569" }}>
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
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {expenses.map((exp) => (
                  <div key={exp.id} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <input
                      value={exp.name}
                      onChange={(e) => updateExpense(exp.id, "name", e.target.value)}
                      placeholder="Название (например: лимоны, хозтовары)"
                      style={{ ...inp, flex: 2 }}
                    />
                    <input
                      type="number"
                      value={exp.amount}
                      onChange={(e) => updateExpense(exp.id, "amount", e.target.value)}
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
                    color: "#991b1b",
                    fontSize: 13,
                    marginTop: 4,
                  }}
                >
                  <span>Всего расходов:</span>
                  <span>{fmtPrice(totalExpenses)}</span>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "#94a3b8", fontStyle: "italic" }}>
                Расходов по смене не зафиксировано
              </div>
            )}
          </div>

          <div style={{ borderTop: "1px dashed #e2e8f0", paddingTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={{ ...lbl, color: "#166534" }}>Излишки (сум)</label>
              <input
                type="number"
                value={form.surplus}
                onChange={(e) => handleFieldChange("surplus", e.target.value)}
                placeholder="0"
                style={{ ...inp, borderColor: "#bbf7d0" }}
              />
            </div>
            <div>
              <label style={{ ...lbl, color: "#991b1b" }}>Недостача (сум)</label>
              <input
                type="number"
                value={form.shortage}
                onChange={(e) => handleFieldChange("shortage", e.target.value)}
                placeholder="0"
                style={{ ...inp, borderColor: "#fca5a5" }}
              />
            </div>
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
              {submitting ? I.loader : I.send} {submitting ? "Сдача..." : "Сдать кассу"}
            </Btn>
          </div>
        </form>
      </div>

      {isManager ? (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700, color: "#475569" }}>
            📊 Сводная таблица расхождений (Админ)
          </h3>
          {historyLoading && history.length === 0 ? (
            <LoadingBlock text="Загрузка сводной таблицы..." />
          ) : history.length === 0 ? (
            <div style={{ textAlign: "center", padding: 20, color: "#94a3b8", fontSize: 13 }}>Сводная таблица пуста</div>
          ) : (
            <div style={{ overflowX: "auto", background: "#fff", borderRadius: 12, border: "1px solid #e8ecf0", marginBottom: 24 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#f8fafb" }}>
                    <th style={th}>Дата</th>
                    <th style={th}>Кассир</th>
                    <th style={{ ...th, textAlign: "right" }}>Сумма кассира</th>
                    <th style={{ ...th, textAlign: "right" }}>Сумма из iiko</th>
                    <th style={{ ...th, textAlign: "right" }}>Расхождение</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((act) => {
                    const det = act.details || {};
                    const repCash = det.total_sales || ((det.cash || 0) + (det.card || 0) + (det.online || 0));
                    const diff = det.difference || 0;
                    const iiko = det.iiko_cash || (repCash - diff);
                    const hasDiscrepancy = Math.abs(diff) > 0;
                    let dateStr = "";
                    if (det.selected_date) {
                      const parts = det.selected_date.split("-");
                      if (parts.length === 3) {
                        dateStr = `${parts[2]}.${parts[1]}.${parts[0]}`;
                      } else {
                        dateStr = det.selected_date;
                      }
                    } else {
                      dateStr = new Date(act.created_at).toLocaleDateString("ru-RU", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                    }

                    return (
                      <tr key={act.id} style={{ borderTop: "1px solid #f0f2f5" }}>
                        <td style={td}>{dateStr}</td>
                        <td style={{ ...td, fontWeight: 600 }}>{act.user_name}</td>
                        <td style={{ ...td, textAlign: "right", fontWeight: 500 }}>{fmtPrice(repCash)}</td>
                        <td style={{ ...td, textAlign: "right" }}>{fmtPrice(iiko)}</td>
                        <td
                          style={{
                            ...td,
                            textAlign: "right",
                            fontWeight: 700,
                            color: diff < 0 ? "#991b1b" : diff > 0 ? "#166534" : "#475569",
                            background: hasDiscrepancy ? (diff < 0 ? "#fef2f2" : "#f0fdf4") : "transparent",
                          }}
                        >
                          {diff > 0 ? "+" : ""}{fmtPrice(diff)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <HistoryList
            history={history}
            loading={historyLoading}
            onRefresh={loadHistory}
            emptyText="История отчетов кассы пуста"
          />
        </div>
      ) : (
        <div
          style={{
            background: "#f8fafc",
            border: "1px dashed #e2e8f0",
            borderRadius: 12,
            padding: 20,
            textAlign: "center",
            color: "#64748b",
            fontSize: 13,
          }}
        >
          🔒 Просмотр истории отчетов доступен только Администраторам и Руководителям.
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
  return (
    <div ref={ref} style={{ position: "relative", marginBottom: 4 }}>
      <div style={{ position: "relative" }}>
        <span
          style={{
            position: "absolute",
            left: 12,
            top: "50%",
            transform: "translateY(-50%)",
            color: "#94a3b8",
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
            padding: "11px 14px 11px 40px",
            borderRadius: 10,
            border: "1px solid #e2e8f0",
            fontSize: 14,
            outline: "none",
            background: "#fff",
          }}
        />
      </div>
      {focused && q.length >= 1 && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: "#fff",
            borderRadius: 10,
            border: "1px solid #e2e8f0",
            boxShadow: "0 6px 20px rgba(0,0,0,0.08)",
            zIndex: 50,
            maxHeight: 260,
            overflow: "auto",
          }}
        >
          {filtered.length === 0 && (
            <div
              style={{
                padding: 16,
                textAlign: "center",
                fontSize: 13,
                color: "#94a3b8",
              }}
            >
              Не найдено
            </div>
          )}
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                onSelect(p);
                setQ("");
                setFocused(false);
              }}
              style={{
                width: "100%",
                padding: "10px 14px",
                border: "none",
                borderTop: "1px solid #f5f7f9",
                background: "#fff",
                cursor: "pointer",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: 13,
                textAlign: "left",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "#f8f7ff")
              }
              onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
            >
              <span style={{ fontWeight: 500 }}>{p.name}</span>
              <span style={{ color: "#94a3b8", fontSize: 11 }}>
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
      style={{ textAlign: "center", padding: "40px 20px", color: "#94a3b8" }}
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
      style={{ textAlign: "center", padding: "40px 20px", color: "#94a3b8" }}
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
            border: "1px solid #e2e8f0",
            background: "#fff",
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
      style={{ textAlign: "center", padding: "50px 20px", color: "#94a3b8" }}
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

function HistoryList({ history, loading, onRefresh, emptyText }) {
  if (loading && history.length === 0) {
    return <LoadingBlock text="Загрузка истории..." />;
  }

  if (history.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "40px 20px" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>📜</div>
        <div style={{ fontWeight: 600, color: "#64748b" }}>{emptyText || "История действий пуста"}</div>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
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
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#475569" }}>
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
          const details = act.details || {};
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

          return (
            <div
              key={act.id}
              style={{
                background: "#fff",
                borderRadius: 14,
                border: "1px solid #e8ecf0",
                padding: 18,
                boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  borderBottom: "1px dashed #e8ecf0",
                  paddingBottom: 12,
                  marginBottom: 12,
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
                          : "#e0e7ff",
                        color: isInvoice
                          ? "#059669"
                          : isInventory
                          ? "#7c3aed"
                          : isCash
                          ? "#166534"
                          : "#4f46e5",
                      }}
                    >
                      {isInvoice
                        ? "Приход"
                        : isInventory
                        ? "Инвентаризация"
                        : isCash
                        ? "Отчет кассы"
                        : "Перемещение"}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>
                      {act.document_number || "Без номера"}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                    👤 Выполнил: <b style={{ color: "#475569" }}>{act.user_name || "Неизвестный"}</b> (через {(act.document_number && String(act.document_number).startsWith("TG-")) ? "ТГ-Бот" : "Сайт"})
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>
                  {formattedDate}
                </div>
              </div>

              <div style={{ fontSize: 12 }}>
                {isCash ? (
                  <div>
                    <div style={{ background: "#f8fafc", borderRadius: 8, padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "#64748b" }}>💵 Наличные:</span>
                        <span style={{ fontWeight: 600 }}>{fmtPrice(details.payments?.cash || details.cash || 0)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "#64748b" }}>💳 Uzcard:</span>
                        <span style={{ fontWeight: 600 }}>{fmtPrice(details.payments?.uzcard || 0)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "#64748b" }}>💳 Humo:</span>
                        <span style={{ fontWeight: 600 }}>{fmtPrice(details.payments?.humo || 0)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "#64748b" }}>📱 Click / Payme:</span>
                        <span style={{ fontWeight: 600 }}>{fmtPrice(details.payments?.online || details.online || 0)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "#64748b" }}>💳 RAHMAT:</span>
                        <span style={{ fontWeight: 600 }}>{fmtPrice(details.payments?.rahmat || 0)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "#64748b" }}>💳 Uzum:</span>
                        <span style={{ fontWeight: 600 }}>{fmtPrice(details.payments?.uzum || 0)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "#64748b" }}>🛵 Яндекс Еда:</span>
                        <span style={{ fontWeight: 600 }}>{fmtPrice(details.payments?.yandex || 0)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px dashed #e2e8f0", paddingTop: 6, fontWeight: 700 }}>
                        <span>💰 Итого выручка:</span>
                        <span>{fmtPrice(details.total_sales || ((details.cash || 0) + (details.card || 0) + (details.online || 0)))}</span>
                      </div>
                      {details.expenses?.length > 0 && (
                        <div style={{ borderTop: "1px dashed #e2e8f0", paddingTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                          <span style={{ color: "#64748b", fontWeight: 700, fontSize: 11 }}>💸 Расходы из кассы:</span>
                          {details.expenses.map((exp, idx) => (
                            <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, paddingLeft: 8 }}>
                              <span>• {exp.name}:</span>
                              <span style={{ fontWeight: 600 }}>{fmtPrice(exp.amount)}</span>
                            </div>
                          ))}
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, paddingLeft: 8 }}>
                            <span>Сумма расходов:</span>
                            <span>{fmtPrice(details.total_expenses || 0)}</span>
                          </div>
                        </div>
                      )}
                      {(details.surplus > 0 || details.shortage > 0) && (
                        <div style={{ borderTop: "1px dashed #e2e8f0", paddingTop: 6, marginTop: 4, display: "flex", flexDirection: "column", gap: 6 }}>
                          {details.surplus > 0 && (
                            <div style={{ display: "flex", justifyContent: "space-between", color: "#166534" }}>
                              <span>🟢 Излишки:</span>
                              <span style={{ fontWeight: 700 }}>+{fmtPrice(details.surplus)}</span>
                            </div>
                          )}
                          {details.shortage > 0 && (
                            <div style={{ display: "flex", justifyContent: "space-between", color: "#991b1b" }}>
                              <span>🔴 Недостача:</span>
                              <span style={{ fontWeight: 700 }}>-{fmtPrice(details.shortage)}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ marginBottom: 8, color: "#475569", fontWeight: 600 }}>
                      {isInvoice ? (
                        <span>🏭 Поставщик: <b>{details.supplier_name || "Неизвестный"}</b> → 📦 Склад: <b>{details.store_name || "Неизвестный"}</b></span>
                      ) : isInventory ? (
                        <span>📦 Склад: <b>{details.store_name || "Неизвестный склад"}</b></span>
                      ) : (
                        <span>📦 Склад: <b>{details.store_from_name || "Неизвестный склад"}</b> → 📦 Склад: <b>{details.store_to_name || "Неизвестный склад"}</b></span>
                      )}
                    </div>

                    <div style={{ background: "#f8fafc", borderRadius: 8, padding: 10 }}>
                      {items.map((it, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            padding: "4px 0",
                            borderBottom: idx < items.length - 1 ? "1px solid #f1f5f9" : "none",
                            color: "#334155",
                          }}
                        >
                          <span>{it.product_name || "Товар"}</span>
                          <span style={{ fontWeight: 600 }}>
                            {it.quantity} {it.unit || "шт"}
                            {isInvoice && Number(it.price) > 0 && ` × ${fmt(Number(it.price))} сум`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {details.comment && (
                  <div style={{ marginTop: 8, fontStyle: "italic", color: "#64748b", fontSize: 11 }}>
                    💬 Комментарий: {details.comment}
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
  color: "#475569",
  marginBottom: 6,
  display: "block",
};
const th = {
  padding: "8px 12px",
  textAlign: "left",
  fontWeight: 600,
  color: "#64748b",
  fontSize: 11,
};
const td = { padding: "8px 12px" };
const crumb = { fontSize: 12, color: "#64748b", marginBottom: 12 };
const inp = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 9,
  border: "1px solid #e2e8f0",
  fontSize: 13,
  outline: "none",
};
const numInput = {
  width: 80,
  padding: "6px 8px",
  borderRadius: 6,
  border: "1px solid #e2e8f0",
  fontSize: 13,
  textAlign: "center",
  outline: "none",
};
const storeBtn = {
  padding: "14px 16px",
  borderRadius: 10,
  border: "1px solid #e2e8f0",
  background: "#fff",
  cursor: "pointer",
  textAlign: "left",
  fontSize: 14,
  fontWeight: 500,
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: "100%",
};
