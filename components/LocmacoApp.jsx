import { useState, useEffect, useCallback, useRef } from "react";

/*
 ╔══════════════════════════════════════════════════════════════════════╗
 ║  The Lokmaco — iiko Warehouse Web Interface                        ║
 ║  Built from actual Telegram bot logic (bot.py + users.py)          ║
 ║                                                                     ║
 ║  Data sources (via Next.js API routes):                             ║
 ║  • iiko Server /resto/api — products, suppliers, stores, invoices  ║
 ║  • iikoWeb /api — transfers (INTERNAL_TRANSFER documents)          ║
 ║  • Supabase — users, roles, auth                                   ║
 ║  • OpenRouter AI — natural language → structured items parsing     ║
 ╚══════════════════════════════════════════════════════════════════════╝
*/

// ─── Real constants from users.py ───
const MAIN_STORE_ID = "1239d270-1bbe-f64f-b7ea-5f00518ef508";
const ALLOWED_SUPPLIERS = [
  "16c6e655-945c-4002-a117-934749aea133",
  "3bdcfdbb-e66c-4b16-9025-03dedb7905fa",
];
const STORES_STATIC = {
  "1239d270-1bbe-f64f-b7ea-5f00518ef508": "Основной склад",
  "6be6e519-c4d8-4461-9333-7810062486ed": "Кухня",
  "c1a132f0-5a33-4f0b-a47b-5b6d8f381c9f": "Бар",
  "6da08473-087b-4efb-ad9e-ba14e8999fae": "Мойка",
  "0cf0f2c5-891c-412c-8ab7-7b2bacdd2b01": "Посуда",
  "9101f69e-ab51-44b6-8c1a-f80e84d8eec3": "Хоз товары",
};
const TRANSFER_TARGETS = {
  "6be6e519-c4d8-4461-9333-7810062486ed": { name: "Кухня", icon: "👨‍🍳" },
  "c1a132f0-5a33-4f0b-a47b-5b6d8f381c9f": { name: "Бар", icon: "🍸" },
};
const ROLES = {
  admin: "Админ",
  director: "Руководитель",
  supplier: "Снабженец",
  kitchen: "Шеф-повар",
  bar: "Бармен",
};

