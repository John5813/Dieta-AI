import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const botUsersTable = pgTable("bot_users", {
  chatId: text("chat_id").primaryKey(),
  username: text("username"),
  name: text("name"),
  firstSeen: timestamp("first_seen").notNull().defaultNow(),
  lastSeen: timestamp("last_seen").notNull().defaultNow(),
});

export type BotUser = typeof botUsersTable.$inferSelect;
