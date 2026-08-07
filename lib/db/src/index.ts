import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

// DigitalOcean / boshqa managed Postgres'lar SSL talab qiladi. Replit'ning
// lokal dev bazasi esa SSL'ni qo'llab-quvvatlamaydi. Shuning uchun faqat
// production'da yoki connection string'da sslmode bo'lsa SSL yoqamiz.
const connectionString = process.env.DATABASE_URL?.trim();
const hasDatabaseConfig = Boolean(connectionString);
const needsSsl =
  hasDatabaseConfig &&
  (process.env.NODE_ENV === "production" ||
    /sslmode=require|ssl=true/i.test(connectionString ?? ""));

export const pool = hasDatabaseConfig
  ? new Pool({
      connectionString: connectionString!,
      ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
    })
  : null;

const configuredDb = hasDatabaseConfig ? drizzle(pool!, { schema }) : null;
type Database = NonNullable<typeof configuredDb>;

function createUnavailableDb(): Database {
  return new Proxy({} as Database, {
    get() {
      return () => {
        throw new Error(
          "Database is not configured. Set DATABASE_URL to enable persistence.",
        );
      };
    },
  });
}

export const db: Database = configuredDb ?? createUnavailableDb();

/**
 * Jadvallar mavjudligini kafolatlaydi (idempotent).
 * Production'da migratsiya alohida ishlatilmagani uchun server ishga
 * tushganda kerakli jadvallarni yaratadi. `IF NOT EXISTS` tufayli xavfsiz.
 */
export async function ensureSchema(): Promise<void> {
  if (!pool) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("DATABASE_URL is required in production");
    }
    return;
  }

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS payments (
      id text PRIMARY KEY,
      link_token text NOT NULL UNIQUE,
      telegram_chat_id text,
      telegram_username text,
      telegram_name text,
      name text,
      phone text,
      amount integer NOT NULL,
      paid_amount integer NOT NULL DEFAULT 0,
      status text NOT NULL DEFAULT 'pending',
      receipt_file_id text,
      admin_chat_id text,
      admin_message_id integer,
      login text UNIQUE,
      password_hash text,
      password_salt text,
      password_used boolean NOT NULL DEFAULT false,
      approved_at timestamp,
      rejected_at timestamp,
      redeemed_at timestamp,
      premium_until timestamp,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    );
  `);
  // Mavjud (eski) jadvallarga yangi ustunni xavfsiz qo'shamiz —
  // CREATE TABLE IF NOT EXISTS mavjud jadvalga ustun qo'shmaydi.
  await db.execute(sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS paid_amount integer NOT NULL DEFAULT 0;`);
  await db.execute(sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS original_amount integer;`);
  await db.execute(sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS promo_code text;`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bot_users (
      chat_id text PRIMARY KEY,
      username text,
      name text,
      first_seen timestamp NOT NULL DEFAULT now(),
      last_seen timestamp NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS promo_codes (
      code text PRIMARY KEY,
      discount integer NOT NULL,
      description text,
      used_count integer NOT NULL DEFAULT 0,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamp NOT NULL DEFAULT now()
    );
  `);
}

export * from "./schema";
