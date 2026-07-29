import { and, eq, inArray, or, sql } from 'drizzle-orm';
import { db, schema } from '@/db/client';

export type TransferItem = {
  product_id: string;
  product_name: string;
  quantity: number;
  unit: string;
  received_quantity?: number | null;
};

export type PendingTransfer = {
  id: string;
  filialId: number;
  creatorTgId: string | null;
  creatorName: string | null;
  creatorRole: string | null;
  storeFrom: string | null;
  storeFromName: string | null;
  storeTo: string | null;
  storeToName: string | null;
  items: TransferItem[];
  comment: string | null;
  receiverComment: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

function rowToPending(r: typeof schema.pendingTransfers.$inferSelect): PendingTransfer {
  return {
    id: r.id,
    filialId: r.filialId,
    creatorTgId: r.creatorTgId,
    creatorName: r.creatorName,
    creatorRole: r.creatorRole,
    storeFrom: r.storeFrom,
    storeFromName: r.storeFromName,
    storeTo: r.storeTo,
    storeToName: r.storeToName,
    items: Array.isArray(r.items) ? (r.items as TransferItem[]) : [],
    comment: r.comment,
    receiverComment: r.receiverComment,
    status: r.status,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export async function listPendingTransfers(filialIds: number[]): Promise<PendingTransfer[]> {
  if (filialIds.length === 0) return [];
  const rows = await db
    .select()
    .from(schema.pendingTransfers)
    .where(
      and(
        inArray(schema.pendingTransfers.filialId, filialIds),
        or(
          eq(schema.pendingTransfers.status, 'pending_receiver'),
          eq(schema.pendingTransfers.status, 'pending_sender'),
          eq(schema.pendingTransfers.status, 'pending_creator')
        )!
      )
    )
    .orderBy(sql`${schema.pendingTransfers.createdAt} desc`);
  return rows.map(rowToPending);
}

export async function getPendingTransferById(id: string): Promise<PendingTransfer | null> {
  const [r] = await db.select().from(schema.pendingTransfers).where(eq(schema.pendingTransfers.id, id)).limit(1);
  return r ? rowToPending(r) : null;
}

export async function createPendingTransfer(input: {
  filialId: number;
  creatorTgId: string | null;
  creatorName: string;
  creatorRole: string;
  storeFrom: string;
  storeFromName: string;
  storeTo: string;
  storeToName: string;
  items: TransferItem[];
  comment: string;
  status: string;
}) {
  const [row] = await db.insert(schema.pendingTransfers).values({
    filialId: input.filialId,
    creatorTgId: input.creatorTgId ?? 'unknown',
    creatorName: input.creatorName,
    creatorRole: input.creatorRole,
    storeFrom: input.storeFrom,
    storeFromName: input.storeFromName,
    storeTo: input.storeTo,
    storeToName: input.storeToName,
    items: input.items,
    comment: input.comment,
    status: input.status,
  }).returning({ id: schema.pendingTransfers.id });
  return row;
}

export async function updatePendingTransfer(id: string, status: string, patch?: { items?: TransferItem[]; receiverComment?: string }) {
  const update: Record<string, unknown> = { status, updatedAt: new Date() };
  if (patch?.items) update.items = patch.items;
  if (patch?.receiverComment !== undefined) update.receiverComment = patch.receiverComment;
  await db.update(schema.pendingTransfers).set(update).where(eq(schema.pendingTransfers.id, id));
}
