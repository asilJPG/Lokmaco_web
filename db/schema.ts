import { pgTable, serial, bigint, bigserial, text, integer, numeric, date, jsonb, timestamp, uuid, varchar, primaryKey, index, uniqueIndex } from 'drizzle-orm/pg-core';

export const filials = pgTable('filials', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  iikoServer: text('iiko_server'),
  iikoOrgId: text('iiko_org_id'),
  iikoLogin: text('iiko_login'),
  iikoPasswordEnc: text('iiko_password_enc'),
  iikoWebUrl: text('iiko_web_url'),
  iikoWebLogin: text('iiko_web_login'),
  iikoWebPasswordEnc: text('iiko_web_password_enc'),
  timezone: text('timezone').notNull().default('Asia/Tashkent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable('bot_users', {
  id: serial('id').primaryKey(),
  tgId: bigint('tg_id', { mode: 'number' }).notNull().unique(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  accessCode: text('access_code'),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  lastLoginMethod: text('last_login_method'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const userFilials = pgTable('user_filials', {
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  filialId: integer('filial_id').notNull().references(() => filials.id, { onDelete: 'cascade' }),
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.filialId] }),
  byFilial: index('user_filials_filial_idx').on(t.filialId),
}));

export const userPasskeys = pgTable('user_passkeys', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  credentialId: text('credential_id').notNull().unique(),
  publicKey: text('public_key').notNull(),
  counter: bigint('counter', { mode: 'number' }).notNull().default(0),
  // Домен, на котором ключ зарегистрирован. WebAuthn-ключ работает только на
  // своём домене, а таблица общая с легаси-сайтом; у легаси-ключей здесь NULL.
  rpId: text('rp_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  byUser: index('passkeys_user_idx').on(t.userId),
}));

export const botActions = pgTable('bot_actions', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  filialId: integer('filial_id').notNull().references(() => filials.id),
  tgId: bigint('tg_id', { mode: 'number' }),
  userName: text('user_name'),
  actionType: text('action_type').notNull(),
  documentNumber: text('document_number'),
  details: jsonb('details').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  byFilialType: index('bot_actions_filial_type_idx').on(t.filialId, t.actionType, t.createdAt),
  bySelectedDate: index('bot_actions_selected_date_idx').on(t.filialId, t.actionType),
  byCreated: index('bot_actions_created_idx').on(t.createdAt),
}));

export const cashReports = pgTable('cash_reports', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  filialId: integer('filial_id').notNull().references(() => filials.id),
  cashierTgId: bigint('cashier_tg_id', { mode: 'number' }),
  cashierName: text('cashier_name'),
  reportedCash: bigint('reported_cash', { mode: 'number' }).notNull().default(0),
  iikoCash: bigint('iiko_cash', { mode: 'number' }).notNull().default(0),
  difference: bigint('difference', { mode: 'number' }).notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  byFilialDate: index('cash_reports_filial_date_idx').on(t.filialId, t.createdAt),
}));

export const pendingTransfers = pgTable('pending_transfers', {
  id: uuid('id').primaryKey().defaultRandom(),
  filialId: integer('filial_id').notNull().references(() => filials.id),
  creatorTgId: text('creator_tg_id').notNull(),
  creatorName: text('creator_name').notNull(),
  creatorRole: text('creator_role'),
  storeFrom: uuid('store_from').notNull(),
  storeFromName: text('store_from_name').notNull(),
  storeTo: uuid('store_to').notNull(),
  storeToName: text('store_to_name').notNull(),
  items: jsonb('items').notNull().default([]),
  comment: text('comment'),
  receiverComment: text('receiver_comment'),
  status: text('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  byFilialStatus: index('pending_transfers_filial_status_idx').on(t.filialId, t.status),
}));

