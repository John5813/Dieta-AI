import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db, staffTable, staffLoginTokensTable, type Staff } from "@workspace/db";
import { logger } from "./logger";

/**
 * /admin sign-in. A staff member sends /login to the Telegram bot and gets a
 * one-time link (10 minutes). Opening it sets an HttpOnly session cookie
 * signed with HMAC; every request re-checks that the staff row is still active.
 */

export const SESSION_COOKIE = "k_admin";
const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const LOGIN_TTL_MS = 10 * 60 * 1000;

let secretCache: Buffer | null = null;
function secret(): Buffer {
  if (secretCache) return secretCache;
  const explicit = process.env["ADMIN_SESSION_SECRET"]?.trim() || process.env["PREMIUM_TOKEN_SECRET"]?.trim();
  if (explicit && explicit.length >= 32) {
    secretCache = createHash("sha256").update(`kaloria-admin:${explicit}`).digest();
    return secretCache;
  }
  const seed = [process.env["TELEGRAM_BOT_TOKEN"], process.env["DATABASE_URL"]].filter(Boolean).join("|");
  if (seed) {
    logger.warn("ADMIN_SESSION_SECRET (32+ chars) is not set; deriving the admin session key from other secrets.");
    secretCache = createHash("sha256").update(`kaloria-admin-derived:${seed}`).digest();
  } else {
    logger.warn("No secret for admin sessions; using a random per-boot key (sessions end on restart).");
    secretCache = randomBytes(32);
  }
  return secretCache;
}

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

export function makeSessionValue(staffId: number, now = Date.now()): string {
  const payload = `v1.${staffId}.${Math.floor((now + SESSION_TTL_MS) / 1000)}`;
  return `${payload}.${sign(payload)}`;
}

export function readSessionValue(value: string | undefined, now = Date.now()): number | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return null;
  const payload = parts.slice(0, 3).join(".");
  const a = Buffer.from(sign(payload));
  const b = Buffer.from(parts[3]!);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const staffId = Number(parts[1]);
  const exp = Number(parts[2]) * 1000;
  if (!Number.isSafeInteger(staffId) || !(exp > now)) return null;
  return staffId;
}

/** Creates a one-time login token for a staff member; returns the raw token for the link. */
export async function createLoginToken(staffId: number): Promise<string> {
  const token = randomBytes(24).toString("base64url");
  await db.insert(staffLoginTokensTable).values({ tokenHash: sha(token), staffId, expiresAt: new Date(Date.now() + LOGIN_TTL_MS) });
  return token;
}

/** Consumes a login token (single use). Returns the active staff member or null. */
export async function consumeLoginToken(token: string): Promise<Staff | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const [row] = await db
    .update(staffLoginTokensTable)
    .set({ usedAt: new Date() })
    .where(and(eq(staffLoginTokensTable.tokenHash, sha(token)), isNull(staffLoginTokensTable.usedAt), gt(staffLoginTokensTable.expiresAt, new Date())))
    .returning();
  if (!row) return null;
  const [staff] = await db.select().from(staffTable).where(eq(staffTable.id, row.staffId)).limit(1);
  if (!staff?.active) return null;
  await db.update(staffTable).set({ lastLoginAt: new Date() }).where(eq(staffTable.id, staff.id));
  return staff;
}

export function setSessionCookie(req: Request, res: Response, staffId: number): void {
  res.cookie(SESSION_COOKIE, makeSessionValue(staffId), {
    httpOnly: true,
    secure: req.secure,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS,
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Set by requireStaff for /api/admin/* requests. */
      staff?: Staff;
    }
  }
}

/** Requires a valid session of an active staff member. Mutations also need the X-Kaloria-Admin header (CSRF). */
export async function requireStaff(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const staffId = readSessionValue(req.cookies?.[SESSION_COOKIE]);
    if (!staffId) {
      res.status(401).json({ error: "Kirish kerak", code: "auth_required" });
      return;
    }
    const [staff] = await db.select().from(staffTable).where(eq(staffTable.id, staffId)).limit(1);
    if (!staff?.active) {
      res.status(401).json({ error: "Kirish kerak", code: "auth_required" });
      return;
    }
    // A custom header cannot be sent cross-site without a CORS preflight, which our CORS policy refuses.
    if (req.method !== "GET" && req.method !== "HEAD" && req.get("x-kaloria-admin") !== "1") {
      res.status(403).json({ error: "Ruxsat yo‘q", code: "csrf" });
      return;
    }
    req.staff = staff;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireOwner(req: Request, res: Response, next: NextFunction): void {
  if (req.staff?.role !== "owner") {
    res.status(403).json({ error: "Faqat admin uchun", code: "owner_only" });
    return;
  }
  next();
}

/** Telegram chat ids that may become owners on their first /login (TELEGRAM_ADMIN_CHAT_ID + ADMIN_OWNER_TELEGRAM_IDS). */
export function ownerChatIds(): Set<string> {
  const ids = [process.env["TELEGRAM_ADMIN_CHAT_ID"] ?? "", ...(process.env["ADMIN_OWNER_TELEGRAM_IDS"] ?? "").split(",")]
    .map((s) => s.trim())
    .filter((s) => /^\d{3,20}$/.test(s)); // private chats only (positive ids), not groups
  return new Set(ids);
}
