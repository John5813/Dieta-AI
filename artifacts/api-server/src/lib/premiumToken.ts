import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { logger } from "./logger";

/**
 * Stateless signed premium token. The server hands one out after a successful
 * login/password redeem; the app sends it as `Authorization: Bearer <token>`
 * and the AI routes use it to pick the (higher) premium quota.
 *
 * Format: v1.<base64url(json payload)>.<base64url(hmac-sha256)>
 */

export interface PremiumTokenPayload {
  /** Premium login (DAI-XXXXXX). */
  l: string;
  /** Expiry, unix seconds. */
  e: number;
  /** Issued through the master credential. */
  m?: 1;
}

/** Tokens are short-lived on purpose; the app refreshes them on start. */
export const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

let cachedSecret: Buffer | null = null;

function secret(): Buffer {
  if (cachedSecret) return cachedSecret;
  const explicit = process.env["PREMIUM_TOKEN_SECRET"]?.trim();
  if (explicit && explicit.length >= 32) {
    cachedSecret = createHash("sha256").update(explicit).digest();
    return cachedSecret;
  }
  const seed = [process.env["TELEGRAM_BOT_TOKEN"], process.env["DATABASE_URL"], process.env["OPENROUTER_API_KEY"]]
    .filter(Boolean)
    .join("|");
  if (seed) {
    logger.warn("PREMIUM_TOKEN_SECRET (32+ chars) is not set; deriving the token key from other secrets. Set it explicitly.");
    cachedSecret = createHash("sha256").update(`uzdieta-premium-token:${seed}`).digest();
  } else {
    logger.warn("No secrets available for premium tokens; using a random per-boot key (tokens die on restart).");
    cachedSecret = randomBytes(32);
  }
  return cachedSecret;
}

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");
const sign = (body: string) => createHmac("sha256", secret()).update(body).digest();

export function signPremiumToken(opts: { login: string; premiumUntil: number; master?: boolean }): { token: string; expiresAt: number } {
  const expiresAt = Math.min(opts.premiumUntil, Date.now() + TOKEN_TTL_MS);
  const payload: PremiumTokenPayload = { l: opts.login, e: Math.floor(expiresAt / 1000), ...(opts.master ? { m: 1 as const } : {}) };
  const body = b64(JSON.stringify(payload));
  return { token: `v1.${body}.${b64(sign(body))}`, expiresAt };
}

/** `graceMs` lets the refresh route accept a recently expired token (app not opened for a while). */
export function verifyPremiumToken(token: string | undefined | null, graceMs = 0): PremiumTokenPayload | null {
  if (!token || token.length > 512) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return null;
  const [, body, sig] = parts as [string, string, string];
  const expected = sign(body);
  let got: Buffer;
  try {
    got = Buffer.from(sig, "base64url");
  } catch {
    return null;
  }
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as PremiumTokenPayload;
    if (typeof p.l !== "string" || typeof p.e !== "number" || p.e * 1000 + graceMs <= Date.now()) return null;
    return p;
  } catch {
    return null;
  }
}

export function bearerFrom(header: string | undefined): string | null {
  const m = /^Bearer\s+(\S+)$/i.exec(header ?? "");
  return m ? m[1]! : null;
}
