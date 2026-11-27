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
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS leads (
      id bigserial PRIMARY KEY,
      key_hash text NOT NULL,
      source text NOT NULL DEFAULT 'web',
      name text NOT NULL,
      phone text NOT NULL,
      lang text NOT NULL DEFAULT 'uz',
      gender text,
      goal text,
      age integer,
      height integer,
      weight real,
      activity real,
      health_risk boolean,
      calories integer,
      protein integer,
      fat integer,
      carbs integer,
      ration text,
      sku integer,
      intent text NOT NULL DEFAULT 'quiz',
      plan text,
      plan_ration text,
      utm_source text,
      utm_medium text,
      utm_campaign text,
      utm_content text,
      utm_term text,
      referrer text,
      landing_path text,
      status text NOT NULL DEFAULT 'new',
      payment_status text NOT NULL DEFAULT 'none',
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS district text;`);
  await db.execute(sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS address text;`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS leads_phone ON leads (phone);`);
  await db.execute(sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS delivery_slot text;`);
  await db.execute(sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS customer_id bigint;`);
  await db.execute(sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS plan_sku integer;`);
  await db.execute(sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS note text;`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS leads_customer ON leads (customer_id);`);
  await ensureCrmSchema();
  await db.execute(sql`CREATE INDEX IF NOT EXISTS leads_created ON leads (created_at);`);
}

/** CRM tables (customers, staff, events, orders, delivery days, app links) + lead backfill. */
async function ensureCrmSchema(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS customers (
      id bigserial PRIMARY KEY,
      phone text NOT NULL,
      name text,
      lang text NOT NULL DEFAULT 'uz',
      district text,
      address text,
      delivery_slot text,
      telegram_chat_id text,
      telegram_username text,
      phone_verified_at timestamp,
      phone_verified_via text,
      first_source text NOT NULL DEFAULT 'web',
      utm_source text,
      utm_campaign text,
      notes text,
      last_contact_at timestamp,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS customers_phone ON customers (phone);`);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS customers_tg ON customers (telegram_chat_id);`);
  await db.execute(sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS archived_at timestamp;`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS staff (
      id bigserial PRIMARY KEY,
      name text NOT NULL,
      role text NOT NULL DEFAULT 'manager',
      telegram_chat_id text NOT NULL,
      telegram_username text,
      active boolean NOT NULL DEFAULT true,
      last_login_at timestamp,
      created_at timestamp NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS staff_tg ON staff (telegram_chat_id);`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS staff_login_tokens (
      token_hash text PRIMARY KEY,
      staff_id bigint NOT NULL,
      expires_at timestamp NOT NULL,
      used_at timestamp,
      created_at timestamp NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS crm_events (
      id bigserial PRIMARY KEY,
      customer_id bigint NOT NULL,
      order_id bigint,
      lead_id bigint,
      staff_id bigint,
      type text NOT NULL,
      body text,
      meta jsonb,
      created_at timestamp NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS crm_events_customer ON crm_events (customer_id, created_at);`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS orders (
      id bigserial PRIMARY KEY,
      customer_id bigint NOT NULL,
      lead_id bigint,
      source text NOT NULL,
      ration text NOT NULL,
      sku integer NOT NULL,
      plan text NOT NULL,
      days_total integer NOT NULL,
      price_per_day integer NOT NULL,
      discount_pct integer NOT NULL DEFAULT 0,
      amount integer NOT NULL,
      paid_amount integer NOT NULL DEFAULT 0,
      payment_status text NOT NULL DEFAULT 'unpaid',
      crm_status text NOT NULL DEFAULT 'new',
      start_date date NOT NULL,
      delivery_slot text NOT NULL DEFAULT 'morning',
      courier_type text NOT NULL DEFAULT 'internal',
      district text,
      address text,
      manager_id bigint,
      note text,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS orders_customer ON orders (customer_id);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS orders_status ON orders (crm_status);`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS delivery_days (
      id bigserial PRIMARY KEY,
      order_id bigint NOT NULL,
      day date NOT NULL,
      status text NOT NULL DEFAULT 'scheduled',
      delivery_slot text NOT NULL,
      courier_type text NOT NULL,
      district text,
      address text,
      sku integer NOT NULL,
      frozen_at timestamp,
      burn_at timestamp,
      updated_at timestamp NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS delivery_days_order_day ON delivery_days (order_id, day);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS delivery_days_day ON delivery_days (day);`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS app_links (
      device_id text PRIMARY KEY,
      customer_id bigint NOT NULL,
      via text NOT NULL,
      linked_at timestamp NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS phone_verifications (
      id bigserial PRIMARY KEY,
      channel text NOT NULL,
      code_hash text NOT NULL,
      phone text,
      device_id text,
      attempts integer NOT NULL DEFAULT 0,
      expires_at timestamp NOT NULL,
      verified_at timestamp,
      created_at timestamp NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS phone_verifications_code ON phone_verifications (code_hash);`);

  // Backfill: one customer per phone from existing website leads, using the latest request's details (idempotent).
  await db.execute(sql`
    INSERT INTO customers (phone, name, lang, district, address, delivery_slot, first_source, utm_source, utm_campaign, created_at, updated_at)
    SELECT DISTINCT ON (phone) phone, name, lang, district, address, delivery_slot, source, utm_source, utm_campaign, created_at, created_at
    FROM leads WHERE customer_id IS NULL ORDER BY phone, created_at DESC
    ON CONFLICT (phone) DO NOTHING;
  `);
  await db.execute(sql`
    UPDATE leads SET customer_id = c.id FROM customers c
    WHERE leads.customer_id IS NULL AND c.phone = leads.phone;
  `);
  // Special portions (2x go'sht, garnirsiz…) and the kitchen's weekly menu.
  await db.execute(sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS extras jsonb;`);
  await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS extras jsonb;`);
  await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS extras_per_day integer NOT NULL DEFAULT 0;`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS kitchen_extras (
      code text PRIMARY KEY,
      label text NOT NULL,
      price integer NOT NULL DEFAULT 0,
      target text,
      mode text,
      value real NOT NULL DEFAULT 0,
      sort integer NOT NULL DEFAULT 0,
      active boolean NOT NULL DEFAULT true,
      updated_at timestamp NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS kitchen_menu (
      id bigserial PRIMARY KEY,
      weekday integer NOT NULL,
      meal integer NOT NULL,
      name text NOT NULL,
      items jsonb NOT NULL DEFAULT '[]'::jsonb,
      updated_at timestamp NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS kitchen_menu_slot ON kitchen_menu (weekday, meal);`);
  // 5 / 4 / 3 meals a day and CRM settings (3/4-meal price discount).
  await db.execute(sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS meals integer;`);
  await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS meals integer NOT NULL DEFAULT 5;`);
  await db.execute(sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS meals integer;`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS crm_settings (
      key text PRIMARY KEY,
      value jsonb NOT NULL,
      updated_at timestamp NOT NULL DEFAULT now()
    );
  `);
}

export * from "./schema";