// ─── API helpers (calls to Next.js /api/* proxy routes) ───
const API = {
  async get(endpoint) {
    try {
      const r = await fetch(`/api/iiko${endpoint}`);
      if (!r.ok) throw new Error(`${r.status}`);
      return await r.json();
    } catch (e) {
      console.error(`API GET ${endpoint}:`, e);
      return null;
    }
  },
  async post(endpoint, body) {
    try {
      const r = await fetch(`/api/iiko${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(`${r.status}`);
      return await r.json();
    } catch (e) {
      console.error(`API POST ${endpoint}:`, e);
      return null;
    }
  },
  // Real endpoints mapped from bot.py:
  async getProducts() {
    // GET /resto/api/v2/entities/products/list → filter type=GOODS
    return await this.get("/products");
  },
  async getSuppliers() {
    // GET /resto/api/suppliers → XML parse, filter supplier=true & allowed IDs
    return await this.get("/suppliers");
  },
  async getStores() {
    // GET /resto/api/corporation/stores → XML parse
    return await this.get("/stores");
  },
  async parseItems(text) {
    // OpenRouter AI parsing (same prompt as bot.py)
    return await this.post("/parse", { text });
  },
  async createInvoice(data) {
    // POST /resto/api/documents/import/incomingInvoice → XML body
    return await this.post("/invoice", data);
  },
  async createTransfer(data) {
    // iikoWeb: auth → create INTERNAL_TRANSFER → save as PROCESSED
    return await this.post("/transfer", data);
  },
};

// ─── Formatting ───
const fmt = (n) => new Intl.NumberFormat("ru-RU").format(Math.round(n));
const fmtPrice = (n) => fmt(n) + " сум";
const fmtDate = (d) => new Date(d).toLocaleDateString("ru-RU");
const nowStr = () =>
  new Date().toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

// ─── SVG Icons ───
const I = {
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
  box: (
    <svg
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      viewBox="0 0 24 24"
    >
      <path d="m7.5 4.27 9 5.15" />
      <path d="M21 8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  ),
  cart: (
    <svg
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      viewBox="0 0 24 24"
    >
      <circle cx="8" cy="21" r="1" />
      <circle cx="19" cy="21" r="1" />
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 002 1.58h9.78a2 2 0 001.95-1.57l1.65-7.43H5.12" />
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
  minus: (
    <svg
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      viewBox="0 0 24 24"
    >
      <path d="M5 12h14" />
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
  check: (
    <svg
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      viewBox="0 0 24 24"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  clock: (
    <svg
      width="14"
      height="14"
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
  sparkle: (
    <svg
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      viewBox="0 0 24 24"
    >
      <path d="m12 3-1.9 5.8a2 2 0 01-1.3 1.3L3 12l5.8 1.9a2 2 0 011.3 1.3L12 21l1.9-5.8a2 2 0 011.3-1.3L21 12l-5.8-1.9a2 2 0 01-1.3-1.3Z" />
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
};

// ─── Status Badge ───
function Badge({ status }) {
  const m = {
    completed: { l: "Проведён", c: "#059669", bg: "#05966912" },
    pending: { l: "Ожидание", c: "#d97706", bg: "#d9770612" },
    in_transit: { l: "В пути", c: "#7c3aed", bg: "#7c3aed12" },
    draft: { l: "Черновик", c: "#94a3b8", bg: "#94a3b812" },
    error: { l: "Ошибка", c: "#ef4444", bg: "#ef444412" },
  };
  const s = m[status] || m.draft;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 10px",
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 600,
        color: s.c,
        background: s.bg,
        letterSpacing: 0.2,
      }}
    >
      {status === "completed" && I.check}
      {status === "pending" && I.clock}
      {s.l}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════
//  DEMO DATA — remove when connecting real API routes
// ═══════════════════════════════════════════════════════════════

const DEMO_PRODUCTS = [
  { id: "a1", name: "Помидоры", type: "GOODS", mainUnit: "кг" },
  { id: "a2", name: "Огурцы", type: "GOODS", mainUnit: "кг" },
  { id: "a3", name: "Лук репчатый", type: "GOODS", mainUnit: "кг" },
  { id: "a4", name: "Картофель", type: "GOODS", mainUnit: "кг" },
  { id: "a5", name: "Перец болгарский", type: "GOODS", mainUnit: "кг" },
  { id: "a6", name: "Куриное филе", type: "GOODS", mainUnit: "кг" },
  { id: "a7", name: "Говядина (вырезка)", type: "GOODS", mainUnit: "кг" },
  { id: "a8", name: "Баранина", type: "GOODS", mainUnit: "кг" },
  { id: "a9", name: "Молоко 3.2%", type: "GOODS", mainUnit: "л" },
  { id: "a10", name: "Сметана 20%", type: "GOODS", mainUnit: "кг" },
  { id: "a11", name: "Сыр Моцарелла", type: "GOODS", mainUnit: "кг" },
  { id: "a12", name: "Масло подсолнечное", type: "GOODS", mainUnit: "л" },
  { id: "a13", name: "Мука в/с", type: "GOODS", mainUnit: "кг" },
  { id: "a14", name: "Рис длиннозёрный", type: "GOODS", mainUnit: "кг" },
  { id: "a15", name: "Сахар", type: "GOODS", mainUnit: "кг" },
  { id: "a16", name: "Лимон", type: "GOODS", mainUnit: "шт" },
  { id: "a17", name: "Coca-Cola 1л", type: "GOODS", mainUnit: "шт" },
  { id: "a18", name: "Вода минеральная", type: "GOODS", mainUnit: "л" },
  { id: "a19", name: "Креветки тигровые", type: "GOODS", mainUnit: "кг" },
  { id: "a20", name: "Масло сливочное 82%", type: "GOODS", mainUnit: "кг" },
];

const DEMO_SUPPLIERS = [
  { id: "16c6e655-945c-4002-a117-934749aea133", name: "ООО «ФрешМаркет»" },
  { id: "3bdcfdbb-e66c-4b16-9025-03dedb7905fa", name: "ИП Каримов" },
];

const DEMO_HISTORY = {
  invoices: [
    {
      id: "inv1",
      number: "TG-20260521-143022",
      date: "2026-05-21",
      supplier: "ООО «ФрешМаркет»",
      store: "Основной склад",
      items: 6,
      status: "completed",
    },
    {
      id: "inv2",
      number: "TG-20260520-091544",
      date: "2026-05-20",
      supplier: "ИП Каримов",
      store: "Основной склад",
      items: 4,
      status: "completed",
    },
    {
      id: "inv3",
      number: "TG-20260519-164233",
      date: "2026-05-19",
      supplier: "ООО «ФрешМаркет»",
      store: "Основной склад",
      items: 9,
      status: "pending",
    },
  ],
  transfers: [
    {
      id: "tr1",
      number: "PM-00234",
      date: "2026-05-21",
      from: "Основной склад",
      to: "Кухня",
      items: 5,
      status: "completed",
    },
    {
      id: "tr2",
      number: "PM-00233",
      date: "2026-05-20",
      from: "Основной склад",
      to: "Бар",
      items: 3,
      status: "completed",
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
//  MAIN APP
// ═══════════════════════════════════════════════════════════════

export default function LocmacoApp() {
  const [tab, setTab] = useState("products");
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [products, setProducts] = useState(DEMO_PRODUCTS);
  const [suppliers, setSuppliers] = useState(DEMO_SUPPLIERS);
  const [stores] = useState(STORES_STATIC);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // Load real data on mount (falls back to demo)
  useEffect(() => {
    (async () => {
      const [p, s] = await Promise.all([API.getProducts(), API.getSuppliers()]);
      if (p?.length) setProducts(p);
      if (s?.length) setSuppliers(s);
    })();
  }, []);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const addToCart = useCallback((product, qty = 1) => {
    setCart((prev) => {
      const ex = prev.find((i) => i.id === product.id);
      if (ex)
        return prev.map((i) =>
          i.id === product.id ? { ...i, qty: i.qty + qty } : i
        );
      return [...prev, { ...product, qty }];
    });
    showToast(`${product.name} → корзина`);
  }, []);

  const updateQty = (id, d) =>
    setCart((p) =>
      p
        .map((i) => (i.id === id ? { ...i, qty: Math.max(0.5, i.qty + d) } : i))
        .filter((i) => i.qty > 0)
    );
  const removeItem = (id) => setCart((p) => p.filter((i) => i.id !== id));
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  const tabs = [
    { id: "products", label: "Товары", icon: I.box },
    { id: "incoming", label: "Приход", icon: I.inbox },
    { id: "transfer", label: "Перемещение", icon: I.transfer },
  ];

  return (
    <div
      style={{
        fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif",
        minHeight: "100vh",
        background: "#f5f7fa",
        color: "#0f1729",
      }}
    >
      {/* Header */}
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
              <div
                style={{
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 15,
                  letterSpacing: -0.3,
                }}
              >
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
          <button
            onClick={() => setCartOpen(true)}
            style={{
              position: "relative",
              background: cart.length ? "#6366f1" : "rgba(255,255,255,0.07)",
              border: "none",
              borderRadius: 10,
              padding: "8px 14px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 7,
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              transition: "all 0.15s",
            }}
          >
            {I.cart}
            <span>Корзина</span>
            {cart.length > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: -5,
                  right: -5,
                  background: "#ef4444",
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: 700,
                  borderRadius: 10,
                  minWidth: 18,
                  height: 18,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 4px",
                }}
              >
                {Math.round(cartCount)}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Tabs */}
      <nav
        style={{
          background: "#fff",
          borderBottom: "1px solid #e5e8ee",
          position: "sticky",
          top: 60,
          zIndex: 90,
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
                transition: "all 0.15s",
              }}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main
        style={{ maxWidth: 1120, margin: "0 auto", padding: "20px 20px 100px" }}
      >
        {tab === "products" && (
          <ProductsView products={products} addToCart={addToCart} />
        )}
        {tab === "incoming" && (
          <IncomingView
            products={products}
            suppliers={suppliers}
            stores={stores}
            showToast={showToast}
            cart={cart}
            setCart={setCart}
          />
        )}
        {tab === "transfer" && (
          <TransferView
            products={products}
            stores={stores}
            showToast={showToast}
            cart={cart}
            setCart={setCart}
          />
        )}
      </main>

      {/* Cart Drawer */}
      {cartOpen && (
        <CartDrawer
          cart={cart}
          updateQty={updateQty}
          removeItem={removeItem}
          onClose={() => setCartOpen(false)}
          setTab={setTab}
        />
      )}

      {/* Toast */}
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
//  PRODUCTS VIEW  — search + grid (from /resto/api/v2/entities/products/list)
// ═══════════════════════════════════════════════════════════════

function ProductsView({ products, addToCart }) {
  const [q, setQ] = useState("");
  const filtered = products.filter(
    (p) => !q || p.name.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div style={{ animation: "fadeIn .25s ease" }}>
      {/* Search bar */}
      <div style={{ position: "relative", marginBottom: 20 }}>
        <span
          style={{
            position: "absolute",
            left: 14,
            top: "50%",
            transform: "translateY(-50%)",
            color: "#94a3b8",
          }}
        >
          {I.search}
        </span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск по номенклатуре iiko..."
          style={{
            width: "100%",
            padding: "12px 14px 12px 42px",
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            fontSize: 14,
            outline: "none",
            background: "#fff",
          }}
          onFocus={(e) => (e.target.style.borderColor = "#818cf8")}
          onBlur={(e) => (e.target.style.borderColor = "#e2e8f0")}
        />
        <div
          style={{
            position: "absolute",
            right: 14,
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: 11,
            color: "#94a3b8",
          }}
        >
          {filtered.length} из {products.length}
        </div>
      </div>

      {/* Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 12,
        }}
      >
        {filtered.map((p) => (
          <div
            key={p.id}
            style={{
              background: "#fff",
              borderRadius: 14,
              padding: "16px 18px",
              border: "1px solid #eef1f5",
              transition: "box-shadow .15s, transform .15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.05)";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = "none";
              e.currentTarget.style.transform = "none";
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 14,
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3 }}>
                  {p.name}
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>
                  {p.mainUnit || p.unit || "шт"} · {p.type}
                </div>
              </div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: "#6366f1",
                  background: "#6366f10a",
                  padding: "2px 7px",
                  borderRadius: 5,
                  whiteSpace: "nowrap",
                }}
              >
                ID: {p.id.slice(0, 6)}…
              </div>
            </div>
            <button
              onClick={() =>
                addToCart({
                  id: p.id,
                  name: p.name,
                  unit: p.mainUnit || p.unit || "шт",
                  qty: 1,
                })
              }
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                padding: "9px 0",
                borderRadius: 9,
                border: "none",
                background: "#6366f1",
                color: "#fff",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {I.plus} В корзину
            </button>
          </div>
        ))}
      </div>
      {filtered.length === 0 && <Empty icon="🔍" text="Товары не найдены" />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  INCOMING INVOICE (Приход) — mirrors bot.py InvoiceFSM
//  supplier → store → items (AI parse or manual) → confirm → POST XML
// ═══════════════════════════════════════════════════════════════

function IncomingView({
  products,
  suppliers,
  stores,
  showToast,
  cart,
  setCart,
}) {
  const [mode, setMode] = useState("list"); // list | new
  const [step, setStep] = useState(0); // 0: supplier, 1: store, 2: items, 3: confirm
  const [form, setForm] = useState({
    supplierId: "",
    supplierName: "",
    storeId: "",
    storeName: "",
    comment: "",
  });
  const [items, setItems] = useState([]);
  const [aiText, setAiText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const startFromCart = () => {
    setItems(
      cart.map((c) => ({
        product_id: c.id,
        product_name: c.name,
        quantity: c.qty,
        unit: c.unit,
        price: 0,
      }))
    );
    setStep(0);
    setMode("new");
  };

  const handleAIParse = async () => {
    if (!aiText.trim()) return;
    setParsing(true);
    // In production: calls OpenRouter via /api/iiko/parse
    // Same prompt as bot.py parse_with_ai()
    const result = await API.parseItems(aiText);
    if (result?.length) {
      setItems(result);
      setStep(3);
    } else {
      // Fallback: basic local parse
      const lines = aiText.split("\n").filter(Boolean);
      const parsed = lines.map((line) => {
        const parts = line.trim().split(/\s+/);
        const name = parts[0] || "?";
        const qty = parseFloat(parts[1]) || 1;
        const unit = (parts[2] || "шт").replace(/[0-9]/g, "") || "шт";
        const totalOrPrice = parseFloat(parts[parts.length - 1]) || 0;
        const price =
          totalOrPrice > qty * 1000 ? totalOrPrice / qty : totalOrPrice;
        const match = products.find((p) =>
          p.name.toLowerCase().includes(name.toLowerCase())
        );
        return {
          product_id: match?.id || "",
          product_name: match?.name || name,
          quantity: qty,
          unit,
          price,
        };
      });
      setItems(parsed);
      setStep(3);
    }
    setParsing(false);
  };

  const handleSubmit = async () => {
    if (!form.supplierId || !form.storeId || items.length === 0) {
      showToast("Заполните все поля", "error");
      return;
    }
    setSubmitting(true);
    const result = await API.createInvoice({
      supplier_id: form.supplierId,
      store_id: form.storeId,
      items,
      comment: form.comment,
    });
    setSubmitting(false);
    if (result?.success) {
      showToast("Накладная создана в iiko!");
      setMode("list");
      setStep(0);
      setItems([]);
      setForm({
        supplierId: "",
        supplierName: "",
        storeId: "",
        storeName: "",
        comment: "",
      });
    } else {
      showToast("Ошибка создания накладной", "error");
    }
  };

  const total = items.reduce(
    (s, i) => s + (i.quantity || 0) * (i.price || 0),
    0
  );
  const storeEntries = Object.entries(stores);

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
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
            Приходные накладные
          </h2>
          <p style={{ margin: "3px 0 0", fontSize: 12, color: "#94a3b8" }}>
            POST /resto/api/documents/import/incomingInvoice
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {cart.length > 0 && mode === "list" && (
            <Btn outline onClick={startFromCart}>
              {I.cart} Из корзины ({cart.length})
            </Btn>
          )}
          {mode === "list" ? (
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
                setMode("list");
                setStep(0);
                setItems([]);
              }}
            >
              {I.x} Отмена
            </Btn>
          )}
        </div>
      </div>

      {mode === "new" ? (
        <div
          style={{
            background: "#fff",
            borderRadius: 14,
            border: "1px solid #e8ecf0",
            padding: 24,
            animation: "fadeIn .2s ease",
          }}
        >
          {/* Steps indicator */}
          <div style={{ display: "flex", gap: 4, marginBottom: 24 }}>
            {["Поставщик", "Склад", "Товары", "Подтверждение"].map((s, i) => (
              <div key={i} style={{ flex: 1, textAlign: "center" }}>
                <div
                  style={{
                    height: 3,
                    borderRadius: 2,
                    background: i <= step ? "#6366f1" : "#e2e8f0",
                    marginBottom: 6,
                    transition: "all .2s",
                  }}
                />
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: i === step ? 700 : 400,
                    color: i <= step ? "#6366f1" : "#94a3b8",
                  }}
                >
                  {s}
                </span>
              </div>
            ))}
          </div>

          {/* Step 0: Supplier */}
          {step === 0 && (
            <div>
              <label style={lbl}>Поставщик *</label>
              <p style={{ fontSize: 11, color: "#94a3b8", margin: "0 0 10px" }}>
                Только из ALLOWED_SUPPLIERS ({ALLOWED_SUPPLIERS.length} шт.)
              </p>
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
                    style={{
                      padding: "14px 16px",
                      borderRadius: 10,
                      border: "1px solid #e2e8f0",
                      background: "#fff",
                      cursor: "pointer",
                      textAlign: "left",
                      fontSize: 14,
                      fontWeight: 500,
                      transition: "all .15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#818cf8";
                      e.currentTarget.style.background = "#f8f7ff";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#e2e8f0";
                      e.currentTarget.style.background = "#fff";
                    }}
                  >
                    <div>{s.name}</div>
                    <div
                      style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}
                    >
                      ID: {s.id}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 1: Store */}
          {step === 1 && (
            <div>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
                ✅ Поставщик: <b>{form.supplierName}</b>
              </div>
              <label style={lbl}>Склад приёмки *</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {storeEntries.map(([id, name]) => (
                  <button
                    key={id}
                    onClick={() => {
                      setForm({ ...form, storeId: id, storeName: name });
                      setStep(2);
                    }}
                    style={{
                      padding: "12px 16px",
                      borderRadius: 10,
                      border: "1px solid #e2e8f0",
                      background: "#fff",
                      cursor: "pointer",
                      textAlign: "left",
                      fontSize: 14,
                      fontWeight: 500,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#818cf8";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#e2e8f0";
                    }}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Items input (AI parse — same as bot) */}
          {step === 2 && (
            <div>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>
                ✅ {form.supplierName} → {form.storeName}
              </div>
              <label style={{ ...lbl, marginTop: 16 }}>Введите товары</label>
              <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 8px" }}>
                Как в боте — AI (OpenRouter) распарсит текст. Пример:
              </p>
              <div
                style={{
                  background: "#f8f9fb",
                  borderRadius: 8,
                  padding: "10px 14px",
                  fontSize: 12,
                  color: "#64748b",
                  marginBottom: 12,
                  fontStyle: "italic",
                  lineHeight: 1.6,
                }}
              >
                помидоры 50кг 600000
                <br />
                лук 30 кг 150000
                <br />
                молоко 20л 900000
              </div>
              <p style={{ fontSize: 11, color: "#d97706", margin: "0 0 10px" }}>
                ⚠️ Число после количества = ОБЩАЯ СУММА (делится на кол-во →
                цена за ед.)
              </p>
              <textarea
                value={aiText}
                onChange={(e) => setAiText(e.target.value)}
                rows={5}
                placeholder="помидоры 50кг 600000&#10;лук 30 кг 150000"
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                  fontSize: 14,
                  outline: "none",
                  resize: "vertical",
                  lineHeight: 1.5,
                }}
                onFocus={(e) => (e.target.style.borderColor = "#818cf8")}
                onBlur={(e) => (e.target.style.borderColor = "#e2e8f0")}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <Btn outline onClick={() => setStep(1)}>
                  ← Назад
                </Btn>
                <Btn
                  onClick={handleAIParse}
                  disabled={parsing || !aiText.trim()}
                >
                  {parsing ? I.loader : I.sparkle}{" "}
                  {parsing ? "Парсинг..." : "Распарсить AI"}
                </Btn>
                <Btn outline onClick={() => setStep(3)}>
                  Ручной ввод →
                </Btn>
              </div>
            </div>
          )}

          {/* Step 3: Confirm */}
          {step === 3 && (
            <div>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
                ✅ {form.supplierName} → {form.storeName}
              </div>

              {/* Items table */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 10,
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 700 }}>
                  Позиции ({items.length})
                </span>
                <ProductPicker
                  products={products}
                  onAdd={(p) => {
                    setItems((prev) => {
                      const ex = prev.find((i) => i.product_id === p.id);
                      if (ex)
                        return prev.map((i) =>
                          i.product_id === p.id
                            ? { ...i, quantity: i.quantity + 1 }
                            : i
                        );
                      return [
                        ...prev,
                        {
                          product_id: p.id,
                          product_name: p.name,
                          quantity: 1,
                          unit: p.mainUnit || "шт",
                          price: 0,
                        },
                      ];
                    });
                  }}
                />
              </div>

              {items.length > 0 && (
                <div
                  style={{
                    border: "1px solid #e8ecf0",
                    borderRadius: 10,
                    overflow: "hidden",
                    marginBottom: 16,
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
                        <th style={{ ...th, textAlign: "center" }}>Кол-во</th>
                        <th style={{ ...th, textAlign: "right" }}>Цена/ед</th>
                        <th style={{ ...th, textAlign: "right" }}>Сумма</th>
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
                            {!it.product_id && (
                              <div style={{ fontSize: 10, color: "#ef4444" }}>
                                ⚠ не найден в iiko
                              </div>
                            )}
                          </td>
                          <td style={{ ...td, textAlign: "center" }}>
                            <QtyControl
                              value={it.quantity}
                              unit={it.unit}
                              onChange={(v) =>
                                setItems((p) =>
                                  p.map((x, i) =>
                                    i === idx ? { ...x, quantity: v } : x
                                  )
                                )
                              }
                            />
                          </td>
                          <td style={{ ...td, textAlign: "right" }}>
                            <input
                              type="number"
                              value={it.price}
                              onChange={(e) =>
                                setItems((p) =>
                                  p.map((x, i) =>
                                    i === idx
                                      ? {
                                          ...x,
                                          price:
                                            parseFloat(e.target.value) || 0,
                                        }
                                      : x
                                  )
                                )
                              }
                              style={{
                                width: 80,
                                padding: "4px 6px",
                                borderRadius: 6,
                                border: "1px solid #e2e8f0",
                                fontSize: 12,
                                textAlign: "right",
                                outline: "none",
                              }}
                            />
                          </td>
                          <td
                            style={{
                              ...td,
                              textAlign: "right",
                              fontWeight: 700,
                            }}
                          >
                            {fmt(it.quantity * it.price)}
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
                    <tfoot>
                      <tr style={{ borderTop: "2px solid #e8ecf0" }}>
                        <td
                          colSpan={3}
                          style={{ ...td, fontWeight: 700, textAlign: "right" }}
                        >
                          Итого:
                        </td>
                        <td
                          style={{
                            ...td,
                            fontWeight: 800,
                            fontSize: 14,
                            textAlign: "right",
                          }}
                        >
                          {fmtPrice(total)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* Comment */}
              <label style={lbl}>Комментарий</label>
              <input
                value={form.comment}
                onChange={(e) => setForm({ ...form, comment: e.target.value })}
                placeholder="Необязательно"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 9,
                  border: "1px solid #e2e8f0",
                  fontSize: 13,
                  outline: "none",
                  marginBottom: 16,
                }}
              />

              <div
                style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}
              >
                <Btn outline onClick={() => setStep(2)}>
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
            </div>
          )}
        </div>
      ) : (
        /* Invoice History */
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {DEMO_HISTORY.invoices.map((inv) => (
            <DocCard
              key={inv.id}
              icon={I.inbox}
              iconBg="#eff0ff"
              iconColor="#6366f1"
              title={inv.number}
              subtitle={`${inv.supplier} → ${inv.store}`}
              meta={`${fmtDate(inv.date)} · ${inv.items} позиций`}
              status={inv.status}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  TRANSFER VIEW — mirrors bot.py TransferFSM
//  Main store → Kitchen/Bar, via iikoWeb API
// ═══════════════════════════════════════════════════════════════

function TransferView({ products, stores, showToast, cart, setCart }) {
  const [mode, setMode] = useState("list");
  const [step, setStep] = useState(0); // 0: target, 1: items, 2: confirm
  const [form, setForm] = useState({ toId: "", toName: "", comment: "" });
  const [items, setItems] = useState([]);
  const [aiText, setAiText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const startFromCart = () => {
    setItems(
      cart.map((c) => ({
        product_id: c.id,
        product_name: c.name,
        quantity: c.qty,
        unit: c.unit,
      }))
    );
    setStep(0);
    setMode("new");
  };

  const handleAIParse = async () => {
    if (!aiText.trim()) return;
    setParsing(true);
    const result = await API.parseItems(aiText);
    if (result?.length) {
      setItems(result);
      setStep(2);
    } else {
      const lines = aiText.split("\n").filter(Boolean);
      const parsed = lines.map((line) => {
        const parts = line.trim().split(/\s+/);
        const name = parts[0] || "?";
        const qty = parseFloat(parts[1]) || 1;
        const unit = (parts[2] || "шт").replace(/[0-9]/g, "") || "шт";
        const match = products.find((p) =>
          p.name.toLowerCase().includes(name.toLowerCase())
        );
        return {
          product_id: match?.id || "",
          product_name: match?.name || name,
          quantity: qty,
          unit,
        };
      });
      setItems(parsed);
      setStep(2);
    }
    setParsing(false);
  };

  const handleSubmit = async () => {
    if (!form.toId || items.length === 0) {
      showToast("Заполните все поля", "error");
      return;
    }
    setSubmitting(true);
    // Calls iikoWeb: create INTERNAL_TRANSFER → save as PROCESSED
    const result = await API.createTransfer({
      store_from: MAIN_STORE_ID,
      store_to: form.toId,
      items,
      comment: form.comment,
    });
    setSubmitting(false);
    if (result?.success) {
      showToast("Перемещение проведено в iiko!");
      setMode("list");
      setStep(0);
      setItems([]);
      setForm({ toId: "", toName: "", comment: "" });
    } else {
      showToast("Ошибка перемещения", "error");
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
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
            Перемещения
          </h2>
          <p style={{ margin: "3px 0 0", fontSize: 12, color: "#94a3b8" }}>
            iikoWeb API → INTERNAL_TRANSFER (Основной склад → Кухня/Бар)
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {cart.length > 0 && mode === "list" && (
            <Btn outline onClick={startFromCart}>
              {I.cart} Из корзины ({cart.length})
            </Btn>
          )}
          {mode === "list" ? (
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
                setMode("list");
                setStep(0);
                setItems([]);
              }}
            >
              {I.x} Отмена
            </Btn>
          )}
        </div>
      </div>

      {mode === "new" ? (
        <div
          style={{
            background: "#fff",
            borderRadius: 14,
            border: "1px solid #e8ecf0",
            padding: 24,
            animation: "fadeIn .2s ease",
          }}
        >
          {/* Steps */}
          <div style={{ display: "flex", gap: 4, marginBottom: 24 }}>
            {["Куда", "Товары", "Подтверждение"].map((s, i) => (
              <div key={i} style={{ flex: 1, textAlign: "center" }}>
                <div
                  style={{
                    height: 3,
                    borderRadius: 2,
                    background: i <= step ? "#6366f1" : "#e2e8f0",
                    marginBottom: 6,
                  }}
                />
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: i === step ? 700 : 400,
                    color: i <= step ? "#6366f1" : "#94a3b8",
                  }}
                >
                  {s}
                </span>
              </div>
            ))}
          </div>

          {/* Step 0: Target store */}
          {step === 0 && (
            <div>
              <div
                style={{
                  background: "#f8f9fb",
                  borderRadius: 10,
                  padding: 14,
                  marginBottom: 16,
                  fontSize: 13,
                }}
              >
                <b>Откуда:</b> Основной склад{" "}
                <span style={{ fontSize: 10, color: "#94a3b8" }}>
                  ({MAIN_STORE_ID})
                </span>
              </div>
              <label style={lbl}>Куда переместить *</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {Object.entries(TRANSFER_TARGETS).map(([id, t]) => (
                  <button
                    key={id}
                    onClick={() => {
                      setForm({ ...form, toId: id, toName: t.name });
                      setStep(1);
                    }}
                    style={{
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
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#818cf8";
                      e.currentTarget.style.background = "#f8f7ff";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#e2e8f0";
                      e.currentTarget.style.background = "#fff";
                    }}
                  >
                    <span style={{ fontSize: 22 }}>{t.icon}</span>
                    <div>
                      <div>{t.name}</div>
                      <div style={{ fontSize: 10, color: "#94a3b8" }}>{id}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 1: Items */}
          {step === 1 && (
            <div>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
                ✅ Основной склад → <b>{form.toName}</b>
              </div>
              <label style={lbl}>Введите товары для перемещения</label>
              <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 8px" }}>
                Как в боте — без цен:
              </p>
              <div
                style={{
                  background: "#f8f9fb",
                  borderRadius: 8,
                  padding: "10px 14px",
                  fontSize: 12,
                  color: "#64748b",
                  marginBottom: 12,
                  fontStyle: "italic",
                  lineHeight: 1.6,
                }}
              >
                молоко 10л
                <br />
                сахар 5кг
                <br />
                лимон 20шт
              </div>
              <textarea
                value={aiText}
                onChange={(e) => setAiText(e.target.value)}
                rows={4}
                placeholder="молоко 10л&#10;сахар 5кг&#10;лимон 20шт"
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                  fontSize: 14,
                  outline: "none",
                  resize: "vertical",
                  lineHeight: 1.5,
                }}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <Btn outline onClick={() => setStep(0)}>
                  ← Назад
                </Btn>
                <Btn
                  onClick={handleAIParse}
                  disabled={parsing || !aiText.trim()}
                >
                  {parsing ? I.loader : I.sparkle}{" "}
                  {parsing ? "Парсинг..." : "Распарсить AI"}
                </Btn>
                <Btn outline onClick={() => setStep(2)}>
                  Ручной ввод →
                </Btn>
              </div>
            </div>
          )}

          {/* Step 2: Confirm */}
          {step === 2 && (
            <div>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
                ✅ Основной склад → <b>{form.toName}</b>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 10,
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 700 }}>
                  Позиции ({items.length})
                </span>
                <ProductPicker
                  products={products}
                  onAdd={(p) => {
                    setItems((prev) => {
                      const ex = prev.find((i) => i.product_id === p.id);
                      if (ex)
                        return prev.map((i) =>
                          i.product_id === p.id
                            ? { ...i, quantity: i.quantity + 1 }
                            : i
                        );
                      return [
                        ...prev,
                        {
                          product_id: p.id,
                          product_name: p.name,
                          quantity: 1,
                          unit: p.mainUnit || "шт",
                        },
                      ];
                    });
                  }}
                />
              </div>
              {items.length > 0 && (
                <div
                  style={{
                    border: "1px solid #e8ecf0",
                    borderRadius: 10,
                    overflow: "hidden",
                    marginBottom: 16,
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
                        <th style={{ ...th, textAlign: "center" }}>Кол-во</th>
                        <th style={{ ...th, textAlign: "right" }}>Ед.</th>
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
                            <span style={{ fontWeight: 500 }}>
                              {it.product_name}
                            </span>
                            {!it.product_id && (
                              <span
                                style={{
                                  fontSize: 10,
                                  color: "#ef4444",
                                  marginLeft: 6,
                                }}
                              >
                                ⚠
                              </span>
                            )}
                          </td>
                          <td style={{ ...td, textAlign: "center" }}>
                            <QtyControl
                              value={it.quantity}
                              unit={it.unit}
                              onChange={(v) =>
                                setItems((p) =>
                                  p.map((x, i) =>
                                    i === idx ? { ...x, quantity: v } : x
                                  )
                                )
                              }
                            />
                          </td>
                          <td
                            style={{
                              ...td,
                              textAlign: "right",
                              color: "#94a3b8",
                            }}
                          >
                            {it.unit}
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
              <label style={lbl}>Комментарий</label>
              <input
                value={form.comment}
                onChange={(e) => setForm({ ...form, comment: e.target.value })}
                placeholder="Необязательно"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 9,
                  border: "1px solid #e2e8f0",
                  fontSize: 13,
                  outline: "none",
                  marginBottom: 16,
                }}
              />
              <div
                style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}
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
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {DEMO_HISTORY.transfers.map((tr) => (
            <DocCard
              key={tr.id}
              icon={I.transfer}
              iconBg="#fef3f2"
              iconColor="#ef4444"
              title={tr.number}
              subtitle={
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  {tr.from} <span style={{ color: "#6366f1" }}>{I.arrow}</span>{" "}
                  {tr.to}
                </span>
              }
              meta={`${fmtDate(tr.date)} · ${tr.items} позиций`}
              status={tr.status}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════

function CartDrawer({ cart, updateQty, removeItem, onClose, setTab }) {
  const total = cart.reduce((s, i) => s + (i.price || 0) * i.qty, 0);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200 }}>
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.35)",
          backdropFilter: "blur(3px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: "min(400px, 88vw)",
          background: "#fff",
          boxShadow: "-6px 0 24px rgba(0,0,0,0.1)",
          display: "flex",
          flexDirection: "column",
          animation: "slideIn .2s ease",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #e8ecf0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
            Корзина ({cart.length})
          </h3>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#94a3b8",
            }}
          >
            {I.x}
          </button>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: "14px 20px" }}>
          {cart.length === 0 ? (
            <Empty
              icon="🛒"
              text="Корзина пуста"
              sub="Добавьте товары из каталога"
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {cart.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    gap: 10,
                    padding: 12,
                    background: "#f8fafb",
                    borderRadius: 10,
                    alignItems: "center",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                      {item.name}
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>
                      {item.unit}
                    </div>
                  </div>
                  <QtyControl
                    value={item.qty}
                    onChange={(v) => updateQty(item.id, v - item.qty)}
                  />
                  <button
                    onClick={() => removeItem(item.id)}
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
            </div>
          )}
        </div>
        {cart.length > 0 && (
          <div style={{ padding: "16px 20px", borderTop: "1px solid #e8ecf0" }}>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => {
                  setTab("incoming");
                  onClose();
                }}
                style={{
                  flex: 1,
                  padding: "11px 0",
                  borderRadius: 9,
                  border: "1px solid #6366f1",
                  background: "transparent",
                  color: "#6366f1",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Приход
              </button>
              <button
                onClick={() => {
                  setTab("transfer");
                  onClose();
                }}
                style={{
                  flex: 1,
                  padding: "11px 0",
                  borderRadius: 9,
                  border: "none",
                  background: "#6366f1",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Перемещение
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ProductPicker({ products, onAdd }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const filtered = products
    .filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 8);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          padding: "6px 12px",
          borderRadius: 7,
          border: "1px solid #e2e8f0",
          background: "#fff",
          color: "#6366f1",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        {I.plus} Добавить
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            width: 300,
            background: "#fff",
            borderRadius: 10,
            border: "1px solid #e2e8f0",
            boxShadow: "0 6px 20px rgba(0,0,0,0.08)",
            zIndex: 50,
            overflow: "hidden",
          }}
        >
          <div style={{ padding: 8 }}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Найти товар..."
              autoFocus
              style={{
                width: "100%",
                padding: "7px 10px",
                borderRadius: 7,
                border: "1px solid #e8ecf0",
                fontSize: 12,
                outline: "none",
              }}
            />
          </div>
          <div style={{ maxHeight: 220, overflow: "auto" }}>
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  onAdd(p);
                  setQ("");
                }}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  border: "none",
                  borderTop: "1px solid #f5f7f9",
                  background: "#fff",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  textAlign: "left",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "#f8fafb")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "#fff")
                }
              >
                <span style={{ fontWeight: 500 }}>{p.name}</span>
                <span style={{ color: "#94a3b8", fontSize: 11 }}>
                  {p.mainUnit || "шт"}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function QtyControl({ value, unit, onChange }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 2,
        background: "#f1f3f6",
        borderRadius: 7,
        padding: "2px 3px",
      }}
    >
      <button onClick={() => onChange(Math.max(0.5, value - 1))} style={qtyBtn}>
        {I.minus}
      </button>
      <span
        style={{
          fontSize: 13,
          fontWeight: 600,
          minWidth: 26,
          textAlign: "center",
        }}
      >
        {value}
      </span>
      <button onClick={() => onChange(value + 1)} style={qtyBtn}>
        {I.plus}
      </button>
    </div>
  );
}

function DocCard({ icon, iconBg, iconColor, title, subtitle, meta, status }) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 12,
        border: "1px solid #eef1f5",
        padding: "16px 20px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        transition: "box-shadow .15s",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.boxShadow = "0 2px 10px rgba(0,0,0,0.03)")
      }
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
    >
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: iconBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: iconColor,
          }}
        >
          {icon}
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{title}</div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
            {subtitle}
          </div>
          <div style={{ fontSize: 11, color: "#b0b8c4", marginTop: 2 }}>
            {meta}
          </div>
        </div>
      </div>
      <Badge status={status} />
    </div>
  );
}

function Empty({ icon, text, sub }) {
  return (
    <div
      style={{ textAlign: "center", padding: "50px 20px", color: "#94a3b8" }}
    >
      <div style={{ fontSize: 44, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 14, fontWeight: 500 }}>{text}</div>
      {sub && <div style={{ fontSize: 12, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function Btn({ children, outline, onClick, disabled }) {
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
      }}
    >
      {children}
    </button>
  );
}

// ─── Style helpers ───
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
const qtyBtn = {
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: 3,
  color: "#64748b",
  display: "flex",
};
