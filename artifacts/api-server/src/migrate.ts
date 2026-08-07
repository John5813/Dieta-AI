import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "fs";
import path from "path";

const dbPath = process.env.DB_PATH || "./data/dieta.db";

// Ensure the data directory exists before opening the database
mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS payments (
    id                 TEXT PRIMARY KEY,
    link_token         TEXT NOT NULL UNIQUE,
    telegram_chat_id   TEXT,
    telegram_username  TEXT,
    telegram_name      TEXT,
    name               TEXT,
    phone              TEXT,
    amount             INTEGER NOT NULL,
    status             TEXT NOT NULL DEFAULT 'pending',
    receipt_file_id    TEXT,
    admin_chat_id      TEXT,
    admin_message_id   INTEGER,
    login              TEXT UNIQUE,
    password_hash      TEXT,
    password_salt      TEXT,
    password_used      INTEGER NOT NULL DEFAULT 0,
    approved_at        INTEGER,
    rejected_at        INTEGER,
    redeemed_at        INTEGER,
    premium_until      INTEGER,
    created_at         INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at         INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )
`);

console.log("[migrate] SQLite database ready at", path.resolve(dbPath));
db.close();
