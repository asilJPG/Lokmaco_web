import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const globalForDb = globalThis as unknown as { pool?: Pool };

const isRemote = /supabase\.com|pooler\./.test(process.env.DATABASE_URL || '');

// Пул держим на globalThis и в проде тоже: маршруты Next собираются в отдельные
// бандлы, и без этого каждый заводил бы свой пул — лишние коннекты к пулеру и
// холодный TLS-хендшейк (первый запрос стоит ~1.8 с против ~200 мс на прогретом).
const pool = globalForDb.pool ?? new Pool({
  connectionString: process.env.DATABASE_URL,
  // Transaction pooler режет общее число коннектов, а инстансов на Vercel много,
  // поэтому на инстанс берём немного.
  max: 5,
  idleTimeoutMillis: 30_000,
  keepAlive: true,
  ssl: isRemote ? { rejectUnauthorized: false } : undefined,
});

globalForDb.pool = pool;

export const db = drizzle(pool, { schema });
export { schema };
