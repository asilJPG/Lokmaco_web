import { db, schema } from '@/db/client';

export type Payments = {
  cash: number;
  encashment: number;
  uzcard: number;
  humo: number;
  online: number;
  rahmat: number;
  uzum: number;
  yandex: number;
};

export type ExpenseLine = { name: string; amount: number };
export type WageLine = { employeeId: string; name: string; wage: number };

export type CashSubmission = {
  filialId: number;
  date: string;
  payments: Partial<Payments>;
  expenses: ExpenseLine[];
  surplus: number;
  shortage: number;
  comment: string;
  employeeWages: WageLine[];
  userId: number;
  userName: string;
  userTgId: number | null;
};

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

function pad(n: number): string { return String(n).padStart(2, '0'); }

function makeDocNumber(): string {
  const now = new Date(Date.now() + 5 * 3600_000);
  return `CSH-${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
}

export async function submitCashReport(s: CashSubmission) {
  const p: Payments = {
    cash: num(s.payments.cash),
    encashment: num(s.payments.encashment),
    uzcard: num(s.payments.uzcard),
    humo: num(s.payments.humo),
    online: num(s.payments.online),
    rahmat: num(s.payments.rahmat),
    uzum: num(s.payments.uzum),
    yandex: num(s.payments.yandex),
  };
  const totalSales = Object.values(p).reduce((sum, v) => sum + v, 0);
  const totalExpenses = s.expenses.reduce((sum, e) => sum + num(e.amount), 0);
  const surplus = num(s.surplus);
  const shortage = num(s.shortage);
  const diff = surplus - shortage;
  const iikoCash = totalSales - diff;

  const createdAt = new Date(`${s.date}T12:00:00+05:00`);
  const docNumber = makeDocNumber();

  await db.insert(schema.cashReports).values({
    filialId: s.filialId,
    cashierTgId: s.userTgId,
    cashierName: s.userName,
    reportedCash: Math.round(totalSales),
    iikoCash: Math.round(iikoCash),
    difference: Math.round(diff),
    createdAt,
  });

  const [row] = await db.insert(schema.botActions).values({
    filialId: s.filialId,
    tgId: s.userTgId,
    userName: s.userName,
    actionType: 'cash',
    documentNumber: docNumber,
    createdAt,
    details: {
      payments: p,
      expenses: s.expenses.map((e) => ({ name: e.name || 'Расход', amount: num(e.amount) })),
      employee_wages: s.employeeWages.map((w) => ({ employeeId: w.employeeId, name: w.name, wage: num(w.wage) })),
      total_sales: totalSales,
      total_expenses: totalExpenses,
      surplus,
      shortage,
      difference: diff,
      iiko_cash: iikoCash,
      comment: s.comment || '',
      selected_date: s.date,
    },
  }).returning({ id: schema.botActions.id });

  return { id: row.id, documentNumber: docNumber };
}
