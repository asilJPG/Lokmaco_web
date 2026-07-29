import { withIikoSession, type IikoCreds } from './iiko';

const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// iiko отдаёт единицу измерения идентификатором, а справочника единиц в API нет.
const UNIT_MAP: Record<string, string> = {
  '7ba81c3a-8de5-8f9d-fb9f-e39efcbc57cc': 'кг',
  '69859c74-db72-b006-cba5-326cf6f4fc6e': 'л',
  'cd19b5ea-1b32-a6e5-1df7-5d2784a0549a': 'шт',
  '6040d92d-e286-f4f9-a613-ed0e6fd241e1': 'порц',
  'effa6e01-7c7c-4195-8ba7-8a0158b636a0': 'м',
  '109fb602-70ad-473d-ba1f-f037b6e72887': 'пачка',
};

export type SoldDish = { id: string; name: string; code: string; quantity: number };
export type IngredientRow = { id: string; name: string; code: string; quantity: number; unit: string; price: number; cost: number };
export type WriteoffRow = { date: string; number: string; storeName: string; accountName: string; productName: string; code: string; quantity: number; cost: number };
export type TaxReport = { sales: SoldDish[]; ingredients: IngredientRow[]; writeoffs: WriteoffRow[] };

type Product = { id: string; name: string; code: string; unit: string };
type ChartItem = { productId: string; amountIn?: number | string };
type Chart = { assembledProductId: string; assembledAmount?: number | string; dateFrom?: string; dateTo?: string; items?: ChartItem[] };

function tag(xml: string, name: string): string {
  const m = xml.match(new RegExp(`<${name}>([^<]*)</${name}>`));
  return m ? m[1].trim() : '';
}