// Опись основных средств. Таблица общая с легаси-сайтом и без filial_id —
// колонки описаны ровно те, что уже есть в базе, чтобы не трогать её схему.
export const assets = pgTable('assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  invNumber: varchar('inv_number').notNull(),
  name: varchar('name').notNull(),
  category: varchar('category'),
  location: varchar('location').notNull(),
  responsiblePerson: varchar('responsible_person').notNull(),
  quantity: integer('quantity').default(1),
  initialCost: numeric('initial_cost').default('0'),
  commissioningDate: date('commissioning_date'),
  status: varchar('status').default('in_use'),
  serialNumber: varchar('serial_number'),
  notes: text('notes'),
  photoUrl: text('photo_url'),
  lastInventoriedAt: timestamp('last_inventoried_at', { withTimezone: true }),
  /** Место размещения. Текстовое `location` остаётся: в него пишет легаси-бот. */
  locationId: uuid('location_id'),
  /**
   * Откуда карточка: `iiko` — из справочника, `manual` — завели на сайте.
   * Сверка архивирует только импортные: заведённого руками в iiko нет по
   * определению, и без признака оно уезжало бы в архив на первой же сверке.
   */
  source: text('source').notNull().default('iiko'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

/** Места размещения ОС. Плоский список: «Кухня», «Бар», «Зал». */
export const assetLocations = pgTable('asset_locations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  note: text('note').notNull().default(''),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Универсальные QR-наклейки.
 *
 * Печатаются пачкой **пустыми** (`LKM-0001…`) и клеятся на что угодно;
 * привязка к единице происходит потом, когда предмет уже перед глазами.
 * Обратный порядок — «сгенерил под позицию → пошёл искать, к чему приклеить» —
 * и рождает путаницу, которую потом не выловить.
 */
export const assetTags = pgTable('asset_tags', {
  code: text('code').primaryKey(),
  assetId: uuid('asset_id'),
  batch: text('batch').notNull().default(''),
  boundAt: timestamp('bound_at', { withTimezone: true }),
  boundBy: text('bound_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Счётчик неудачных входов, общий для всех инстансов (см. lib/rate-limit.ts).
 * Таблица наша, легаси о ней не знает — своих вставок туда нет.
 */
export const loginAttempts = pgTable('login_attempts', {
  key: text('key').primaryKey(),
  attempts: integer('attempts').notNull().default(0),
  resetAt: timestamp('reset_at', { withTimezone: true }).notNull(),
});

/**
 * Общий кэш ответов iiko (см. lib/iiko-cache.ts).
 *
 * Раньше справочники кэшировались обычной Map в памяти процесса. На Vercel
 * инстансов десятки и они постоянно поднимаются заново, поэтому такая Map почти
 * всегда пустая: за каждый чих платили полный круг auth + запрос в iiko. Кэш в
 * БД переживает холодный старт и общий для всех инстансов сразу.
 *
 * Таблица наша, легаси о ней не знает — своих вставок туда нет.
 * Ключ составной: один и тот же справочник у разных филиалов свой (креды и
 * сервер iiko у них разные).
 */
export const iikoCache = pgTable('iiko_cache', {
  key: text('key').notNull(),
  filialId: integer('filial_id').notNull(),
  payload: jsonb('payload').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.key, t.filialId] }),
}));

/**
 * Входящие сканы накладных: МФУ шлёт скан на почту, почтовый провайдер дёргает
 * вебхук, вложение ложится сюда и распознаётся. Снабженец потом открывает
 * готовый черновик, а не грузит файл руками.
 *
 * Таблица наша, легаси о ней не знает.
 */
export const scanInbox = pgTable('scan_inbox', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  filialId: integer('filial_id').notNull(),
  fromEmail: text('from_email'),
  subject: text('subject'),
  photoPath: text('photo_path').notNull(),
  parsed: jsonb('parsed'),
  parseError: text('parse_error'),
  /** new — ждёт оформления · used — приход создан · dismissed — отклонён. */
  status: text('status').notNull().default('new'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  handledAt: timestamp('handled_at', { withTimezone: true }),
  handledBy: text('handled_by'),
}, (t) => ({
  byFilialStatus: index('scan_inbox_filial_status_idx').on(t.filialId, t.status, t.createdAt),
}));

export type Asset = typeof assets.$inferSelect;
export type AssetLocation = typeof assetLocations.$inferSelect;
export type AssetTag = typeof assetTags.$inferSelect;
export type Filial = typeof filials.$inferSelect;
export type User = typeof users.$inferSelect;
export type BotAction = typeof botActions.$inferSelect;
export type CashReport = typeof cashReports.$inferSelect;
