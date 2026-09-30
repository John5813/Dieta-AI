import { pgTable, text, integer, bigint, bigserial, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * Premium orders paid on the website (Click, Payme, Uzum, card).
 * The order number is what payment providers see as the account / merchant
 * transaction id. The status page is protected by a random token whose
 * sha256 is stored in `secretHash`.
 */
export const webOrdersTable = pgTable("web_orders", {
  no: bigserial("no", { mode: "number" }).primaryKey(),
  secretHash: text("secret_hash").notNull(),
  plan: text("plan").notNull(),
  months: integer("months").notNull(),
  /** Price in so'm. */
  amount: integer("amount").notNull(),
  provider: text("provider").notNull(),
  /** created → paid → (refunded) ; created → cancelled */
  status: text("status").notNull().default("created"),
  lang: text("lang").notNull().default("uz"),
  /** Login that gets premium: freshly generated, or an existing one being extended. */
  login: text("login").notNull(),
  isRenewal: integer("is_renewal").notNull().default(0),
  /** New-account password, AES-GCM encrypted with a key derived from the status-page token. */
  passwordEnc: text("password_enc"),
  passwordHash: text("password_hash"),
  passwordSalt: text("password_salt"),
  paymentId: text("payment_id"),
  paidAt: timestamp("paid_at"),
  cancelledAt: timestamp("cancelled_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type WebOrder = typeof webOrdersTable.$inferSelect;

/**
 * One row per provider-side transaction. Amounts are in tiyin (so'm × 100)
 * and times in unix milliseconds, which is what Payme's protocol expects.
 * State: 1 created, 2 performed, -1 cancelled before perform, -2 cancelled after.
 */
export const payTransactionsTable = pgTable(
  "pay_transactions",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    provider: text("provider").notNull(),
    extId: text("ext_id").notNull(),
    orderNo: bigint("order_no", { mode: "number" }).notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(),
    state: integer("state").notNull().default(1),
    extTime: bigint("ext_time", { mode: "number" }),
    createTime: bigint("create_time", { mode: "number" }).notNull(),
    performTime: bigint("perform_time", { mode: "number" }).notNull().default(0),
    cancelTime: bigint("cancel_time", { mode: "number" }).notNull().default(0),
    reason: integer("reason"),
    extra: text("extra"),
  },
  (t) => [uniqueIndex("pay_transactions_provider_ext").on(t.provider, t.extId)],
);

export type PayTransaction = typeof payTransactionsTable.$inferSelect;
