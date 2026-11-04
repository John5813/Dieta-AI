import type { NextFunction, Request, RequestHandler, Response } from "express";
import { bearerFrom, verifyPremiumToken } from "./premiumToken";
import { logger } from "./logger";

/**
 * Cost and abuse protection. Everything is in memory (one server instance):
 *  - generic fixed-window rate limiter,
 *  - per-identity daily AI quotas (premium token / install id / IP),
 *  - a global daily AI budget and a cap on simultaneous AI calls, so no
 *    amount of scripted traffic can run the OpenRouter bill up without bound.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const MAX_KEYS = 100_000;

class Counters {
  private map = new Map<string, Bucket>();

  /** Adds `weight`; returns false (without counting) when it would exceed `max`. */
  hit(key: string, max: number, windowMs: number, weight = 1): boolean {
    const now = Date.now();
    let b = this.map.get(key);
    if (!b || b.resetAt <= now) {
      if (this.map.size >= MAX_KEYS) this.sweep(now);
      b = { count: 0, resetAt: now + windowMs };
      this.map.set(key, b);
    }
    if (b.count + weight > max) return false;
    b.count += weight;
    return true;
  }

  /** Counts a failure only (used for failed-login style limits). */
  blocked(key: string, max: number): boolean {
    const b = this.map.get(key);
    return !!b && b.resetAt > Date.now() && b.count >= max;
  }

  fail(key: string, windowMs: number): void {
    const now = Date.now();
    const b = this.map.get(key);
    if (!b || b.resetAt <= now) this.map.set(key, { count: 1, resetAt: now + windowMs });
    else b.count++;
  }

  reset(key: string): void {
    this.map.delete(key);
  }

  sweep(now = Date.now()): void {
    for (const [k, b] of this.map) if (b.resetAt <= now) this.map.delete(k);
    if (this.map.size >= MAX_KEYS) this.map.clear();
  }
}

const counters = new Counters();
setInterval(() => counters.sweep(), 5 * 60 * 1000).unref();

export const failures = {
  blocked: (key: string, max: number) => counters.blocked(key, max),
  fail: (key: string, windowMs: number) => counters.fail(key, windowMs),
  reset: (key: string) => counters.reset(key),
};

/** Client IP as Express resolves it (see `trust proxy` in app.ts). */
export const clientIp = (req: Request): string => req.ip || req.socket.remoteAddress || "unknown";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** Fixed-window per-IP limiter. */
export function rateLimit(name: string, max: number, windowMs: number, message = "Juda ko'p so'rov. Birozdan keyin urinib ko'ring."): RequestHandler {
  return (req, res, next) => {
    if (!counters.hit(`${name}:${clientIp(req)}`, max, windowMs)) {
      res.setHeader("Retry-After", String(Math.ceil(windowMs / 1000)));
      res.status(429).json({ error: message, code: "rate_limited" });
      return;
    }
    next();
  };
}

// ─── AI budget ──────────────────────────────────────────────────────────────

export type AiKind = "image" | "text" | "chat" | "plan";

interface KindLimit {
  /** Per install/day without a premium token. */
  free: number;
  /** Per premium login/day. */
  premium: number;
  /** Per IP/day for everyone together (generous: many phones share one mobile-carrier IP). */
  ip: number;
  /** Cost relative to a short text call, against the global budget. */
  weight: number;
}

const LIMITS: Record<AiKind, KindLimit> = {
  image: { free: 10, premium: 120, ip: 200, weight: 3 },
  text: { free: 40, premium: 300, ip: 400, weight: 1 },
  chat: { free: 40, premium: 250, ip: 400, weight: 1 },
  plan: { free: 12, premium: 60, ip: 150, weight: 3 },
};

const num = (k: string, d: number) => {
  const n = Number(process.env[k]);
  return Number.isFinite(n) && n > 0 ? n : d;
};

/** Total weighted AI calls the whole server may make per 24h. */
const globalBudget = () => num("AI_GLOBAL_DAILY_BUDGET", 6000);
const maxInflight = () => num("AI_MAX_INFLIGHT", 25);
let inflight = 0;

const DEVICE_RE = /^[A-Za-z0-9_-]{16,64}$/;

const LIMIT_MSG = "Bugungi AI limiti tugadi. Ertaga qayta urinib ko'ring.";

function deny(res: Response, status: number, error: string, code: string) {
  res.status(status).json({ error, code });
}

export function aiGuard(kind: AiKind): RequestHandler {
  const lim = LIMITS[kind];
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = clientIp(req);

    // 1) Burst: nobody needs more than a few AI calls per minute.
    if (!counters.hit(`ai-burst:${ip}`, 30, MIN)) {
      res.setHeader("Retry-After", "60");
      return deny(res, 429, "Juda tez-tez so'rov yuboryapsiz. Bir daqiqadan keyin urinib ko'ring.", "rate_limited");
    }

    // 2) Identity: premium token, else install id, else the IP alone.
    const premium = verifyPremiumToken(bearerFrom(req.header("authorization")));
    const rawDevice = req.header("x-device-id") ?? "";
    const device = DEVICE_RE.test(rawDevice) ? rawDevice : null;
    const id = premium ? `p:${premium.l}` : device ? `d:${device}` : `i:${ip}`;
    const cap = premium ? lim.premium : lim.free;

    if (!counters.hit(`ai:${kind}:${id}`, cap, DAY)) {
      return deny(res, 429, LIMIT_MSG, "daily_limit");
    }
    // An install id is trivially re-rolled, so the IP bounds that route.
    if (!counters.hit(`ai:${kind}:ip:${ip}`, lim.ip, DAY)) {
      return deny(res, 429, LIMIT_MSG, "daily_limit");
    }

    // 3) Whole-server daily budget.
    if (!counters.hit("ai:global", globalBudget(), DAY, lim.weight)) {
      logger.error("AI global daily budget exhausted");
      return deny(res, 503, "AI xizmati hozir band. Keyinroq urinib ko'ring.", "budget_exhausted");
    }

    // 4) Simultaneous calls.
    if (inflight >= maxInflight()) {
      return deny(res, 503, "AI xizmati hozir band. Birozdan keyin urinib ko'ring.", "busy");
    }
    inflight++;
    let released = false;
    const release = () => {
      if (!released) {
        released = true;
        inflight--;
      }
    };
    res.on("close", release);
    res.on("finish", release);
    next();
  };
}

/** Keeps only short strings / finite numbers / booleans from a client-sent object before it goes into a prompt. */
export function flatClean(input: unknown, maxStr = 80): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return out;
  let n = 0;
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (++n > 40 || k.length > 40) break;
    if (typeof v === "string") out[k] = v.replace(/[\r\n\u2028\u2029]+/g, " ").trim().slice(0, maxStr);
    else if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    else if (typeof v === "boolean") out[k] = v;
  }
  return out;
}
