import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "crypto";
import { and, eq, sql } from "drizzle-orm";
import { db, paymentsTable, webOrdersTable, type WebOrder } from "@workspace/db";
import { generateLogin, generatePassword, hashPassword, normalizeLogin } from "../credentials";
import { logger } from "../logger";
import * as tg from "../telegram";
import type { Plan, ProviderId } from "./config";

export class OrderError extends Error {
  constructor(public code: "login_not_found" | "bad_request") {
    super(code);
  }
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const tokenKey = (token: string) => createHash("sha256").update(`uzdieta-order-pw:${token}`).digest();

function encryptWithToken(plain: string, token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", tokenKey(token), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64url");
}

function decryptWithToken(blob: string, token: string): string | null {
  try {
    const buf = Buffer.from(blob, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", tokenKey(token), buf.subarray(0, 12));
    decipher.setAuthTag(buf.subarray(12, 28));
    return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

async function loginTaken(login: string): Promise<boolean> {
  const a = await db.select({ id: paymentsTable.id }).from(paymentsTable).where(eq(paymentsTable.login, login));
  if (a.length) return true;
  const b = await db.select({ no: webOrdersTable.no }).from(webOrdersTable).where(eq(webOrdersTable.login, login));
  return b.length > 0;
}

/**
 * Creates an unpaid order. New buyers get a login + password right away (the
 * password is only readable with the status-page token, and only after
 * payment); `renewLogin` instead extends an existing premium login.
 */
export async function createOrder(opts: {
  plan: Plan;
  provider: ProviderId;
  lang: string;
  renewLogin?: string;
}): Promise<{ order: WebOrder; token: string }> {
  const token = randomBytes(18).toString("base64url");
  let login: string;
  let passwordEnc: string | null = null;
  let passwordHash: string | null = null;
  let passwordSalt: string | null = null;
  let isRenewal = 0;

  if (opts.renewLogin) {
    login = normalizeLogin(opts.renewLogin);
    const rows = await db.select().from(paymentsTable).where(eq(paymentsTable.login, login));
    const p = rows[0];
    if (!p || !["approved", "redeemed"].includes(p.status)) throw new OrderError("login_not_found");
    isRenewal = 1;
  } else {
    login = generateLogin();
    for (let i = 0; i < 5 && (await loginTaken(login)); i++) login = generateLogin();
    const password = generatePassword();
    const h = hashPassword(password);
    passwordHash = h.hash;
    passwordSalt = h.salt;
    passwordEnc = encryptWithToken(password, token);
  }

  const inserted = await db
    .insert(webOrdersTable)
    .values({
      secretHash: sha256(token),
      plan: opts.plan.id,
      months: opts.plan.months,
      amount: opts.plan.amount,
      provider: opts.provider,
      lang: opts.lang,
      login,
      isRenewal,
      passwordEnc,
      passwordHash,
      passwordSalt,
    })
    .returning();
  return { order: inserted[0]!, token };
}

export async function getOrder(no: number): Promise<WebOrder | undefined> {
  if (!Number.isSafeInteger(no) || no <= 0) return undefined;
  const rows = await db.select().from(webOrdersTable).where(eq(webOrdersTable.no, no));
  return rows[0];
}

export function tokenMatches(order: WebOrder, token: string): boolean {
  if (!token) return false;
  const a = Buffer.from(sha256(token), "hex");
  const b = Buffer.from(order.secretHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** What the status page may show. The password appears only once the order is paid. */
export async function publicOrderView(order: WebOrder, token: string) {
  let premiumUntil: string | null = null;
  const paid = order.status === "paid";
  if (paid) {
    const rows = await db
      .select({ until: paymentsTable.premiumUntil })
      .from(paymentsTable)
      .where(eq(paymentsTable.login, order.login));
    premiumUntil = rows[0]?.until?.toISOString() ?? null;
  }
  return {
    no: order.no,
    status: order.status,
    plan: order.plan,
    months: order.months,
    amount: order.amount,
    provider: order.provider,
    renewal: order.isRenewal === 1,
    login: paid || order.isRenewal ? order.login : null,
    password: paid && order.passwordEnc ? decryptWithToken(order.passwordEnc, token) : null,
    premiumUntil,
  };
}

/**
 * Marks the order paid and grants premium. Idempotent: calling it again for a
 * paid order is a no-op. Returns false if the order can't be paid (cancelled
 * or refunded).
 */
export async function fulfillOrder(no: number): Promise<boolean> {
  const result = await db.transaction(async (tx) => {
    const updated = await tx
      .update(webOrdersTable)
      .set({ status: "paid", paidAt: new Date(), updatedAt: new Date() })
      .where(and(eq(webOrdersTable.no, no), eq(webOrdersTable.status, "created")))
      .returning();
    const order = updated[0];
    if (!order) {
      const rows = await tx.select().from(webOrdersTable).where(eq(webOrdersTable.no, no));
      return { ok: rows[0]?.status === "paid", fresh: null as WebOrder | null };
    }

    const months = `${order.months} months`;
    if (order.isRenewal) {
      await tx
        .update(paymentsTable)
        .set({
          premiumUntil: sql`GREATEST(COALESCE(${paymentsTable.premiumUntil}, now()), now()) + ${months}::interval`,
          // A paid renewal is a fresh start for moving premium between phones.
          restoreCount: 0,
          paidAmount: sql`${paymentsTable.paidAmount} + ${order.amount}`,
          updatedAt: new Date(),
        })
        .where(eq(paymentsTable.login, order.login));
    } else {
      const id = `web-${order.no}`;
      await tx.insert(paymentsTable).values({
        id,
        linkToken: id,
        amount: order.amount,
        paidAmount: order.amount,
        status: "approved",
        login: order.login,
        passwordHash: order.passwordHash,
        passwordSalt: order.passwordSalt,
        passwordUsed: false,
        approvedAt: new Date(),
        premiumUntil: sql`now() + ${months}::interval`,
      });
      await tx.update(webOrdersTable).set({ paymentId: id }).where(eq(webOrdersTable.no, order.no));
    }
    return { ok: true, fresh: order };
  });

  if (result.fresh) void notifyAdmin(result.fresh, "paid");
  return result.ok;
}

/** Takes premium back after a provider-side refund of a paid order. */
export async function revokeOrder(no: number): Promise<void> {
  const order = await db.transaction(async (tx) => {
    const updated = await tx
      .update(webOrdersTable)
      .set({ status: "refunded", cancelledAt: new Date(), updatedAt: new Date() })
      .where(and(eq(webOrdersTable.no, no), eq(webOrdersTable.status, "paid")))
      .returning();
    const o = updated[0];
    if (!o) return null;
    if (o.isRenewal) {
      await tx
        .update(paymentsTable)
        .set({
          premiumUntil: sql`${paymentsTable.premiumUntil} - ${`${o.months} months`}::interval`,
          updatedAt: new Date(),
        })
        .where(eq(paymentsTable.login, o.login));
    } else {
      await tx
        .update(paymentsTable)
        .set({ status: "refunded", premiumUntil: new Date(), updatedAt: new Date() })
        .where(eq(paymentsTable.login, o.login));
    }
    return o;
  });
  if (order) void notifyAdmin(order, "refunded");
}

const PROVIDER_LABEL: Record<string, string> = { click: "Click", payme: "Payme", uzum: "Uzum Bank", card: "Visa/Mastercard (Octo)" };

async function notifyAdmin(order: WebOrder, event: "paid" | "refunded") {
  if (!tg.isConfigured()) return;
  try {
    const amount = order.amount.toLocaleString("ru-RU").replace(/,/g, " ");
    const head = event === "paid" ? "💳 <b>Saytdan to'lov</b>" : "↩️ <b>To'lov qaytarildi</b>";
    await tg.sendMessage(
      tg.getAdminChatId(),
      `${head}\n\n` +
        `Buyurtma: <code>#${order.no}</code>\n` +
        `To'lov: ${PROVIDER_LABEL[order.provider] ?? order.provider}\n` +
        `Summa: ${amount} so'm · ${order.months} oy\n` +
        `Login: <code>${order.login}</code>${order.isRenewal ? " (uzaytirish)" : ""}`,
    );
  } catch (err) {
    logger.warn({ err }, "admin notify failed");
  }
}
