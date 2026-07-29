import { eq } from 'drizzle-orm';
import { db, schema } from '@/db/client';
import { decrypt } from './crypto';
import { getDefaultCreds, type IikoCreds } from './iiko';
import { getDefaultWebCreds, type IikoWebCreds } from './iiko-web';

export async function loadFilialIikoCreds(filialId: number): Promise<{ xml: IikoCreds; web: IikoWebCreds } | null> {
  const [f] = await db.select().from(schema.filials).where(eq(schema.filials.id, filialId)).limit(1);
  if (!f) return null;

  const xml: IikoCreds = {
    server: (f.iikoServer || '').replace(/\/+$/, ''),
    login: f.iikoLogin || '',
    password: decrypt(f.iikoPasswordEnc) || '',
  };
  const web: IikoWebCreds = {
    url: (f.iikoWebUrl || '').replace(/\/+$/, ''),
    login: f.iikoWebLogin || '',
    password: decrypt(f.iikoWebPasswordEnc) || '',
  };

  return { xml, web };
}

export async function resolveIikoCreds(filialId: number): Promise<{ xml: IikoCreds; web: IikoWebCreds }> {
  const filial = await loadFilialIikoCreds(filialId);
  const defaults = { xml: getDefaultCreds(), web: getDefaultWebCreds() };
  return {
    xml: filial?.xml.server && filial.xml.login && filial.xml.password ? filial.xml : defaults.xml,
    web: filial?.web.url && filial.web.login && filial.web.password ? filial.web : defaults.web,
  };
}
