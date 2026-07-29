import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db, schema } from '@/db/client';

export type AdminExpense = {
  id: number;
  date: string;
  name: string;
  amount: number;
  userName: string | null;
  createdAt: Date;
};

export async function listAdminExpenses(filialIds: number[], from: string, to: string): Promise<AdminExpense[]> {
  if (filialIds.length === 0) return [];
  const dateExpr = sql<string>`coalesce(${schema.botActions.details}->>'selected_date', to_char(${schema.botActions.createdAt} at time zone 'Asia/Tashkent', 'YYYY-MM-DD'))`;

  const rows = await db
    .select({
      id: schema.botActions.id,
      date: dateExpr,
      name: sql<string>`${schema.botActions.details}->>'name'`,
      amount: sql<string>`${schema.botActions.details}->>'amount'`,
      userName: schema.botActions.userName,
      createdAt: schema.botActions.createdAt,
    })
    .from(schema.botActions)
    .where(
      and(
        inArray(schema.botActions.filialId, filialIds),
        eq(schema.botActions.actionType, 'admin_expense'),
        sql`${dateExpr} between ${from} and ${to}`
      )
    )
    .orderBy(desc(dateExpr), desc(schema.botActions.id));

  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    name: r.name || 'Расход',
    amount: Number(r.amount) || 0,
    userName: r.userName,
    createdAt: r.createdAt,
  }));
}

export async function createAdminExpense(input: {
  filialId: number;
  date: string;
  name: string;
  amount: number;
  userId: number;
  userName: string;
  userTgId: number | null;
}) {
  const createdAt = new Date(`${input.date}T12:00:00+05:00`);
  const [row] = await db.insert(schema.botActions).values({
    filialId: input.filialId,
    tgId: input.userTgId,
    userName: input.userName,
    actionType: 'admin_expense',
    documentNumber: `EXP-${Date.now()}`,
    createdAt,
    details: {
      name: input.name,
      amount: input.amount,
      selected_date: input.date,
    },
  }).returning({ id: schema.botActions.id });
  return row;
}

export async function deleteAdminExpense(id: number, filialIds: number[]) {
  if (filialIds.length === 0) return 0;
  const res = await db.delete(schema.botActions).where(
    and(
      eq(schema.botActions.id, id),
      eq(schema.botActions.actionType, 'admin_expense'),
      inArray(schema.botActions.filialId, filialIds)
    )
  );
  return res.rowCount ?? 0;
}
