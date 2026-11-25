import { pgTable, text, integer, real, boolean, bigserial, timestamp, index } from "drizzle-orm/pg-core";

/**
 * CRM: everyone who left a name and phone on the website (calorie quiz or an
 * order form). Body data and the calculated calories are stored so a manager
 * can call with the right offer; UTM tags show which ad brought them.
 */
export const leadsTable = pgTable(
  "leads",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    /** sha256 of the random key the browser holds to update its own lead. */
    keyHash: text("key_hash").notNull(),
    source: text("source").notNull().default("web"),
    name: text("name").notNull(),
    /** +998XXXXXXXXX */
    phone: text("phone").notNull(),
    lang: text("lang").notNull().default("uz"),

    gender: text("gender"),
    goal: text("goal"),
    age: integer("age"),
    height: integer("height"),
    weight: real("weight"),
    activity: real("activity"),
    /** Said yes to diabetes / kidney disease / severe allergy. */
    healthRisk: boolean("health_risk"),

    calories: integer("calories"),
    protein: integer("protein"),
    fat: integer("fat"),
    carbs: integer("carbs"),
    ration: text("ration"),
    sku: integer("sku"),

    /** quiz | test_drive | subscription | manager */
    intent: text("intent").notNull().default("quiz"),
    /** Plan id the customer picked (d3, w1, w2, w3, w4, m1). */
    plan: text("plan"),
    planRation: text("plan_ration"),

    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    utmContent: text("utm_content"),
    utmTerm: text("utm_term"),
    referrer: text("referrer"),
    landingPath: text("landing_path"),

    /** new → contacted → won / lost (managed by the sales team). */
    status: text("status").notNull().default("new"),
    /** none → pending → paid */
    paymentStatus: text("payment_status").notNull().default("none"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("leads_phone").on(t.phone), index("leads_created").on(t.createdAt)],
);

export type Lead = typeof leadsTable.$inferSelect;
