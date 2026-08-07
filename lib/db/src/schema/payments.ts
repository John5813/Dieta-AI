import { pgTable, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const paymentsTable = pgTable("payments", {
  id: text("id").primaryKey(),
  linkToken: text("link_token").notNull().unique(),

  telegramChatId: text("telegram_chat_id"),
  telegramUsername: text("telegram_username"),
  telegramName: text("telegram_name"),

  name: text("name"),
  phone: text("phone"),

  amount: integer("amount").notNull(),
  originalAmount: integer("original_amount"),
  paidAmount: integer("paid_amount").notNull().default(0),
  promoCode: text("promo_code"),
  status: text("status").notNull().default("pending"),

  receiptFileId: text("receipt_file_id"),
  adminChatId: text("admin_chat_id"),
  adminMessageId: integer("admin_message_id"),

  login: text("login").unique(),
  passwordHash: text("password_hash"),
  passwordSalt: text("password_salt"),
  passwordUsed: boolean("password_used").notNull().default(false),

  approvedAt: timestamp("approved_at"),
  rejectedAt: timestamp("rejected_at"),
  redeemedAt: timestamp("redeemed_at"),
  premiumUntil: timestamp("premium_until"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPaymentSchema = createInsertSchema(paymentsTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof paymentsTable.$inferSelect;
