import { and, eq, gte, lte, asc } from "drizzle-orm";
import { db, payTransactionsTable, type PayTransaction } from "@workspace/db";

export type Provider = "click" | "payme" | "uzum" | "card";

export async function findTx(provider: Provider, extId: string): Promise<PayTransaction | undefined> {
  const rows = await db
    .select()
    .from(payTransactionsTable)
    .where(and(eq(payTransactionsTable.provider, provider), eq(payTransactionsTable.extId, extId)));
  return rows[0];
}

export async function findTxById(id: number): Promise<PayTransaction | undefined> {
  if (!Number.isSafeInteger(id) || id <= 0) return undefined;
  const rows = await db.select().from(payTransactionsTable).where(eq(payTransactionsTable.id, id));
  return rows[0];
}

export async function activeTxForOrder(provider: Provider, orderNo: number): Promise<PayTransaction | undefined> {
  const rows = await db
    .select()
    .from(payTransactionsTable)
    .where(
      and(
        eq(payTransactionsTable.provider, provider),
        eq(payTransactionsTable.orderNo, orderNo),
        eq(payTransactionsTable.state, 1),
      ),
    );
  return rows[0];
}

/** Inserts a new transaction; if a concurrent request already created it, returns that one. */
export async function insertTx(values: {
  provider: Provider;
  extId: string;
  orderNo: number;
  amount: number;
  extTime?: number | null;
  extra?: string | null;
}): Promise<PayTransaction> {
  const inserted = await db
    .insert(payTransactionsTable)
    .values({ ...values, state: 1, createTime: Date.now() })
    .onConflictDoNothing()
    .returning();
  if (inserted[0]) return inserted[0];
  return (await findTx(values.provider, values.extId))!;
}

export async function updateTx(id: number, patch: Partial<Pick<PayTransaction, "state" | "performTime" | "cancelTime" | "reason" | "extra">>) {
  const rows = await db.update(payTransactionsTable).set(patch).where(eq(payTransactionsTable.id, id)).returning();
  return rows[0]!;
}

/** Moves a transaction from `from` state to `to` only if nobody else did first. */
export async function transitionTx(
  id: number,
  from: number,
  patch: Partial<Pick<PayTransaction, "state" | "performTime" | "cancelTime" | "reason" | "extra">>,
): Promise<PayTransaction | undefined> {
  const rows = await db
    .update(payTransactionsTable)
    .set(patch)
    .where(and(eq(payTransactionsTable.id, id), eq(payTransactionsTable.state, from)))
    .returning();
  return rows[0];
}

export async function txByExtTime(provider: Provider, from: number, to: number): Promise<PayTransaction[]> {
  return db
    .select()
    .from(payTransactionsTable)
    .where(
      and(
        eq(payTransactionsTable.provider, provider),
        gte(payTransactionsTable.extTime, from),
        lte(payTransactionsTable.extTime, to),
      ),
    )
    .orderBy(asc(payTransactionsTable.extTime));
}
