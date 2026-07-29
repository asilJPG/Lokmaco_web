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
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export type Asset = typeof assets.$inferSelect;
export type Filial = typeof filials.$inferSelect;
export type User = typeof users.$inferSelect;
export type BotAction = typeof botActions.$inferSelect;
export type CashReport = typeof cashReports.$inferSelect;