export async function getTaxReport(from: string, to: string, creds: IikoCreds): Promise<TaxReport> {
  return withIikoSession(async (token) => {
    const get = (path: string, accept = 'application/json') =>
      fetch(`${creds.server}${path}`, { headers: { Cookie: `key=${token}`, Accept: accept, 'User-Agent': BROWSER_UA } });

    const [productsRes, chartsRes, writeoffRes, accountsRes, storesRes, balanceRes, salesRes] = await Promise.all([
      get('/resto/api/v2/entities/products/list?includeDeleted=true'),
      get(`/resto/api/v2/assemblyCharts/getAll?dateFrom=${from}&dateTo=${to}&includeDeletedProducts=true&includePreparedCharts=true`),
      get(`/resto/api/v2/documents/writeoff?dateFrom=${from}&dateTo=${to}`),
      get('/resto/api/v2/entities/list?rootType=Account'),
      get('/resto/api/corporation/stores', 'application/xml'),
      get(`/resto/api/v2/reports/balance/stores?timestamp=${to}T23:59:59`),
      fetch(`${creds.server}/resto/api/v2/reports/olap`, {
        method: 'POST',
        headers: { Cookie: `key=${token}`, 'Content-Type': 'application/json', 'User-Agent': BROWSER_UA },
        body: JSON.stringify({
          reportType: 'SALES',
          buildSummary: 'true',
          groupByRowFields: ['DishId', 'DishName', 'DishCode'],
          groupByColFields: [],
          aggregateFields: ['DishAmountInt'],
          filters: {
            'OpenDate.Typed': { filterType: 'DateRange', periodType: 'CUSTOM', from, to, includeLow: 'true', includeHigh: 'true' },
            DeletedWithWriteoff: { filterType: 'ExcludeValues', values: ['DELETED_WITHOUT_WRITEOFF'] },
          },
        }),
      }),
    ]);

    const productsMap = new Map<string, Product>();
    if (productsRes.ok) {
      for (const p of (await productsRes.json()) as { id: string; name: string; code?: string; mainUnit?: string }[]) {
        productsMap.set(p.id, { id: p.id, name: p.name, code: p.code || '', unit: p.mainUnit ? UNIT_MAP[p.mainUnit] || 'шт' : 'шт' });
      }
    }

    // У блюда может быть несколько техкарт с разными периодами действия;
    // сортируем по dateFrom вниз, чтобы первой подошла самая свежая подходящая.
    const chartsMap = new Map<string, Chart[]>();
    if (chartsRes.ok) {
      const data = (await chartsRes.json()) as { assemblyCharts?: Chart[] };
      for (const chart of data.assemblyCharts || []) {
        const list = chartsMap.get(chart.assembledProductId) || [];
        list.push(chart);
        chartsMap.set(chart.assembledProductId, list);
      }
      for (const list of chartsMap.values()) {
        list.sort((a, b) => (b.dateFrom || '').localeCompare(a.dateFrom || ''));
      }
    }

    const accountsMap = new Map<string, string>();
    if (accountsRes.ok) {
      for (const a of (await accountsRes.json()) as { id: string; name: string }[]) accountsMap.set(a.id, a.name);
    }

    const storesMap = new Map<string, string>();
    if (storesRes.ok) {
      const xml = await storesRes.text();
      const re = /<corporateItemDto>([\s\S]*?)<\/corporateItemDto>/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(xml)) !== null) {
        const id = tag(m[1], 'id');
        const name = tag(m[1], 'name');
        if (id && name && tag(m[1], 'type') === 'STORE') storesMap.set(id, name);
      }
    }

    // Цена ингредиента — средневзвешенная по остаткам на конец периода.
    // Строки, где знаки количества и суммы расходятся, отбрасываем: это
    // технические записи, они портят среднюю.
    const avgPrice = new Map<string, number>();
    if (balanceRes.ok) {
      const acc = new Map<string, { amount: number; sum: number }>();
      for (const item of (await balanceRes.json()) as { product: string; amount: number | string; sum: number | string }[]) {
        const amount = parseFloat(String(item.amount)) || 0;
        const sum = parseFloat(String(item.sum)) || 0;
        if (amount === 0 || sum === 0) continue;
        if (!((amount > 0 && sum > 0) || (amount < 0 && sum < 0))) continue;
        const cur = acc.get(item.product) || { amount: 0, sum: 0 };
        cur.amount += Math.abs(amount);
        cur.sum += Math.abs(sum);
        acc.set(item.product, cur);
      }
      for (const [id, v] of acc) if (v.amount > 0) avgPrice.set(id, v.sum / v.amount);
    }

    // Разворачиваем блюдо до сырья: если у продукта есть действующая на дату
    // техкарта — уходим в её состав, иначе это и есть закупаемый ингредиент.
    const ingredients = new Map<string, number>();
    function expand(productId: string, quantity: number, dateStr: string, path: Set<string>) {
      if (path.has(productId)) return; // циклическая техкарта
      const target = dateStr.substring(0, 10);
      const active = (chartsMap.get(productId) || []).find((c) => {
        const f = c.dateFrom ? c.dateFrom.substring(0, 10) : '';
        const t = c.dateTo ? c.dateTo.substring(0, 10) : '';
        return (!f || f <= target) && (!t || t >= target);
      });
      if (active?.items?.length) {
        const yieldAmount = parseFloat(String(active.assembledAmount ?? 1)) || 1;
        for (const it of active.items) {
          const ingQty = parseFloat(String(it.amountIn ?? 0)) || 0;
          expand(it.productId, quantity * (ingQty / yieldAmount), dateStr, new Set([...path, productId]));
        }
      } else {
        ingredients.set(productId, (ingredients.get(productId) || 0) + quantity);
      }
    }

    const sales: SoldDish[] = [];
    if (salesRes.ok) {
      const json = (await salesRes.json()) as { data?: Record<string, unknown>[] };
      for (const row of json.data || []) {
        const qty = parseFloat(String(row.DishAmountInt ?? 0)) || 0;
        if (qty <= 0) continue;
        sales.push({ id: String(row.DishId), name: String(row.DishName), code: String(row.DishCode ?? ''), quantity: qty });
        expand(String(row.DishId), qty, to, new Set());
      }
    }

    const ingredientRows: IngredientRow[] = [];
    for (const [id, qty] of ingredients) {
      const p = productsMap.get(id) || { id, name: `Неизвестный ингредиент (${id.substring(0, 8)})`, code: '', unit: 'шт' };
      const price = avgPrice.get(id) || 0;
      ingredientRows.push({ id, name: p.name, code: p.code, quantity: qty, unit: p.unit, price, cost: qty * price });
    }

    const writeoffs: WriteoffRow[] = [];
    if (writeoffRes.ok) {
      const json = (await writeoffRes.json()) as {
        response?: { dateIncoming?: string; documentNumber?: string; storeId?: string; accountId?: string; items?: { productId: string; amount?: number | string; cost?: number | string }[] }[];
      };
      for (const doc of json.response || []) {
        for (const it of doc.items || []) {
          const p = productsMap.get(it.productId);
          writeoffs.push({
            date: (doc.dateIncoming || '').substring(0, 10),
            number: doc.documentNumber || '',
            storeName: storesMap.get(doc.storeId || '') || 'Неизвестный склад',
            accountName: accountsMap.get(doc.accountId || '') || 'Неизвестный счет',
            productName: p?.name || `Неизвестный товар (${it.productId.substring(0, 8)})`,
            code: p?.code || '',
            quantity: parseFloat(String(it.amount ?? 0)) || 0,
            cost: parseFloat(String(it.cost ?? 0)) || 0,
          });
        }
      }
    }

    sales.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    ingredientRows.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    writeoffs.sort((a, b) => a.date.localeCompare(b.date) || a.number.localeCompare(b.number));

    return { sales, ingredients: ingredientRows, writeoffs };
  }, creds);
}
