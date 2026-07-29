import { parseStringPromise } from 'xml2js';
import { withIikoSession, iikoGetText, iikoGet } from '@/lib/iiko';
import { resolveIikoCreds } from '@/lib/filial-iiko';

/** One purchase of an ingredient at a point in time. */
export type PricePoint = {
  date: string;
  price: number;
  amount: number;
  documentNumber: string;
  supplierId: string;
};

export type IngredientPrice = {
  productId: string;
  name: string;
  unit: string;
  /** Purchases over the period, oldest first. */
  points: PricePoint[];
  firstPrice: number;
  lastPrice: number;
  minPrice: number;
  maxPrice: number;
  /** Change from the first to the last purchase, %. */
  changePercent: number;
  /** Total money spent on this ingredient over the period. */
  totalSpend: number;
  purchases: number;
};

export type PriceAlert = {
  productId: string;
  name: string;
  unit: string;
  /** Median price of all earlier purchases in the period. */
  baselinePrice: number;
  /** Даты первой и последней «прошлой» закупки — чтобы «было» имело период. */
  baselineFrom: string;
  baselineTo: string;
  /** Сколько закупок усреднено в «было». */
  baselineCount: number;
  /** Price of the most recent purchase. */
  latestPrice: number;
  /** Дата закупки, которая стала «стало». */
  date: string;
  changePercent: number;
  documentNumber: string;
  /** Самая низкая цена за период и когда её давали. */
  bestPrice: number;
  bestDate: string;
  /** Extra money the new price costs at the period's purchase volume. */
  impact: number;
};

export type SupplierSpend = {
  supplierId: string;
  name: string;
  total: number;
  share: number;
  invoices: number;
  avgInvoice: number;
};

/** What overpaying relative to your own best price costs on one ingredient. */
export type SavingOpportunity = {
  productId: string;
  name: string;
  unit: string;
  bestPrice: number;
  /** Когда давали эту цену — чтобы было к чему апеллировать в переговорах. */
  bestDate: string;
  bestSupplier: string;
  avgPrice: number;
  latestPrice: number;
  latestDate: string;
  amount: number;
  purchases: number;
  /** Money back if the whole volume had been bought at the best own price. */
  saving: number;
};

export type PurchaseSummary = {
  total: number;
  invoices: number;
  suppliers: number;
  avgInvoice: number;
};

export type PricesReport = {
  summary: PurchaseSummary;
  supplierSpend: SupplierSpend[];
  savings: SavingOpportunity[];
  totalSaving: number;
  ingredients: IngredientPrice[];
  /** Plausible price movements, ranked by money at stake. */
  alerts: PriceAlert[];
  /** Jumps too large to be real prices — almost always a unit/packaging typo. */
  suspicious: PriceAlert[];
  /** Ingredients ranked by money spent — the ones worth watching. */
  topSpend: IngredientPrice[];
};

/**
 * A purchase price can realistically triple (seasonal berries), but a 100×
 * jump means the quantity was entered in boxes where it used to be pieces.
 */
const UNIT_ERROR_PERCENT = 200;

const UNIT_MAP: Record<string, string> = {
  '7ba81c3a-8de5-8f9d-fb9f-e39efcbc57cc': 'кг',
  '69859c74-db72-b006-cba5-326cf6f4fc6e': 'л',
  'cd19b5ea-1b32-a6e5-1df7-5d2784a0549a': 'шт',
  '109fb602-70ad-473d-ba1f-f037b6e72887': 'шт',
};

type IikoProduct = { id: string; name: string; mainUnit?: string };

type RawItem = {
  product?: string[];
  price?: string[];
  sum?: string[];
  amount?: string[];
  actualAmount?: string[];
  isAdditionalExpense?: string[];
};
type RawDoc = {
  incomingDate?: string[];
  documentNumber?: string[];
  status?: string[];
  supplier?: string[];
  items?: { item?: RawItem[] }[];
};

function first(v: string[] | undefined): string {
  return Array.isArray(v) && v.length > 0 ? String(v[0]) : '';
}

