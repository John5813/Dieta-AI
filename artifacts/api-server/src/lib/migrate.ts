import { DatabaseSync } from "node:sqlite";
import path from "path";
import { logger } from "./logger";

/**
 * Yangi jadvallarni SQLite ga qo'shish (agar mavjud bo'lmasa).
 * Har server ishga tushganda xavfsiz ishlaydi (CREATE TABLE IF NOT EXISTS).
 */
export function runMigrations() {
  const dbPath = process.env.DB_PATH || "./data/dieta.db";

  try {
    const sqlite = new DatabaseSync(path.resolve(dbPath));

    // bot_users jadvali — broadcast uchun barcha bot foydalanuvchilari
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS bot_users (
        chat_id   TEXT PRIMARY KEY,
        username  TEXT,
        name      TEXT,
        first_seen INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
        last_seen  INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
      )
    `);

    logger.info("DB migrations bajarildi");
  } catch (err) {
    logger.error({ err }, "DB migration xatosi");
  }
}
