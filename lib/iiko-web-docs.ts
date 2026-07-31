import { withIikoWebSession, iikoWebFetch, type IikoWebCreds } from './iiko-web';
import { tashkentStamps } from './tashkent';

const STORE_NUM = process.env.IIKO_STORE_NUM || '170243';
const CONCEPTION_ID = process.env.IIKO_CONCEPTION_ID || '2609b25f-2180-bf98-5c1c-967664eea837';
const CONTAINER_ID = process.env.IIKO_CONTAINER_ID || '7ba81c3a-8de5-8f9d-fb9f-e39efcbc57cc';
const KITCHEN_PREP_STORE = process.env.IIKO_KITCHEN_PREP_STORE || '2e9688bb-5130-4188-94a5-7a850e1d9f55';

const nowDates = tashkentStamps;

export type DocItem = { product_id: string; product_name?: string; quantity: number; price?: number };

type CreateOpts = {
  type: 'INTERNAL_TRANSFER' | 'INVENTORY' | 'PRODUCTION_DOCUMENT' | 'INCOMING_INVOICE';
  comment: string;
  storeFrom?: string;
  storeTo?: string;
  storeId?: string;
  supplier?: string;
  items: DocItem[];
};

export async function submitDocument(opts: CreateOpts, creds: IikoWebCreds): Promise<{ success: boolean; documentNumber?: string; error?: string }> {
  return withIikoWebSession(async (cookies, url) => {
    const { dateIncoming, dateIncomingMs } = nowDates();

    const baseBody: Record<string, unknown> = {
      type: opts.type,
      documentNumber: '',
      status: 'DRAFT',
      comment: opts.comment,
      conception: CONCEPTION_ID,
      dateIncoming,
      store: STORE_NUM,
      editable: true,
      isAutomatic: false,
    };

    if (opts.type === 'INTERNAL_TRANSFER') {
      baseBody.storageFrom = opts.storeFrom;
      baseBody.storageTo = opts.storeTo;
    } else if (opts.type === 'INVENTORY') {
      baseBody.storage = opts.storeId;
    } else if (opts.type === 'PRODUCTION_DOCUMENT') {
      baseBody.accountFrom = KITCHEN_PREP_STORE;
      baseBody.accountTo = KITCHEN_PREP_STORE;
      baseBody.items = opts.items.map((it) => ({
        id: null, storage: null, actualAmount: 0, amount: it.quantity, code: '', product: it.product_id,
      }));
    } else if (opts.type === 'INCOMING_INVOICE') {
      baseBody.supplier = opts.supplier;
      baseBody.defaultStore = opts.storeId;
    }

    const createRes = await iikoWebFetch(`${url}/api/documents/create`, { method: 'POST', cookies, body: JSON.stringify(baseBody) });
    const createData = await createRes.json<any>();
    if (createRes.status !== 200 || createData.error) return { success: false, error: createData.error || 'create failed' };

    const docId = createData.data.id;
    const docNumber = createData.data.documentNumber;
    await iikoWebFetch(`${url}/api/documents/get/${docId}?type=${opts.type}`, { cookies });

    const saveItems = opts.items.map((it) => {
      const base = {
        product: it.product_id,
        amount: it.quantity,
        count: it.quantity,
        containerId: CONTAINER_ID,
        unitName: CONTAINER_ID,
        isDeleted: false,
      };
      if (opts.type === 'INCOMING_INVOICE') {
        const price = it.price || 0;
        return { ...base, price, sum: price * it.quantity, store: opts.storeId || STORE_NUM };
      }
      return base;
    });

    const saveBody: Record<string, unknown> = {
      ...baseBody,
      documentNumber: docNumber,
      status: 'PROCESSED',
      dateIncoming: dateIncomingMs,
      items: saveItems,
      validation: false,
    };

    const saveRes = await iikoWebFetch(`${url}/api/documents/save/${docId}`, { method: 'POST', cookies, body: JSON.stringify(saveBody) });
    const saveData = await saveRes.json<any>();
    if (saveRes.status === 200 && !saveData.error) return { success: true, documentNumber: docNumber };
    return { success: false, error: saveData.error || 'save failed' };
  }, creds);
}