function num(v: string): number {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Builds an ingredient price timeline from iiko incoming invoices.
 *
 * `alertThreshold` is the percent jump between two consecutive purchases that
 * counts as an alert (10 = flag any change of 10% or more, up or down).
 */
export async function getIngredientPrices(
  filialId: number,
  from: string,
  to: string,
  alertThreshold = 10
): Promise<PricesReport> {
  const { xml: creds } = await resolveIikoCreds(filialId);

  return withIikoSession(async (token) => {
    const [xml, products, supplierXml] = await Promise.all([
      iikoGetText(`documents/export/incomingInvoice?from=${from}&to=${to}`, token, creds),
      iikoGet<IikoProduct[]>('v2/entities/products/list', token, creds),
      iikoGetText('suppliers', token, creds),
    ]);
    if (!xml) throw new Error('iiko вернул пустой список накладных');

    const names = new Map<string, { name: string; unit: string }>();
    for (const p of products || []) {
      names.set(p.id, { name: p.name, unit: p.mainUnit ? UNIT_MAP[p.mainUnit] || 'шт' : 'шт' });
    }

    const supplierNames = new Map<string, string>();
    if (supplierXml) {
      try {
        const parsedSuppliers = await parseStringPromise(supplierXml);
        const collect = (node: unknown): void => {
          if (Array.isArray(node)) return node.forEach(collect);
          if (!node || typeof node !== 'object') return;
          const o = node as Record<string, unknown>;
          const id = first(o.id as string[] | undefined);
          const name = first(o.name as string[] | undefined);
          if (id && name) supplierNames.set(id, name);
          Object.values(o).forEach(collect);
        };
        collect(parsedSuppliers);
      } catch {
        // Supplier names are a nicety — the report still works with raw ids.
      }
    }

    const parsed = await parseStringPromise(xml);
    const docs: RawDoc[] = parsed?.incomingInvoiceDtoes?.document || [];

    const byProduct = new Map<string, PricePoint[]>();
    const bySupplier = new Map<string, { total: number; invoices: number }>();
    let purchaseTotal = 0;
    let invoiceCount = 0;

    for (const doc of docs) {
      // Draft/deleted invoices carry prices that were never actually paid.
      if (first(doc.status) !== 'PROCESSED') continue;
      const date = first(doc.incomingDate);
      const documentNumber = first(doc.documentNumber);
      const supplierId = first(doc.supplier);
      const items = doc.items?.[0]?.item || [];

      invoiceCount++;
      // The invoice total includes delivery lines: it is what was actually paid,
      // even though those lines are excluded from per-ingredient pricing below.
      const docTotal = items.reduce((s, it) => s + num(first(it.sum)), 0);
      purchaseTotal += docTotal;
      const sup = bySupplier.get(supplierId) || { total: 0, invoices: 0 };
      sup.total += docTotal;
      sup.invoices++;
      bySupplier.set(supplierId, sup);

      for (const it of items) {
        const productId = first(it.product);
        if (!productId) continue;
        // Delivery/service lines carry a sum but no real ingredient quantity.
        if (first(it.isAdditionalExpense) === 'true') continue;

        const amount = num(first(it.actualAmount) || first(it.amount));
        if (amount <= 0) continue;

        // The `price` field is per *packaging unit* (a 25kg sack and a 50kg sack
        // of the same flour show 220000 and 440000 for an unchanged 8800/kg), so
        // it cannot be compared across purchases. Dividing the line total by the
        // quantity always yields the price per base unit.
        const price = num(first(it.sum)) / amount;
        if (!Number.isFinite(price) || price <= 0) continue;

        const arr = byProduct.get(productId) || [];
        arr.push({ date, price, amount, documentNumber, supplierId });
        byProduct.set(productId, arr);
      }
    }

    const ingredients: IngredientPrice[] = [];
    const alerts: PriceAlert[] = [];

    for (const [productId, rawPoints] of byProduct) {
      const points = [...rawPoints].sort((a, b) => a.date.localeCompare(b.date));
      const meta = names.get(productId);
      const name = meta?.name || productId.slice(0, 8);
      const unit = meta?.unit || 'шт';

      const prices = points.map((p) => p.price);
      const firstPrice = prices[0];
      const lastPrice = prices[prices.length - 1];

      ingredients.push({
        productId,
        name,
        unit,
        points,
        firstPrice,
        lastPrice,
        minPrice: Math.min(...prices),
        maxPrice: Math.max(...prices),
        changePercent: firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0,
        totalSpend: points.reduce((s, p) => s + p.price * p.amount, 0),
        purchases: points.length,
      });

      // Comparing consecutive purchases floods the list: an ingredient bought
      // alternately from two suppliers oscillates between two known prices and
      // would alert on every swing. What matters is whether the latest price
      // broke away from the norm, so each ingredient yields at most one alert:
      // last purchase vs. the median of the earlier ones (median, not average,
      // so the oscillation itself doesn't drag the baseline around).
      if (points.length >= 2) {
        const earlierPoints = points.slice(0, -1);
        const earlier = earlierPoints.map((p) => p.price).sort((a, b) => a - b);
        const mid = Math.floor(earlier.length / 2);
        const baselinePrice = earlier.length % 2 === 0 ? (earlier[mid - 1] + earlier[mid]) / 2 : earlier[mid];
        const last = points[points.length - 1];
        if (baselinePrice > 0) {
          const changePercent = ((lastPrice - baselinePrice) / baselinePrice) * 100;
          if (Math.abs(changePercent) >= alertThreshold) {
            const totalAmount = points.reduce((s, p) => s + p.amount, 0);
            const cheapest = points.reduce((a, b) => (b.price < a.price ? b : a));
            alerts.push({
              productId,
              name,
              unit,
              baselinePrice,
              baselineFrom: earlierPoints[0].date,
              baselineTo: earlierPoints[earlierPoints.length - 1].date,
              baselineCount: earlierPoints.length,
              latestPrice: lastPrice,
              date: last.date,
              changePercent,
              documentNumber: last.documentNumber,
              bestPrice: cheapest.price,
              bestDate: cheapest.date,
              impact: (lastPrice - baselinePrice) * totalAmount,
            });
          }
        }
      }
    }

    ingredients.sort((a, b) => b.totalSpend - a.totalSpend);
    // Rank by money at stake, not by percent: a 15% rise on flour hurts more
    // than a 60% rise on something bought twice a year.
    const byImpact = (a: PriceAlert, b: PriceAlert) => Math.abs(b.impact) - Math.abs(a.impact);
    const real = alerts.filter((a) => Math.abs(a.changePercent) <= UNIT_ERROR_PERCENT).sort(byImpact);
    const suspicious = alerts.filter((a) => Math.abs(a.changePercent) > UNIT_ERROR_PERCENT).sort(byImpact);

    const supplierSpend: SupplierSpend[] = [...bySupplier.entries()]
      .map(([supplierId, s]) => ({
        supplierId,
        name: supplierNames.get(supplierId) || 'Без поставщика',
        total: s.total,
        share: purchaseTotal > 0 ? (s.total / purchaseTotal) * 100 : 0,
        invoices: s.invoices,
        avgInvoice: s.invoices > 0 ? s.total / s.invoices : 0,
      }))
      .sort((a, b) => b.total - a.total);

    // What the same volume would have cost at the cheapest price already paid
    // for that ingredient — an upper bound on what better buying could save.
    // Prices far above the norm are unit-entry errors, not real overpayment, so
    // they are left out to keep the figure honest.
    const savings: SavingOpportunity[] = ingredients
      .filter((g) => g.purchases >= 2 && g.minPrice > 0 && g.maxPrice / g.minPrice <= 1 + UNIT_ERROR_PERCENT / 100)
      .map((g) => {
        const amount = g.points.reduce((s, p) => s + p.amount, 0);
        const saving = g.points.reduce((s, p) => s + (p.price - g.minPrice) * p.amount, 0);
        const cheapest = g.points.reduce((a, b) => (b.price < a.price ? b : a));
        const last = g.points[g.points.length - 1];
        return {
          productId: g.productId,
          name: g.name,
          unit: g.unit,
          bestPrice: g.minPrice,
          bestDate: cheapest.date,
          bestSupplier: supplierNames.get(cheapest.supplierId) || '—',
          avgPrice: amount > 0 ? g.totalSpend / amount : 0,
          latestPrice: g.lastPrice,
          latestDate: last.date,
          amount,
          purchases: g.purchases,
          saving,
        };
      })
      .filter((s) => s.saving > 0)
      .sort((a, b) => b.saving - a.saving);

    return {
      summary: {
        total: purchaseTotal,
        invoices: invoiceCount,
        suppliers: bySupplier.size,
        avgInvoice: invoiceCount > 0 ? purchaseTotal / invoiceCount : 0,
      },
      supplierSpend,
      savings,
      totalSaving: savings.reduce((s, x) => s + x.saving, 0),
      ingredients,
      alerts: real,
      suspicious,
      topSpend: ingredients.slice(0, 5),
    };
  }, creds);
}
