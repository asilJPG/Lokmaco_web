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
  createInvoice(data) {
    return this.post("/invoice", data);
  },
  createTransfer(data) {
    return this.post("/transfer", data);
  },
  createProduction(data) {
    return this.post("/production", data);
  },
  getEmployees() {
    return this.get("/employees");
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
        const u = JSON.parse(saved);
        const rawRole = u.role || "";
        const [baseRole, storeId] = rawRole.split(":");
        setLoggedInUser({
          ...u,
          baseRole: baseRole || "",
          storeId: storeId || null,
        });
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
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const tabs = [
    { id: "incoming", label: "Приход", icon: I.inbox },
    { id: "transfer", label: "Перемещение", icon: I.transfer },
    { id: "inventory", label: "Инвентаризация", icon: I.inventory },
    { id: "production", label: "Приготовление", icon: I.cooking },
    { id: "cash", label: "Касса", icon: I.cash },
    { id: "analytics", label: "Аналитика", icon: I.analytics },
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
  };

  const hasAccess = (role, tabId) => {
    if (role === "admin") return true;
    switch (tabId) {
      case "incoming":
        return role === "supplier";
      case "transfer":
        return ["kitchen", "prep_chef", "bar", "supplier"].includes(role);
      case "inventory":
        return ["kitchen", "prep_chef", "bar", "supplier"].includes(role);
      case "production":
        return ["prep_chef"].includes(role);
      case "employees":
        return role === "admin";
      case "cash":
        return role === "cashier";
      case "analytics":
        return role === "director";
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
        localStorage.setItem("user", JSON.stringify(parsedUser));
      } else {
        setLoginError(res?.error || "Неверный код доступа");
        setLoginCode(""); // Clear pin so they can re-type immediately
      }
    };

    const handleLogin = async (e) => {
      if (e) e.preventDefault();
      if (loginCode.length < 4) {
        setLoginError("Введите 4-значный код");
        return;
      }
      await triggerLogin(loginCode);
    };

    const pressPin = (num) => {
      setLoginError("");
      if (loginCode.length < 4) {
        const nextCode = loginCode + num;
        setLoginCode(nextCode);
        if (nextCode.length === 4) {
          triggerLogin(nextCode);
        }
      }
    };

    const deletePin = () => {
      setLoginError("");
      setLoginCode((prev) => prev.slice(0, -1));
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
                    background: loginCode[i]
                      ? "rgba(129, 140, 248, 0.15)"
                      : "transparent",
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
                style={{
                  ...pinBtn,
                  fontSize: 14,
                  fontWeight: 500,
                  color: "#94a3b8",
                }}
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
              <div
                style={{
                  color: "#64748b",
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
              onClick={() => {
                localStorage.removeItem("user");
                setLoggedInUser(null);
                setLoginCode("");
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
                  color: tab === t.id ? "#6366f1" : "#64748b",
                  borderBottom:
                    tab === t.id
                      ? "2px solid #6366f1"
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
            <h2
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: "#1e293b",
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
                    borderRadius: 20,
                    border: "none",
                    background:
                      "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                    color: "#fff",
                    cursor: "pointer",
                    boxShadow: "0 10px 25px rgba(99, 102, 241, 0.25)",
                    outline: "none",
                  }}
                  className="dashboard-card"
                >
                  <div style={{ fontSize: 32, marginBottom: 12 }}>📥</div>
                  <div
                    style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}
                  >
                    Приход накладных
                  </div>
                  <div style={{ fontSize: 13, opacity: 0.8 }}>
                    Оформление новых поставок товаров в iiko
                  </div>
                </button>
              )}

              {hasAccess(loggedInUser.baseRole, "transfer") && (
                <button
                  onClick={() => setTab("transfer")}
                  style={{
                    textAlign: "left",
                    padding: 24,
                    borderRadius: 20,
                    border: "none",
                    background:
                      "linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)",
                    color: "#fff",
                    cursor: "pointer",
                    boxShadow: "0 10px 25px rgba(6, 182, 212, 0.25)",
                    outline: "none",
                  }}
                  className="dashboard-card"
                >
                  <div style={{ fontSize: 32, marginBottom: 12 }}>🔁</div>
                  <div
                    style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}
                  >
                    Перемещение
                  </div>
                  <div style={{ fontSize: 13, opacity: 0.8 }}>
                    Внутреннее перемещение продуктов между складами
                  </div>
                </button>
              )}

              {hasAccess(loggedInUser.baseRole, "inventory") && (
                <button
                  onClick={() => setTab("inventory")}
                  style={{
                    textAlign: "left",
                    padding: 24,
                    borderRadius: 20,
                    border: "none",
                    background:
                      "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                    color: "#fff",
                    cursor: "pointer",
                    boxShadow: "0 10px 25px rgba(124, 58, 237, 0.25)",
                    outline: "none",
                  }}
                  className="dashboard-card"
                >
                  <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
                  <div
                    style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}
                  >
                    Инвентаризация
                  </div>
                  <div style={{ fontSize: 13, opacity: 0.8 }}>
                    Фактический пересчет остатков с автосохранением
                  </div>
                </button>
              )}

              {hasAccess(loggedInUser.baseRole, "production") && (
                <button
                  onClick={() => setTab("production")}
                  style={{
                    textAlign: "left",
                    padding: 24,
                    borderRadius: 20,
                    border: "none",
                    background:
                      "linear-gradient(135deg, #f97316 0%, #d97706 100%)",
                    color: "#fff",
                    cursor: "pointer",
                    boxShadow: "0 10px 25px rgba(249, 115, 22, 0.25)",
                    outline: "none",
                  }}
                  className="dashboard-card"
                >
                  <div style={{ fontSize: 32, marginBottom: 12 }}>🍳</div>
                  <div
                    style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}
                  >
                    Приготовление заготовок
                  </div>
                  <div style={{ fontSize: 13, opacity: 0.8 }}>
                    Акт приготовления готовых заготовок/смесей в iiko
                  </div>
                </button>
              )}

              {hasAccess(loggedInUser.baseRole, "cash") && (
                <button
                  onClick={() => setTab("cash")}
                  style={{
                    textAlign: "left",
                    padding: 24,
                    borderRadius: 20,
                    border: "none",
                    background:
                      "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    color: "#fff",
                    cursor: "pointer",
                    boxShadow: "0 10px 25px rgba(16, 185, 129, 0.25)",
                    outline: "none",
                  }}
                  className="dashboard-card"
                >
                  <div style={{ fontSize: 32, marginBottom: 12 }}>💵</div>
                  <div
                    style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}
                  >
                    Сдать кассу
                  </div>
                  <div style={{ fontSize: 13, opacity: 0.8 }}>
                    Отчет кассовой смены и расходов для руководства
                  </div>
                </button>
              )}

              {hasAccess(loggedInUser.baseRole, "analytics") && (
                <button
                  onClick={() => setTab("analytics")}
                  style={{
                    textAlign: "left",
                    padding: 24,
                    borderRadius: 20,
                    border: "none",
                    background:
                      "linear-gradient(135deg, #ec4899 0%, #be185d 100%)",
                    color: "#fff",
                    cursor: "pointer",
                    boxShadow: "0 10px 25px rgba(236, 72, 153, 0.25)",
                    outline: "none",
                  }}
                  className="dashboard-card"
                >
                  <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
                  <div
                    style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}
                  >
                    Аналитика
                  </div>
                  <div style={{ fontSize: 13, opacity: 0.8 }}>
                    P&L отчет, кассовая выручка и лидеры продаж
                  </div>
                </button>
              )}

              {hasAccess(loggedInUser.baseRole, "employees") && (
                <button
                  onClick={() => setTab("employees")}
                  style={{
                    textAlign: "left",
                    padding: 24,
                    borderRadius: 20,
                    border: "none",
                    background:
                      "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                    color: "#fff",
                    cursor: "pointer",
                    boxShadow: "0 10px 25px rgba(99, 102, 241, 0.25)",
                    outline: "none",
                  }}
                  className="dashboard-card"
                >
                  <div style={{ fontSize: 32, marginBottom: 12 }}>👥</div>
                  <div
                    style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}
                  >
                    Сотрудники
                  </div>
                  <div style={{ fontSize: 13, opacity: 0.8 }}>
                    Управление учетными записями персонала и правами
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
            showToast={showToast}
            loading={productsLoading}
            onRetry={loadData}
            loggedInUser={loggedInUser}
            loadHistory={loadHistory}
            history={history.filter((h) => h.action_type === "production")}
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
          />
        )}
        {tab === "employees" && (
          <EmployeesView
            stores={stores}
            showToast={showToast}
            loggedInUser={loggedInUser}
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
    } catch (e) {
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
    } catch (e) {
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
    } catch (e) {
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
          style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#475569" }}
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
            background: "#f8fafc",
            borderRadius: 12,
            border: "1px dashed #e2e8f0",
          }}
        >
          <div style={{ fontSize: 24, marginBottom: 8 }}>📦</div>
          <div style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>
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
                  background: "#fff",
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
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
                  e.currentTarget.style.borderColor = "#e2e8f0";
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
                        background: isProcessed ? "#d1fae5" : "#f3f4f6",
                        color: isProcessed ? "#065f46" : "#4b5563",
                      }}
                    >
                      {doc.status}
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#1e293b",
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
                      color: "#64748b",
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
                        color: "#94a3b8",
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
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>{date}</div>
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
              background: "#fff",
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
                borderBottom: "1px solid #f1f5f9",
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
                        type === "INCOMING_INVOICE" ? "#ecfdf5" : "#e0e7ff",
                      color:
                        type === "INCOMING_INVOICE" ? "#059669" : "#4f46e5",
                    }}
                  >
                    {type === "INCOMING_INVOICE"
                      ? "Приходная накладная"
                      : "Внутреннее перемещение"}
                  </span>
                  <span
                    style={{ fontSize: 14, fontWeight: 800, color: "#0f1729" }}
                  >
                    № {selectedDoc.documentNumber || "—"}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  📅 Дата:{" "}
                  <strong>{formatDateString(selectedDoc.dateIncoming)}</strong>
                </div>
              </div>
              <button
                onClick={() => setSelectedDoc(null)}
                style={{
                  background: "#f1f5f9",
                  border: "none",
                  borderRadius: "50%",
                  width: 32,
                  height: 32,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "#64748b",
                }}
              >
                {I.x}
              </button>
            </div>

            {/* Document Meta Info */}
            <div
              style={{
                background: "#f8fafc",
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
                    <span style={{ color: "#64748b" }}>🏢 Поставщик:</span>
                    <span style={{ fontWeight: 600 }}>
                      {selectedDoc.supplierName || "—"}
                    </span>
                  </div>
                  <div
                    style={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <span style={{ color: "#64748b" }}>
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
                        borderTop: "1px dashed #e2e8f0",
                        paddingTop: 8,
                        marginTop: 4,
                      }}
                    >
                      <span style={{ color: "#64748b", fontWeight: 700 }}>
                        💵 Итоговая сумма:
                      </span>
                      <span style={{ fontWeight: 800, color: "#059669" }}>
                        {fmtPrice(selectedDoc.sum)}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div
                    style={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <span style={{ color: "#64748b" }}>📤 Склад списания:</span>
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
                    <span style={{ color: "#64748b" }}>
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
                  <span style={{ color: "#64748b" }}>💬 Комментарий:</span>
                  <div
                    style={{
                      marginTop: 4,
                      fontStyle: "italic",
                      background: "#fff",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid #e2e8f0",
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
                color: "#475569",
              }}
            >
              📦 Состав документа
            </h4>

            {detailLoading && <LoadingBlock text="Загрузка состава..." />}

            {!detailLoading && detailData && (
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    border: "1px solid #e2e8f0",
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
                          background: "#f8fafc",
                          borderBottom: "1px solid #e2e8f0",
                        }}
                      >
                        <th
                          style={{
                            padding: "10px 14px",
                            fontWeight: 700,
                            color: "#475569",
                          }}
                        >
                          Товар
                        </th>
                        <th
                          style={{
                            padding: "10px 14px",
                            fontWeight: 700,
                            color: "#475569",
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
                                color: "#475569",
                                textAlign: "right",
                              }}
                            >
                              Цена
                            </th>
                            <th
                              style={{
                                padding: "10px 14px",
                                fontWeight: 700,
                                color: "#475569",
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
                                color: "#0f1729",
                              }}
                            >
                              {getProductName(it)}
                            </td>
                            <td
                              style={{
                                padding: "10px 14px",
                                fontWeight: 700,
                                color: "#1e293b",
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
                                    color: "#64748b",
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
          <div>
            <IikoHistoryList
              type="INCOMING_INVOICE"
              showToast={showToast}
              stores={stores}
              products={products}
            />
          </div>
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
        </div>
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
    if (
      loggedInUser?.storeId &&
      form.fromId !== loggedInUser.storeId &&
      form.toId !== loggedInUser.storeId
    ) {
      showToast(
        "Вы можете перемещать товары только со своего или на свой склад",
        "error"
      );
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
      showToast("Перемещение проведено!");
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
          <div>
            <IikoHistoryList
              type="INTERNAL_TRANSFER"
              showToast={showToast}
              stores={stores}
              products={products}
            />
          </div>
          <div>
            <HistoryList
              history={history.filter((act) => act.action_type === "transfer")}
              loading={historyLoading}
              onRefresh={loadHistory}
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
        </div>
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
        localStorage.setItem(
          "locmaco_inventory_draft_" + form.storeId,
          JSON.stringify(items)
        );
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
//  PRODUCTION — акты приготовления (списание и оприходование)
// ═══════════════════════════════════════════════════════════════

function ProductionView({
  products,
  showToast,
  loading,
  onRetry,
  loggedInUser,
  loadHistory,
  history,
  historyLoading,
}) {
  const [mode, setMode] = useState("idle");
  const [items, setItems] = useState([]);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);

  // Load draft on mount/mode change
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
        } catch (e) {
          setItems([]);
        }
      } else {
        setItems([]);
      }
    } else {
      setItems([]);
    }
  }, [mode]);

  // Save draft on items change
  useEffect(() => {
    if (mode === "new") {
      if (items.length > 0) {
        localStorage.setItem("locmaco_production_draft", JSON.stringify(items));
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
          <div
            style={{
              ...crumb,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>
              🍳 Место приготовления: <b>Кухня Заготовки</b>
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
//  EMPLOYEES — управление сотрудниками (без привязки к ТГ)
// ═══════════════════════════════════════════════════════════════

function EmployeesView({ stores, showToast, loggedInUser }) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState("idle"); // idle, new, or edit
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [form, setForm] = useState({
    name: "",
    role: "bar",
    storeId: "",
    access_code: "",
  });

  const loadEmployees = async () => {
    setLoading(true);
    const res = await API.getEmployees();
    if (res && res.success && Array.isArray(res.employees)) {
      setEmployees(res.employees);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  const isStoreDependent = (role) => {
    return ["supplier", "kitchen", "prep_chef", "bar"].includes(role);
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
    if (!/^\d{4}$/.test(form.access_code)) {
      showToast("Код доступа должен состоять ровно из 4 цифр", "error");
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
        user: { role: loggedInUser.baseRole },
      });
    } else {
      res = await API.createEmployee({
        name: form.name.trim(),
        role: finalRole,
        access_code: form.access_code,
        user: { role: loggedInUser.baseRole },
      });
    }
    setSubmitting(false);

    if (res && res.success) {
      showToast(mode === "edit" ? "Сотрудник успешно изменен!" : "Сотрудник успешно создан!");
      setForm({ name: "", role: "bar", storeId: "", access_code: "" });
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

  const filtered = employees.filter((emp) => {
    const q = searchQuery.toLowerCase();
    const nameMatch = emp.name?.toLowerCase().includes(q);
    const codeMatch = emp.access_code?.includes(q);
    const roleMatch = getRoleLabel(emp.role).toLowerCase().includes(q);
    const storeMatch = getStoreName(emp.role).toLowerCase().includes(q);
    return nameMatch || codeMatch || roleMatch || storeMatch;
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
        {mode === "idle" ? (
          <Btn
            onClick={() => {
              setMode("new");
              setForm({ name: "", role: "bar", storeId: "", access_code: "" });
            }}
            style={{
              background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
              boxShadow: "0 4px 12px rgba(99, 102, 241, 0.2)",
            }}
          >
            {I.plus} Добавить сотрудника
          </Btn>
        ) : (
          <Btn outline onClick={() => { setMode("idle"); setEditingId(null); }}>
            {I.x} Отмена
          </Btn>
        )}
      </div>

      {mode === "idle" && (
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
                background: "#fff",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "#94a3b8",
                display: "flex",
              }}
            >
              {I.search}
            </div>
          </div>

          {loading ? (
            <LoadingBlock text="Загрузка списка сотрудников..." />
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", background: "#fff", borderRadius: 14, border: "1px solid #e8ecf0" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>👥</div>
              <div style={{ fontWeight: 600, color: "#64748b" }}>
                {searchQuery ? "Ничего не найдено" : "Сотрудники не найдены"}
              </div>
            </div>
          ) : (
            <div
              style={{
                background: "#fff",
                borderRadius: 14,
                border: "1px solid #e8ecf0",
                overflow: "hidden",
                boxShadow: "0 4px 12px rgba(0,0,0,0.02)",
              }}
            >
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f8fafb", borderBottom: "1px solid #e8ecf0" }}>
                      <th style={{ ...th, padding: "14px 16px" }}>Имя</th>
                      <th style={th}>Должность</th>
                      <th style={th}>Склад</th>
                      <th style={{ ...th, textAlign: "center", width: 100 }}>Код доступа</th>
                      <th style={{ ...th, width: 90 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((emp) => {
                      const color = getRoleColor(emp.role);
                      return (
                        <tr key={emp.id} style={{ borderBottom: "1px solid #f0f2f5" }}>
                          <td style={{ ...td, padding: "14px 16px", fontWeight: 600, color: "#1e293b" }}>
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
                          <td style={{ ...td, color: "#475569", fontWeight: 500 }}>
                            {getStoreName(emp.role)}
                          </td>
                          <td style={{ ...td, textAlign: "center", fontFamily: "monospace", fontWeight: 700, letterSpacing: 1, color: "#64748b" }}>
                            {emp.access_code}
                          </td>
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
                                onMouseEnter={(e) => e.currentTarget.style.background = "#e0e7ff"}
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
            background: "#fff",
            borderRadius: 14,
            border: "1px solid #e8ecf0",
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
              <option value="supplier">Снабженец</option>
              <option value="kitchen">Шеф-повар</option>
              <option value="prep_chef">Смесь-повар</option>
              <option value="bar">Бармен</option>
              <option value="cashier">Кассир</option>
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
            <label style={lbl}>Код доступа (4 цифры)</label>
            <input
              type="text"
              pattern="[0-9]{4}"
              maxLength="4"
              value={form.access_code}
              onChange={(e) => setForm({ ...form, access_code: e.target.value.replace(/[^0-9]/g, "") })}
              placeholder="Например, 1234"
              style={{
                ...inp,
                fontFamily: "monospace",
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: 2,
              }}
              required
            />
            <small style={{ color: "#64748b", marginTop: 4, display: "block" }}>
              Этот уникальный код сотрудник будет вводить на главном экране для входа
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
    setExpenses((p) =>
      p.map((exp) => (exp.id === id ? { ...exp, [field]: value } : exp))
    );
  };

  const removeExpense = (id) => {
    setExpenses((p) => p.filter((exp) => exp.id !== id));
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    const hasValues =
      Object.values(form).some((v) => v !== "") || expenses.length > 0;
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
        role: loggedInUser.role,
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
          background: "#fff",
          borderRadius: 14,
          border: "1px solid #e8ecf0",
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
              color: "#475569",
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
              <h3
                style={{
                  margin: 0,
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#475569",
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
              <div
                style={{ fontSize: 12, color: "#94a3b8", fontStyle: "italic" }}
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
              <label style={{ ...lbl, color: "#991b1b" }}>
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

function HistoryList({ history, loading, onRefresh, emptyText, onRestore }) {
  if (loading && history.length === 0) {
    return <LoadingBlock text="Загрузка истории..." />;
  }

  if (history.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "40px 20px" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>📜</div>
        <div style={{ fontWeight: 600, color: "#64748b" }}>
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
          style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#475569" }}
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

          return (
            <div
              key={act.id}
              style={{
                background: isFailed ? "#fffbfa" : "#fff",
                borderRadius: 14,
                border: isFailed ? "1px solid #fee2e2" : "1px solid #e8ecf0",
                padding: 18,
                boxShadow: isFailed
                  ? "0 4px 12px rgba(239, 68, 68, 0.04)"
                  : "0 2px 4px rgba(0,0,0,0.02)",
                animation: "fadeIn .25s ease",
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
                            ? "#166534"
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
                        color: isFailed ? "#ef4444" : "#334155",
                      }}
                    >
                      {act.document_number || "Без номера"}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                    👤 Выполнил:{" "}
                    <b style={{ color: "#475569" }}>
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
                  style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}
                >
                  {formattedDate}
                </div>
              </div>

              <div style={{ fontSize: 12 }}>
                {isCash ? (
                  <div>
                    <div
                      style={{
                        background: "#f8fafc",
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
                        <span style={{ color: "#64748b" }}>💵 Наличные:</span>
                        <span style={{ fontWeight: 600 }}>
                          {fmtPrice(
                            details.payments?.cash || details.cash || 0
                          )}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span style={{ color: "#64748b" }}>💳 Uzcard:</span>
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
                        <span style={{ color: "#64748b" }}>💳 Humo:</span>
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
                        <span style={{ color: "#64748b" }}>
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
                        <span style={{ color: "#64748b" }}>💳 RAHMAT:</span>
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
                        <span style={{ color: "#64748b" }}>💳 Uzum:</span>
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
                        <span style={{ color: "#64748b" }}>🛵 Яндекс Еда:</span>
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
                              color: "#64748b",
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
                                color: "#166534",
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
                                color: "#991b1b",
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
                        color: "#475569",
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
                        background: "#f8fafc",
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
                            color: "#334155",
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
                      color: "#64748b",
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

// ═══════════════════════════════════════════════════════════════
//  ANALYTICS VIEW — P&L + Касса + Топ продаж
// ═══════════════════════════════════════════════════════════════

function AnalyticsView({ showToast, history, historyLoading, loadHistory }) {
  const [subTab, setSubTab] = useState("pl");
  const [loading, setLoading] = useState(false);

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

  // Data
  const [plData, setPlData] = useState(null);
  const [cashData, setCashData] = useState(null);
  const [topData, setTopData] = useState(null);
  const [waitersData, setWaitersData] = useState(null);
  const [showExpensesDetail, setShowExpensesDetail] = useState(false);

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
      const r = await fetch(`/api/iiko/analytics/pl?from=${from}&to=${to}`);
      const res = await r.json();
      if (res && res.success) {
        setPlData(res.data);
      } else {
        showToast(res?.error || "Ошибка загрузки P&L отчета", "error");
      }
    } catch (e) {
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
      const r = await fetch(`/api/iiko/analytics/cash?from=${from}&to=${to}`);
      const res = await r.json();
      if (res && res.success) {
        setCashData(res.data);
      } else {
        showToast(res?.error || "Ошибка загрузки отчета кассы", "error");
      }
    } catch (e) {
      showToast("Ошибка сети при загрузке кассы", "error");
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
        `/api/iiko/analytics/top-sales?from=${from}&to=${to}`
      );
      const res = await r.json();
      if (res && res.success) {
        setTopData(res.data);
        setTopThreshold(res.threshold || 30);
      } else {
        showToast(res?.error || "Ошибка загрузки топ продаж", "error");
      }
    } catch (e) {
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
        `/api/iiko/analytics/waiters?from=${from}&to=${to}`
      );
      const res = await r.json();
      if (res && res.success) {
        setWaitersData(res.data);
      } else {
        showToast(res?.error || "Ошибка загрузки топ официантов", "error");
      }
    } catch (e) {
      showToast("Ошибка сети при загрузке официантов", "error");
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
      {/* Tab Selectors */}
      <div
        style={{
          display: "flex",
          gap: 10,
          marginBottom: 24,
          borderBottom: "1px solid #e2e8f0",
          paddingBottom: 10,
        }}
      >
        {[
          {
            id: "pl",
            label: "📊 Отчет о Прибыли и Убытках",
            grad: "linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)",
            text: "#4338ca",
          },
          {
            id: "cash",
            label: "💵 Касса",
            grad: "linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)",
            text: "#065f46",
          },
          {
            id: "top",
            label: "🍽 Топ продаж",
            grad: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
            text: "#92400e",
          },
          {
            id: "waiters",
            label: "🤵 Топ официантов",
            grad: "linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)",
            text: "#0369a1",
          },
        ].map((sub) => (
          <button
            key={sub.id}
            onClick={() => setSubTab(sub.id)}
            style={{
              padding: "10px 16px",
              borderRadius: 12,
              border: subTab === sub.id ? "none" : "1px solid #e2e8f0",
              background: subTab === sub.id ? sub.grad : "#fff",
              color: subTab === sub.id ? sub.text : "#64748b",
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
              color: "#64748b",
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
            {[
              { id: "this_month", label: "Этот месяц" },
              { id: "last_month", label: "Прошлый месяц" },
              { id: "custom", label: "Свой период" },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setPlPeriod(p.id);
                  if (p.id !== "custom") loadPL(p.id);
                }}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: plPeriod === p.id ? "none" : "1px solid #e2e8f0",
                  background: plPeriod === p.id ? "#4f46e5" : "#fff",
                  color: plPeriod === p.id ? "#fff" : "#64748b",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {p.label}
              </button>
            ))}

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
                    border: "1px solid #e2e8f0",
                    fontSize: 12,
                  }}
                />
                <span style={{ fontSize: 12, color: "#64748b" }}>до</span>
                <input
                  type="date"
                  value={plDates.to}
                  onChange={(e) =>
                    setPlDates({ ...plDates, to: e.target.value })
                  }
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
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

              {/* Expenses Drawer / Modal Accordion */}
              <div
                style={{
                  background: "#fff",
                  borderRadius: 16,
                  border: "1px solid #e2e8f0",
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
                  <button
                    onClick={() => setShowExpensesDetail(!showExpensesDetail)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 8,
                      background: "rgba(99, 102, 241, 0.08)",
                      border: "none",
                      color: "#4f46e5",
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    {showExpensesDetail ? "Скрыть детали" : "Показать детали"}
                  </button>
                </div>

                {showExpensesDetail ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    {plData.expensesDetail.length > 0 ? (
                      plData.expensesDetail.map((exp, idx) => {
                        const maxVal = plData.expensesDetail[0].amount || 1;
                        const pctOfMax = (exp.amount / maxVal) * 100;
                        return (
                          <div key={idx} style={{ padding: "8px 0" }}>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                fontSize: 13,
                                fontWeight: 600,
                                marginBottom: 4,
                              }}
                            >
                              <span>{exp.name}</span>
                              <span style={{ color: "#ef4444" }}>
                                {fmtPrice(exp.amount)}
                              </span>
                            </div>
                            <div
                              style={{
                                width: "100%",
                                height: 6,
                                borderRadius: 3,
                                background: "#f1f5f9",
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  height: "100%",
                                  borderRadius: 3,
                                  background: "#ef4444",
                                  width: `${pctOfMax}%`,
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
                          color: "#64748b",
                          fontSize: 13,
                          textAlign: "center",
                          padding: "20px 0",
                        }}
                      >
                        Расходы отсутствуют за выбранный период.
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: "#64748b" }}>
                    Нажмите «Показать детали» для просмотра детализации расходов
                    по счетам.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div
              style={{
                fontStyle: "italic",
                color: "#64748b",
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
                  border: "1px solid #e2e8f0",
                  background: "#fff",
                  fontSize: 12,
                  fontWeight: 700,
                  outline: "none",
                }}
              >
                <option value="fest">📍 Lokmaco г.Фергана тц Festival</option>
              </select>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              {[
                { id: "today", label: "Сегодня" },
                { id: "yesterday", label: "Вчера" },
                { id: "single", label: "Выбрать день" },
                { id: "custom", label: "Период" },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setCashPeriod(p.id);
                    if (p.id !== "custom" && p.id !== "single") {
                      loadCash(p.id);
                    } else if (p.id === "single") {
                      loadCash("single", cashSingleDate, cashSingleDate);
                    }
                  }}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: cashPeriod === p.id ? "none" : "1px solid #e2e8f0",
                    background: cashPeriod === p.id ? "#10b981" : "#fff",
                    color: cashPeriod === p.id ? "#fff" : "#64748b",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {cashPeriod === "single" && (
              <div
                style={{ display: "inline-flex", gap: 6, alignItems: "center" }}
              >
                <span
                  style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}
                >
                  Выбор даты:
                </span>
                <input
                  type="date"
                  value={cashSingleDate}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCashSingleDate(val);
                    loadCash("single", val, val);
                  }}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    fontSize: 12,
                    outline: "none",
                  }}
                />
              </div>
            )}

            {cashPeriod === "custom" && (
              <div
                style={{ display: "inline-flex", gap: 6, alignItems: "center" }}
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
                    border: "1px solid #e2e8f0",
                    fontSize: 12,
                  }}
                />
                <span style={{ fontSize: 12, color: "#64748b" }}>до</span>
                <input
                  type="date"
                  value={cashDates.to}
                  onChange={(e) =>
                    setCashDates({ ...cashDates, to: e.target.value })
                  }
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
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
              if (history) {
                const cashReports = history.filter(
                  (h) => h.action_type === "cash"
                );
                periodReports = cashReports.filter((report) => {
                  const reportDate =
                    report.details?.selected_date ||
                    new Date(report.created_at).toISOString().split("T")[0];
                  return reportDate >= activeFrom && reportDate <= activeTo;
                });

                if (periodReports.length > 0) {
                  cashierTotals = {
                    cash: 0,
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

                    <div style={cardStyle("#fff", "1px solid #e2e8f0")}>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#64748b",
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
                          color: "#0f1729",
                          marginTop: 8,
                        }}
                      >
                        {cashData.orderCount}
                      </div>
                      <div
                        style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}
                      >
                        Выставлено счетов в iiko
                      </div>
                    </div>

                    <div style={cardStyle("#fff", "1px solid #e2e8f0")}>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#64748b",
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
                          color: "#0f1729",
                          marginTop: 8,
                        }}
                      >
                        {fmtPrice(cashData.avgCheck)}
                      </div>
                      <div
                        style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}
                      >
                        Средняя стоимость заказа
                      </div>
                    </div>

                    <div style={cardStyle("#fff", "1px solid #e2e8f0")}>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#64748b",
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
                          color: "#0f1729",
                          marginTop: 8,
                        }}
                      >
                        {cashData.guestCount || "—"}
                      </div>
                      <div
                        style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}
                      >
                        Общее число посетителей
                      </div>
                    </div>
                  </div>

                  {/* Audit Comparison Table comparing iiko vs cashier */}
                  <div
                    style={{
                      background: "#fff",
                      borderRadius: 16,
                      border: "1px solid #e2e8f0",
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
                          color: "#0f1729",
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
                        if (name.includes("нал")) return "cash";
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
                            uzcard: cashierTotals.uzcard,
                            humo: cashierTotals.humo,
                            online: cashierTotals.online,
                            rahmat: cashierTotals.rahmat,
                            uzum: cashierTotals.uzum,
                            yandex: cashierTotals.yandex,
                          }
                        : {
                            cash: 0,
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
                        {
                          label: "💵 Наличные",
                          field: "cash",
                          exp: totalExpenses,
                        },
                        { label: "💳 Uzcard", field: "uzcard", exp: 0 },
                        { label: "💳 Humo", field: "humo", exp: 0 },
                        { label: "📱 Click / Payme", field: "online", exp: 0 },
                        { label: "💳 RAHMAT", field: "rahmat", exp: 0 },
                        { label: "💳 Uzum", field: "uzum", exp: 0 },
                        { label: "🛵 Яндекс Еда", field: "yandex", exp: 0 },
                      ];

                      if (iikoPayments.other > 0) {
                        rows.push({
                          label: "⚙️ Другие оплаты (iiko)",
                          field: "other",
                          exp: 0,
                        });
                      }

                      const thStyle = {
                        padding: "10px 8px",
                        borderBottom: "2px solid #cbd5e1",
                        background: "#f8fafc",
                        fontSize: "11px",
                        fontWeight: "700",
                        color: "#475569",
                        textAlign: "right",
                      };
                      const tdStyle = {
                        padding: "10px 8px",
                        borderBottom: "1px solid #e2e8f0",
                        fontSize: "12px",
                        color: "#334155",
                        textAlign: "right",
                      };

                      return (
                        <div
                          style={{
                            overflowX: "auto",
                            borderRadius: 10,
                            border: "1px solid #e2e8f0",
                          }}
                        >
                          <table
                            style={{
                              width: "100%",
                              borderCollapse: "collapse",
                              minWidth: 600,
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
                                <th style={thStyle}>Отклонение</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((row, idx) => {
                                const iikoVal = iikoPayments[row.field] || 0;
                                const cashVal = cashierPayments[row.field] || 0;
                                const calculatedBalance = iikoVal - row.exp;
                                const diff = cashierTotals
                                  ? cashVal - calculatedBalance
                                  : 0;

                                return (
                                  <tr key={idx}>
                                    <td
                                      style={{
                                        ...tdStyle,
                                        textAlign: "left",
                                        fontWeight: "600",
                                        background: "#f8fafc",
                                      }}
                                    >
                                      {row.label}
                                    </td>
                                    <td style={tdStyle}>{fmtPrice(iikoVal)}</td>
                                    <td
                                      style={{
                                        ...tdStyle,
                                        color:
                                          row.exp > 0 ? "#ef4444" : "#64748b",
                                      }}
                                    >
                                      {row.exp > 0 ? fmtPrice(row.exp) : "—"}
                                    </td>
                                    <td
                                      style={{ ...tdStyle, fontWeight: "600" }}
                                    >
                                      {fmtPrice(calculatedBalance)}
                                    </td>
                                    <td
                                      style={{
                                        ...tdStyle,
                                        fontWeight: "700",
                                        color: "#1e293b",
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
                                const totalIiko = Object.values(
                                  iikoPayments
                                ).reduce((a, b) => a + b, 0);
                                const totalCashier = Object.values(
                                  cashierPayments
                                ).reduce((a, b) => a + b, 0);
                                const totalCalc = totalIiko - totalExpenses;
                                const totalDiff = totalCashier - totalCalc;

                                return (
                                  <tr
                                    style={{
                                      background: "#f8fafc",
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
                                          totalExpenses > 0
                                            ? "#ef4444"
                                            : "#64748b",
                                      }}
                                    >
                                      {totalExpenses > 0
                                        ? fmtPrice(totalExpenses)
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
                                        background: "#f1f5f9",
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
                color: "#64748b",
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
            {[
              { id: "today", label: "Сегодня" },
              { id: "yesterday", label: "Вчера" },
              { id: "custom", label: "Период" },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setTopPeriod(p.id);
                  if (p.id !== "custom") loadTop(p.id);
                }}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: topPeriod === p.id ? "none" : "1px solid #e2e8f0",
                  background: topPeriod === p.id ? "#f59e0b" : "#fff",
                  color: topPeriod === p.id ? "#fff" : "#64748b",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {p.label}
              </button>
            ))}

            {topPeriod === "custom" && (
              <div
                style={{ display: "inline-flex", gap: 6, alignItems: "center" }}
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
                    border: "1px solid #e2e8f0",
                    fontSize: 12,
                  }}
                />
                <span style={{ fontSize: 12, color: "#64748b" }}>до</span>
                <input
                  type="date"
                  value={topDates.to}
                  onChange={(e) =>
                    setTopDates({ ...topDates, to: e.target.value })
                  }
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
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
                      background: "#fff",
                      borderRadius: 16,
                      border: "1px solid #e2e8f0",
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
                          color: "#0f1729",
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
                                          color: "#1e293b",
                                        }}
                                      >
                                        {dish.name}
                                      </div>
                                      <div
                                        style={{
                                          color: "#64748b",
                                          textAlign: "right",
                                        }}
                                      >
                                        <div
                                          style={{
                                            fontWeight: 700,
                                            color: "#1e293b",
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
                                    color: "#64748b",
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
                                          color: "#94a3b8",
                                        }}
                                      >
                                        •
                                      </span>
                                      <div
                                        style={{
                                          flex: 1,
                                          fontWeight: 500,
                                          color: "#475569",
                                        }}
                                      >
                                        {dish.name}
                                      </div>
                                      <div
                                        style={{
                                          color: "#94a3b8",
                                          textAlign: "right",
                                        }}
                                      >
                                        <div
                                          style={{
                                            fontWeight: 600,
                                            color: "#475569",
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
                    color: "#64748b",
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
                color: "#64748b",
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
            {[
              { id: "today", label: "Сегодня" },
              { id: "yesterday", label: "Вчера" },
              { id: "this_month", label: "Этот месяц" },
              { id: "custom", label: "Период" },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setWaitersPeriod(p.id);
                  if (p.id !== "custom") loadWaiters(p.id);
                }}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: waitersPeriod === p.id ? "none" : "1px solid #e2e8f0",
                  background: waitersPeriod === p.id ? "#0284c7" : "#fff",
                  color: waitersPeriod === p.id ? "#fff" : "#64748b",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {p.label}
              </button>
            ))}

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
                    border: "1px solid #e2e8f0",
                    fontSize: 12,
                  }}
                />
                <span style={{ fontSize: 12, color: "#64748b" }}>до</span>
                <input
                  type="date"
                  value={waitersDates.to}
                  onChange={(e) =>
                    setWaitersDates({ ...waitersDates, to: e.target.value })
                  }
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
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
                background: "#fff",
                borderRadius: 16,
                border: "1px solid #e2e8f0",
                padding: 20,
                boxShadow: "0 4px 15px rgba(0,0,0,0.02)",
              }}
            >
              <h3
                style={{
                  margin: "0 0 20px",
                  fontSize: 16,
                  fontWeight: 800,
                  color: "#0f1729",
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
                                color: "#64748b",
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
                                color: "#1e293b",
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
                            color: "#64748b",
                            marginTop: 2,
                            marginBottom: 2,
                            zIndex: 1,
                          }}
                        >
                          <span>
                            🧾 Чеков:{" "}
                            <strong style={{ color: "#334155" }}>
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
                            <strong style={{ color: "#334155" }}>
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
                            background: "#f1f5f9",
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
                    color: "#64748b",
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
                color: "#64748b",
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
    </div>
  );
}
