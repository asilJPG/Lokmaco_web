import { withIikoSession, type IikoCreds } from '@/lib/iiko';
import { withIikoWebSession, iikoWebFetch, type IikoWebCreds } from '@/lib/iiko-web';
import { resolveIikoCreds } from '@/lib/filial-iiko';

const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** Ликвид → расходуется быстрее нормы, неликвид → лежит больше двух норм. */
export type StockStatus = 'liquid' | 'slow' | 'dead' | 'idle';

export type StockItem = {
  productId: string;
  name: string;
  unit: string;
  category: string;
  store: string;
  balanceAmount: number;
  balanceSum: number;
  consumedAmount: number;
  consumedSum: number;
  /** На сколько дней хватит текущего остатка при нынешнем темпе расхода. */
  turnoverDays: number | null;
  /** Коэффициент оборачиваемости запасов: сколько раз обернули запас за окно. */
  koz: number;
  status: StockStatus;
};

export type StoreGroup = {
  store: string;
  items: StockItem[];
  balanceSum: number;
  consumedSum: number;
  koz: number;
  byStatus: Record<StockStatus, { count: number; sum: number }>;
  /** Деньги, замороженные в неликвиде и позициях без движения. */
  freeable: number;
};

export type LiquidityReport = {
  windowDays: number;
  normDays: number;
  stores: StoreGroup[];
  items: StockItem[];
  totals: {
    balanceSum: number;
    consumedSum: number;
    koz: number;
    positions: number;
    byStatus: Record<StockStatus, { count: number; sum: number }>;
    freeable: number;
  };
  /** Топ позиций, из которых можно высвободить деньги. */
  topFreeable: StockItem[];
};

type BalanceItem = {
  product?: { id?: string; name?: string; mainUnitName?: string; categoryName?: string };
  amount?: number;
  sum?: number;
};
type StoreBalance = { storage?: { name?: string }; balanceItems?: BalanceItem[] };

function num(v: unknown): number {
  const n = parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
}

function emptyStatuses(): Record<StockStatus, { count: number; sum: number }> {
  return {
    liquid: { count: 0, sum: 0 },
    slow: { count: 0, sum: 0 },
    dead: { count: 0, sum: 0 },
    idle: { count: 0, sum: 0 },
  };
}

async function fetchConsumption(creds: IikoCreds, from: string, to: string) {
  return withIikoSession(async (token) => {
    const res = await fetch(`${creds.server}/resto/api/v2/reports/olap`, {
      method: 'POST',
      headers: { Cookie: `key=${token}`, 'Content-Type': 'application/json', 'User-Agent': BROWSER_UA },
      body: JSON.stringify({
        reportType: 'TRANSACTIONS',
        buildSummary: 'false',
        groupByRowFields: ['Product.Id', 'Store'],
        aggregateFields: ['Amount', 'Sum.ResignedSum'],
        filters: {
          'DateTime.Typed': { filterType: 'DateRange', periodType: 'CUSTOM', from, to, includeLow: 'true', includeHigh: 'false' },
          // Продажи списывают ингредиенты сессией, ручные списания — отдельным
          // типом; вместе это и есть расход склада за период.
          TransactionType: { filterType: 'IncludeValues', values: ['SESSION_WRITEOFF', 'WRITEOFF'] },
        },
      }),
    });
    if (!res.ok) throw new Error(`iiko olap ${res.status}`);
    const json = await res.json();
    const map = new Map<string, { amount: number; sum: number }>();
    for (const r of (json.data ?? []) as Record<string, unknown>[]) {
      const id = String(r['Product.Id'] ?? '');
      const store = String(r['Store'] ?? '');
      if (!id) continue;
      // Приход по той же позиции гасит часть расхода; интересует чистый отток,
      // поэтому положительный нетто трактуем как «не расходовали».
      const amount = Math.max(0, -num(r['Amount']));
      const sum = Math.max(0, -num(r['Sum.ResignedSum']));
      const key = `${id}|${store}`;
      const prev = map.get(key) || { amount: 0, sum: 0 };
      map.set(key, { amount: prev.amount + amount, sum: prev.sum + sum });
    }
    return map;
  }, creds);
}

