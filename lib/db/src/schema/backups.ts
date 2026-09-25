import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

/** Device data backups, keyed by a hash of the user's secret backup code. */
export const backupsTable = pgTable("backups", {
  /** sha256 hex of the backup code — the code itself is never stored. */
  id: text("id").primaryKey(),
  data: text("data").notNull(),
  size: integer("size").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Backup = typeof backupsTable.$inferSelect;
