import {
  pgTable, text, integer, boolean, bigserial, bigint, timestamp, date, jsonb, index, uniqueIndex, real,
} from "drizzle-orm/pg-core";

/**
 * Unified CRM: one customer per phone number, whatever the channel
 * (website, mobile app, phone call, Telegram). Orders are meal subscriptions;
 * every delivery day is its own row so freezes, the 18:00 lock, courier
 * assignment and the kitchen report all work per day.
 */

/** Delivery windows offered to customers. */
export const DELIVERY_SLOTS = ["morning", "evening"] as const; // 08:00–10:00, 18:00–22:30
export type DeliverySlot = (typeof DELIVERY_SLOTS)[number];

/** internal = our own couriers, external = outsourced delivery company. */
export const COURIER_TYPES = ["internal", "external"] as const;
export type CourierType = (typeof COURIER_TYPES)[number];

/** Where a customer / order came from. Instagram = direct messages to the Instagram account. */
export const ORDER_SOURCES = ["web", "mobile_app", "phone", "telegram", "instagram"] as const;
export type OrderSource = (typeof ORDER_SOURCES)[number];

/** Pipeline statuses a manager sets. "frozen" and "ending" are derived from delivery days. */
export const ORDER_STATUSES = ["new", "contacted", "awaiting_payment", "active", "finished", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = ["unpaid", "pending", "paid", "partial", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const DAY_STATUSES = ["scheduled", "frozen", "locked", "delivered", "failed", "burned", "cancelled"] as const;
export type DayStatus = (typeof DAY_STATUSES)[number];

/**
 * A special portion / add-on on a customer or an order: a catalog item (2x go'sht, +Oqsil,
 * Garnirsiz, Laktozasiz…) or a free-text request (code "custom"). Label and price are a
 * snapshot taken when it was chosen; the kitchen effect comes from the live catalog.
 */
export type ExtraItem = { code: string; label: string; qty: number; price: number };

export const customersTable = pgTable(
  "customers",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    /** +998XXXXXXXXX — the identity across website, app, phone and Telegram. */
    phone: text("phone").notNull(),
    name: text("name"),
    lang: text("lang").notNull().default("uz"),
    /** Default delivery data, copied into new orders. */
    district: text("district"),
    address: text("address"),
    deliverySlot: text("delivery_slot"),
    /** Filled when the customer links Telegram (bot contact share) — later phases. */
    telegramChatId: text("telegram_chat_id"),
    telegramUsername: text("telegram_username"),
    /** When and how the phone number was proven to belong to the customer (telegram | sms | manager). */
    phoneVerifiedAt: timestamp("phone_verified_at"),
    phoneVerifiedVia: text("phone_verified_via"),
    firstSource: text("first_source").notNull().default("web"),
    utmSource: text("utm_source"),
    utmCampaign: text("utm_campaign"),
    notes: text("notes"),
    /** Permanent special-portion wishes; preselected in every new order. */
    extras: jsonb("extras").$type<ExtraItem[]>(),
    /** Permanent meals per day (5 / 4 / 3); preselected in new orders. */
    meals: integer("meals"),
    /** Delivery point shared from the browser at checkout. */
    lat: real("lat"),
    lng: real("lng"),
    lastContactAt: timestamp("last_contact_at"),
    /** Hidden from CRM lists (duplicates, tests, lost customers); a new request from the same phone restores it. */
    archivedAt: timestamp("archived_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("customers_phone").on(t.phone), uniqueIndex("customers_tg").on(t.telegramChatId)],
);
export type Customer = typeof customersTable.$inferSelect;

/** People who can open /admin. Login is a one-time link sent by the Telegram bot. */
export const staffTable = pgTable(
  "staff",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    name: text("name").notNull(),
    /** owner | manager */
    role: text("role").notNull().default("manager"),
    telegramChatId: text("telegram_chat_id").notNull(),
    telegramUsername: text("telegram_username"),
    active: boolean("active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("staff_tg").on(t.telegramChatId)],
);
export type Staff = typeof staffTable.$inferSelect;

export const staffLoginTokensTable = pgTable("staff_login_tokens", {
  /** sha256 of the token in the login link. */
  tokenHash: text("token_hash").primaryKey(),
  staffId: bigint("staff_id", { mode: "number" }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Customer history: calls, notes, status changes, new requests, order changes. */
export const crmEventsTable = pgTable(
  "crm_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    customerId: bigint("customer_id", { mode: "number" }).notNull(),
    orderId: bigint("order_id", { mode: "number" }),
    leadId: bigint("lead_id", { mode: "number" }),
    staffId: bigint("staff_id", { mode: "number" }),
    /** call | note | lead | order_created | order_updated | lead_status | delivery_change */
    type: text("type").notNull(),
    body: text("body"),
    meta: jsonb("meta"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("crm_events_customer").on(t.customerId, t.createdAt)],
);
export type CrmEvent = typeof crmEventsTable.$inferSelect;

/** A meal subscription (3-day trial, 1–4 weeks, 1 month). */
export const ordersTable = pgTable(
  "orders",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    customerId: bigint("customer_id", { mode: "number" }).notNull(),
    leadId: bigint("lead_id", { mode: "number" }),
    source: text("source").notNull(),
    /** ozish | balans | sport */
    ration: text("ration").notNull(),
    /** Kitchen calorie SKU: 1200, 1400, 1600, 1900, 2200, 2500. */
    sku: integer("sku").notNull(),
    /** d3 | w1 | w2 | w3 | w4 | m1 */
    plan: text("plan").notNull(),
    daysTotal: integer("days_total").notNull(),
    pricePerDay: integer("price_per_day").notNull(),
    discountPct: integer("discount_pct").notNull().default(0),
    /** so'm */
    amount: integer("amount").notNull(),
    paidAmount: integer("paid_amount").notNull().default(0),
    paymentStatus: text("payment_status").notNull().default("unpaid"),
    crmStatus: text("crm_status").notNull().default("new"),
    startDate: date("start_date", { mode: "string" }).notNull(),
    deliverySlot: text("delivery_slot").notNull().default("morning"),
    courierType: text("courier_type").notNull().default("internal"),
    district: text("district"),
    address: text("address"),
    managerId: bigint("manager_id", { mode: "number" }),
    note: text("note"),
    /** Special portions for this subscription and their price per day (added to pricePerDay in the amount). */
    extras: jsonb("extras").$type<ExtraItem[]>(),
    extrasPerDay: integer("extras_per_day").notNull().default(0),
    /** Meals per day: 5 (standard), 4 (no 16:30 snack), 3 (no snacks). */
    meals: integer("meals").notNull().default(5),
    /** Delivery point (website checkout). */
    lat: real("lat"),
    lng: real("lng"),
    /** Online payment: payme | click | uzum; mode demo | live; provider reference; when it was paid. */
    paymentProvider: text("payment_provider"),
    paymentMode: text("payment_mode"),
    paymentRef: text("payment_ref"),
    paidAt: timestamp("paid_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("orders_customer").on(t.customerId), index("orders_status").on(t.crmStatus)],
);
export type Order = typeof ordersTable.$inferSelect;

/** One row per delivery day of an order (Mon–Sat; Sunday is a day off). */
export const deliveryDaysTable = pgTable(
  "delivery_days",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    orderId: bigint("order_id", { mode: "number" }).notNull(),
    day: date("day", { mode: "string" }).notNull(),
    status: text("status").notNull().default("scheduled"),
    deliverySlot: text("delivery_slot").notNull(),
    courierType: text("courier_type").notNull(),
    district: text("district"),
    address: text("address"),
    sku: integer("sku").notNull(),
    frozenAt: timestamp("frozen_at"),
    /** A frozen day must be used within a month (frozen_at + 30 days). */
    burnAt: timestamp("burn_at"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("delivery_days_order_day").on(t.orderId, t.day), index("delivery_days_day").on(t.day)],
);
export type DeliveryDay = typeof deliveryDaysTable.$inferSelect;

/** Mobile app installs linked to a customer (phone proven via Telegram or SMS) — used from phase D. */
export const appLinksTable = pgTable("app_links", {
  deviceId: text("device_id").primaryKey(),
  customerId: bigint("customer_id", { mode: "number" }).notNull(),
  via: text("via").notNull(),
  linkedAt: timestamp("linked_at").notNull().defaultNow(),
});

/** One-time phone verification codes for any channel (telegram deep link, sms). */
export const phoneVerificationsTable = pgTable(
  "phone_verifications",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    /** telegram | sms */
    channel: text("channel").notNull(),
    /** sha256 of the code / deep-link token. */
    codeHash: text("code_hash").notNull(),
    phone: text("phone"),
    deviceId: text("device_id"),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: timestamp("expires_at").notNull(),
    verifiedAt: timestamp("verified_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("phone_verifications_code").on(t.codeHash)],
);

/**
 * Catalog of special portions. `target` + `mode` + `value` say what the kitchen does:
 * protein/add/1 = one more portion of the meal's main protein (2x go'sht), side/set/0 = no side dish.
 */
export const kitchenExtrasTable = pgTable("kitchen_extras", {
  code: text("code").primaryKey(),
  label: text("label").notNull(),
  /** so'm per delivery day */
  price: integer("price").notNull().default(0),
  /** protein | side | null (label only, e.g. Laktozasiz) */
  target: text("target"),
  /** add (extra portions × qty) | set (portion multiplier) */
  mode: text("mode"),
  value: real("value").notNull().default(0),
  sort: integer("sort").notNull().default(0),
  active: boolean("active").notNull().default(true),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
export type KitchenExtra = typeof kitchenExtrasTable.$inferSelect;

/** One product of a dish; grams per calorie option ("1200": 140, …). */
export type MenuItem = { product: string; role: "protein" | "side" | "other"; grams: Record<string, number> };

/** Weekly kitchen menu: weekday 1–6 (Mon–Sat) × meal 0–4 (breakfast … dinner). */
export const kitchenMenuTable = pgTable(
  "kitchen_menu",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    weekday: integer("weekday").notNull(),
    meal: integer("meal").notNull(),
    name: text("name").notNull(),
    items: jsonb("items").$type<MenuItem[]>().notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("kitchen_menu_slot").on(t.weekday, t.meal)],
);
export type KitchenMeal = typeof kitchenMenuTable.$inferSelect;

/** Small key → JSON settings edited in the CRM (e.g. meal_pricing: {"4": 10, "3": 20} percent off). */
export const crmSettingsTable = pgTable("crm_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
