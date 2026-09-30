import { Router, type Request, type Response, type NextFunction } from "express";
import { randomBytes } from "crypto";
import { enabledProviders, findPlan, getPlans, publicBaseUrl, type ProviderId } from "../lib/pay/config";
import { createOrder, getOrder, OrderError, publicOrderView, tokenMatches } from "../lib/pay/orders";
import { renderCheckout, renderOffer, renderStatus, isPayLang, pickLang } from "../lib/pay/page";
import { paymeCheckoutUrl, paymeWebhook } from "../lib/pay/payme";
import { clickCheckoutUrl, clickComplete, clickPrepare } from "../lib/pay/click";
import { uzumCheckoutUrl, uzumWebhook } from "../lib/pay/uzum";
import { octoCheckoutUrl, octoNotify } from "../lib/pay/octo";
import { db, payTransactionsTable, type WebOrder } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { normalizeLogin } from "../lib/credentials";
import { logger } from "../lib/logger";

// ─── Pages: /pay, /pay/o/:no, /pay/offer ────────────────────────────────────

export const payPages = Router();

function pageHeaders(res: Response): string {
  const nonce = randomBytes(16).toString("base64");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader(
    "Content-Security-Policy",
    `default-src 'self'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; img-src 'self' data:; ` +
      `connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`,
  );
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Content-Type-Options", "nosniff");
  return nonce;
}

payPages.get("/", (req, res) => {
  const lang = pickLang(req.query.lang, req.headers.cookie, req.headers["accept-language"]);
  const nonce = pageHeaders(res);
  res.setHeader("Cache-Control", "no-cache");
  const login = typeof req.query.login === "string" ? normalizeLogin(req.query.login).slice(0, 20) : undefined;
  res.send(
    renderCheckout({
      lang,
      nonce,
      plans: getPlans(),
      providers: enabledProviders(),
      renewLogin: login && /^[A-Z0-9-]{4,20}$/.test(login) ? login : undefined,
    }),
  );
});

payPages.get("/offer", (req, res) => {
  const lang = pickLang(req.query.lang, req.headers.cookie, req.headers["accept-language"]);
  res.send(renderOffer({ lang, nonce: pageHeaders(res) }));
});

payPages.get("/o/:no", (req, res) => {
  const lang = pickLang(req.query.lang, req.headers.cookie, req.headers["accept-language"]);
  const nonce = pageHeaders(res);
  res.setHeader("Cache-Control", "no-store");
  const no = Number(req.params.no);
  const token = typeof req.query.t === "string" ? req.query.t : "";
  res.send(
    renderStatus({
      lang,
      nonce,
      no: Number.isSafeInteger(no) ? no : 0,
      token,
      appStoreUrl: process.env["APP_STORE_URL"]?.trim() || undefined,
      playStoreUrl: process.env["PLAY_STORE_URL"]?.trim() || undefined,
    }),
  );
});

// ─── API: /api/pay/... ──────────────────────────────────────────────────────

export const payApi = Router();

/** Small per-IP limit on order creation so logins can't be probed in bulk. */
const hits = new Map<string, number[]>();
function rateLimit(max: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = String(req.headers["x-forwarded-for"] ?? req.ip ?? "").split(",")[0]!.trim();
    const now = Date.now();
    const list = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
    if (list.length >= max) {
      res.status(429).json({ error: "too_many_requests" });
      return;
    }
    list.push(now);
    hits.set(ip, list);
    if (hits.size > 10_000) hits.clear();
    next();
  };
}

function statusUrl(base: string, order: WebOrder, token: string) {
  return `${base}/pay/o/${order.no}?t=${encodeURIComponent(token)}&lang=${order.lang}`;
}

async function providerUrl(order: WebOrder, token: string, base: string): Promise<string> {
  const back = statusUrl(base, order, token);
  switch (order.provider as ProviderId) {
    case "payme":
      return paymeCheckoutUrl(order, back, order.lang);
    case "click":
      return clickCheckoutUrl(order, back);
    case "uzum":
      return uzumCheckoutUrl(order, back);
    case "card":
      return octoCheckoutUrl(order, back, `${base}/api/pay/octo/notify`, order.lang);
  }
}

payApi.get("/pay/config", (_req, res) => {
  res.json({ plans: getPlans(), providers: enabledProviders() });
});

payApi.post("/pay/orders", rateLimit(20, 10 * 60 * 1000), async (req, res) => {
  const { plan: planId, provider, lang, login } = (req.body ?? {}) as Record<string, unknown>;
  const plan = typeof planId === "string" ? findPlan(planId) : undefined;
  if (!plan || typeof provider !== "string" || !enabledProviders().includes(provider as ProviderId)) {
    res.status(400).json({ error: "bad_request" });
    return;
  }
  try {
    const { order, token } = await createOrder({
      plan,
      provider: provider as ProviderId,
      lang: isPayLang(lang) ? lang : "uz",
      renewLogin: typeof login === "string" && login.trim() ? login : undefined,
    });
    const base = publicBaseUrl(req.headers.host);
    const redirectUrl = await providerUrl(order, token, base);
    res.json({ orderNo: order.no, statusUrl: statusUrl(base, order, token), redirectUrl });
  } catch (err) {
    if (err instanceof OrderError) {
      res.status(err.code === "login_not_found" ? 404 : 400).json({ error: err.code });
      return;
    }
    logger.error({ err }, "create order failed");
    res.status(502).json({ error: "provider_unavailable" });
  }
});

payApi.get("/pay/orders/:no", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const token = typeof req.query.t === "string" ? req.query.t : "";
  const order = await getOrder(Number(req.params.no));
  if (!order || !tokenMatches(order, token)) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  const view = await publicOrderView(order, token);
  let payUrl: string | null = null;
  if (order.status === "created") {
    const base = publicBaseUrl(req.headers.host);
    if (order.provider === "card") {
      // Octo pages are created once; reuse the stored one instead of a new payment.
      const rows = await db
        .select({ extra: payTransactionsTable.extra })
        .from(payTransactionsTable)
        .where(and(eq(payTransactionsTable.provider, "card"), eq(payTransactionsTable.orderNo, order.no)))
        .orderBy(desc(payTransactionsTable.id))
        .limit(1);
      try {
        payUrl = rows[0]?.extra ? (JSON.parse(rows[0].extra).url ?? null) : null;
      } catch {
        payUrl = null;
      }
    } else {
      payUrl = await providerUrl(order, token, base);
    }
  }
  res.json({ ...view, payUrl });
});

// Provider callbacks. Each verifies its own signature / credentials.
payApi.post("/pay/payme", paymeWebhook);
payApi.post("/pay/click/prepare", clickPrepare);
payApi.post("/pay/click/complete", clickComplete);
for (const op of ["check", "create", "confirm", "reverse", "status"] as const) {
  payApi.post(`/pay/uzum/${op}`, uzumWebhook(op));
}
payApi.post("/pay/octo/notify", octoNotify);
