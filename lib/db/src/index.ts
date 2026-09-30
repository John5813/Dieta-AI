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
  await db.execute(sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS restore_count integer NOT NULL DEFAULT 0;`);
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
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS barcode_products (
      code text PRIMARY KEY,
      name text NOT NULL,
      brand text,
      unit text NOT NULL DEFAULT 'g',
      cal_100 real NOT NULL,
      protein_100 real NOT NULL DEFAULT 0,
      carbs_100 real NOT NULL DEFAULT 0,
      fat_100 real NOT NULL DEFAULT 0,
      sugar_100 real,
      sodium_mg_100 real,
      serving_grams real,
      source text NOT NULL,
      scan_count integer NOT NULL DEFAULT 0,
      created_at timestamp NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS backups (
      id text PRIMARY KEY,
      data text NOT NULL,
      size integer NOT NULL,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS web_orders (
      no bigserial PRIMARY KEY,
      secret_hash text NOT NULL,
      plan text NOT NULL,
      months integer NOT NULL,
      amount integer NOT NULL,
      provider text NOT NULL,
      status text NOT NULL DEFAULT 'created',
      lang text NOT NULL DEFAULT 'uz',
      login text NOT NULL,
      is_renewal integer NOT NULL DEFAULT 0,
      password_enc text,
      password_hash text,
      password_salt text,
      payment_id text,
      paid_at timestamp,
      cancelled_at timestamp,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    );
  `);
  // Order numbers are shown to payment providers; start them at a
  // non-trivial value so they don't look like row counts.
  await db.execute(sql`SELECT setval(pg_get_serial_sequence('web_orders', 'no'), GREATEST((SELECT COALESCE(MAX(no), 0) FROM web_orders), 100000), true);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS web_orders_login ON web_orders (login);`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS pay_transactions (
      id bigserial PRIMARY KEY,
      provider text NOT NULL,
      ext_id text NOT NULL,
      order_no bigint NOT NULL,
      amount bigint NOT NULL,
      state integer NOT NULL DEFAULT 1,
      ext_time bigint,
      create_time bigint NOT NULL,
      perform_time bigint NOT NULL DEFAULT 0,
      cancel_time bigint NOT NULL DEFAULT 0,
      reason integer,
      extra text
    );
  `);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS pay_transactions_provider_ext ON pay_transactions (provider, ext_id);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS pay_transactions_order ON pay_transactions (order_no);`);
}

export * from "./schema";
