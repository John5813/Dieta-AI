import { pgTable, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const promoCodesTable = pgTable("promo_codes", {
  code: text("code").primaryKey(),
  discount: integer("discount").notNull(),
  description: text("description"),
  usedCount: integer("used_count").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type PromoCode = typeof promoCodesTable.$inferSelect;
