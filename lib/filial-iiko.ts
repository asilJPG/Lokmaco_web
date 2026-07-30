import { eq } from 'drizzle-orm';
import { db, schema } from '@/db/client';
import { decrypt } from './crypto';
import { getDefaultCreds, type IikoCreds } from './iiko';
import { getDefaultWebCreds, type IikoWebCreds } from './iiko-web';

export type FilialCreds = { xml: IikoCreds; web: IikoWebCreds };

// Реквизиты филиала читались из БД на каждый запрос к iiko — это ~200 мс на
// круг до пулера, а роутов, которым они нужны, больше полусотни. Меняются они
// только со страницы «Филиалы», которая сама сбрасывает кэш.
const cache = new Map<number, { data: FilialCreds | null; at: number }>();
const TTL = 5 * 60_000;

export function invalidateFilialCreds(filialId?: number): void {
  if (filialId === undefined) cache.clear();
  else cache.delete(filialId);
}

export async function loadFilialIikoCreds(filialId: number): Promise<FilialCreds | null> {
  const hit = cache.get(filialId);
  if (hit && Date.now() - hit.at < TTL) return hit.data;

  const [f] = await db.select().from(schema.filials).where(eq(schema.filials.id, filialId)).limit(1);
  if (!f) {
    cache.set(filialId, { data: null, at: Date.now() });
    return null;
  }

  const data: FilialCreds = {
    xml: {
      server: (f.iikoServer || '').replace(/\/+$/, ''),
      login: f.iikoLogin || '',
      password: decrypt(f.iikoPasswordEnc) || '',
    },
    web: {
      url: (f.iikoWebUrl || '').replace(/\/+$/, ''),
      login: f.iikoWebLogin || '',
      password: decrypt(f.iikoWebPasswordEnc) || '',
    },
  };
  cache.set(filialId, { data, at: Date.now() });
  return data;
}

export async function resolveIikoCreds(filialId: number): Promise<FilialCreds> {
  const filial = await loadFilialIikoCreds(filialId);
  const defaults = { xml: getDefaultCreds(), web: getDefaultWebCreds() };
  return {
    xml: filial?.xml.server && filial.xml.login && filial.xml.password ? filial.xml : defaults.xml,
    web: filial?.web.url && filial.web.login && filial.web.password ? filial.web : defaults.web,
  };
}
