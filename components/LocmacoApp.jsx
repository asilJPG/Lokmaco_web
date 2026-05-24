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
};

export default function LocmacoApp() {
  const [tab, setTab] = useState("incoming");
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState(FALLBACK_SUPPLIERS);
  const [stores, setStores] = useState(FALLBACK_STORES);
  const [productsLoading, setProductsLoading] = useState(true);
  const [toast, setToast] = useState(null);

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

  useEffect(() => {
    loadData();
  }, []);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const tabs = [
    { id: "incoming", label: "Приход", icon: I.inbox },
    { id: "transfer", label: "Перемещение", icon: I.transfer },
  ];

  return (
    <div
      style={{
        fontFamily: "'DM Sans','Segoe UI',system-ui,sans-serif",
        minHeight: "100vh",
        background: "#f5f7fa",
        color: "#0f1729",
      }}
    >
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
            height: 60,
            padding: "0 20px",
            gap: 10,
          }}
        >
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
      </header>

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
              }}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <main
        style={{ maxWidth: 1120, margin: "0 auto", padding: "20px 20px 100px" }}
      >
        {tab === "incoming" && (
          <IncomingView
            products={products}
            suppliers={suppliers}
            stores={stores}
            showToast={showToast}
            loading={productsLoading}
            onRetry={loadData}
          />
        )}
        {tab === "transfer" && (
          <TransferView
            products={products}
            stores={stores}
            showToast={showToast}
            loading={productsLoading}
            onRetry={loadData}
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
      store_id: form.storeId,
      items: prepared,
      comment: form.comment,
    });
    setSubmitting(false);
    if (result?.success) {
      showToast("Накладная создана!");
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
      {mode === "idle" && <Empty icon="📄" text="Нажмите «Новый приход»" />}
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
                                <input
                                  type="number"
                                  value={it.quantity}
                                  onChange={(e) =>
                                    updateItem(idx, "quantity", e.target.value)
                                  }
                                  placeholder="0"
                                  style={numInput}
                                />
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

function TransferView({ products, stores, showToast, loading, onRetry }) {
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
      store_to: form.toId,
      items: prepared,
      comment: form.comment,
    });
    setSubmitting(false);
    if (result?.success) {
      showToast("Перемещение проведено!");
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
      {mode === "idle" && <Empty icon="📦" text="Нажмите «Новое»" />}
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
                                <input
                                  type="number"
                                  value={it.quantity}
                                  onChange={(e) =>
                                    updateItem(idx, "quantity", e.target.value)
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