async function fetchBalances(creds: IikoWebCreds): Promise<StoreBalance[]> {
  return withIikoWebSession(async (cookies, url) => {
    const res = await iikoWebFetch(`${url}/api/lite-stock/store-balance?limit=10000&offset=0`, { cookies });
    if (!res.ok) throw new Error(`iikoWeb ${res.status}`);
    const json = await res.json<{ data?: StoreBalance[] }>();
    return json.data ?? [];
  }, creds);
}

function statusOf(turnoverDays: number | null, consumedAmount: number, normDays: number): StockStatus {
  if (consumedAmount <= 0) return 'idle';
  if (turnoverDays == null) return 'idle';
  if (turnoverDays <= normDays) return 'liquid';
  if (turnoverDays <= normDays * 2) return 'slow';
  return 'dead';
}

export async function getLiquidity(filialId: number, windowDays = 30, normDays = 30): Promise<LiquidityReport> {
  const { xml, web } = await resolveIikoCreds(filialId);

  const to = new Date(Date.now() + 5 * 3600_000);
  const from = new Date(to.getTime() - windowDays * 86400_000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const [consumption, balances] = await Promise.all([
    fetchConsumption(xml, iso(from), iso(to)),
    fetchBalances(web),
  ]);

  const items: StockItem[] = [];
  for (const st of balances) {
    const store = st.storage?.name || '—';
    for (const b of st.balanceItems ?? []) {
      const productId = b.product?.id || '';
      if (!productId) continue;
      const balanceAmount = num(b.amount);
      const balanceSum = num(b.sum);
      // Нулевые остатки только зашумляют таблицу — их не показываем.
      if (balanceAmount <= 0 && balanceSum <= 0) continue;

      const used = consumption.get(`${productId}|${store}`) || { amount: 0, sum: 0 };
      const dailyUse = used.amount / windowDays;
      const turnoverDays = dailyUse > 0 ? balanceAmount / dailyUse : null;

      items.push({
        productId,
        name: b.product?.name || '—',
        unit: b.product?.mainUnitName || '',
        category: b.product?.categoryName || '',
        store,
        balanceAmount,
        balanceSum,
        consumedAmount: used.amount,
        consumedSum: used.sum,
        turnoverDays,
        // Средний запас принимаем равным текущему: снимка на начало окна нет.
        koz: balanceSum > 0 ? used.sum / balanceSum : 0,
        status: statusOf(turnoverDays, used.amount, normDays),
      });
    }
  }

  items.sort((a, b) => b.balanceSum - a.balanceSum);

  const groups = new Map<string, StockItem[]>();
  for (const it of items) {
    const arr = groups.get(it.store) || [];
    arr.push(it);
    groups.set(it.store, arr);
  }

  const stores: StoreGroup[] = [...groups.entries()]
    .map(([store, list]) => {
      const byStatus = emptyStatuses();
      for (const it of list) {
        byStatus[it.status].count++;
        byStatus[it.status].sum += it.balanceSum;
      }
      const balanceSum = list.reduce((s, i) => s + i.balanceSum, 0);
      const consumedSum = list.reduce((s, i) => s + i.consumedSum, 0);
      return {
        store,
        items: list,
        balanceSum,
        consumedSum,
        koz: balanceSum > 0 ? consumedSum / balanceSum : 0,
        byStatus,
        freeable: byStatus.dead.sum + byStatus.idle.sum,
      };
    })
    .sort((a, b) => b.balanceSum - a.balanceSum);

  const byStatus = emptyStatuses();
  for (const it of items) {
    byStatus[it.status].count++;
    byStatus[it.status].sum += it.balanceSum;
  }
  const balanceSum = items.reduce((s, i) => s + i.balanceSum, 0);
  const consumedSum = items.reduce((s, i) => s + i.consumedSum, 0);

  return {
    windowDays,
    normDays,
    stores,
    items,
    totals: {
      balanceSum,
      consumedSum,
      koz: balanceSum > 0 ? consumedSum / balanceSum : 0,
      positions: items.length,
      byStatus,
      freeable: byStatus.dead.sum + byStatus.idle.sum,
    },
    topFreeable: items
      .filter((i) => i.status === 'dead' || i.status === 'idle')
      .sort((a, b) => b.balanceSum - a.balanceSum)
      .slice(0, 5),
  };
}
