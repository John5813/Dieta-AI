import { pgTable, text, integer, real, timestamp } from "drizzle-orm/pg-core";

/**
 * Packaged products by barcode: cached Open Food Facts hits plus products
 * users typed in from the label, so the next person scanning finds them.
 * Nutrition is per 100 g (or 100 ml).
 */
export const barcodeProductsTable = pgTable("barcode_products", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  brand: text("brand"),
  unit: text("unit").notNull().default("g"),
  cal100: real("cal_100").notNull(),
  protein100: real("protein_100").notNull().default(0),
  carbs100: real("carbs_100").notNull().default(0),
  fat100: real("fat_100").notNull().default(0),
  sugar100: real("sugar_100"),
  sodiumMg100: real("sodium_mg_100"),
  servingGrams: real("serving_grams"),
  /** "off" (Open Food Facts) or "user". */
  source: text("source").notNull(),
  scanCount: integer("scan_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type BarcodeProduct = typeof barcodeProductsTable.$inferSelect;
