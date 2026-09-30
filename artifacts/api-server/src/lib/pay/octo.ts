/**
 * Visa / Mastercard (and Humo/Uzcard) through Octo's hosted payment page.
 * We create the payment server-to-server, send the buyer to `octo_pay_url`,
 * and grant premium only from Octo's signed notification.
 */
import type { Request, Response } from "express";
import { createHash, timingSafeEqual } from "crypto";
import { octo } from "./config";
import { fulfillOrder, getOrder, revokeOrder } from "./orders";
import { findTx, insertTx, transitionTx } from "./transactions";
import type { WebOrder } from "@workspace/db";
import { logger } from "../logger";

function tashkentTime(d = new Date()): string {
  // "yyyy-MM-dd HH:mm:ss" in Asia/Tashkent (UTC+5, no DST).
  const t = new Date(d.getTime() + 5 * 3600_000).toISOString();
  return `${t.slice(0, 10)} ${t.slice(11, 19)}`;
}

export class OctoError extends Error {}

/** Creates the Octo payment and returns the page the buyer should open. */
export async function octoCheckoutUrl(order: WebOrder, returnUrl: string, notifyUrl: string, lang: string): Promise<string> {
  const shopTxId = `UD-${order.no}`;
  const body = {
    octo_shop_id: Number(octo.shopId()),
    octo_secret: octo.secret(),
    shop_transaction_id: shopTxId,
    auto_capture: true,
    test: octo.test(),
    init_time: tashkentTime(),
    total_sum: order.amount,
    currency: "UZS",
    description: `UzDieta AI Premium · ${order.months}`,
    return_url: returnUrl,
    notify_url: notifyUrl,
    language: lang === "ru" ? "ru" : lang === "uz" || lang === "uz-kril" ? "uz" : "en",
    ttl: 30,
  };
  const r = await fetch(`${octo.apiUrl()}/prepare_payment`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await r.json().catch(() => null)) as any;
  const url = data?.data?.octo_pay_url;
  const uuid = data?.data?.octo_payment_UUID;
  if (!r.ok || data?.error !== 0 || typeof url !== "string" || typeof uuid !== "string") {
    logger.error({ status: r.status, error: data?.error, message: data?.errMessage }, "octo prepare_payment failed");
    throw new OctoError("octo_prepare_failed");
  }
  await insertTx({
    provider: "card",
    extId: uuid,
    orderNo: order.no,
    amount: order.amount * 100,
    extTime: Date.now(),
    extra: JSON.stringify({ url }),
  });
  return url;
}

function signatureOk(b: any): boolean {
  if (typeof b?.signature !== "string" || typeof b?.octo_payment_UUID !== "string" || typeof b?.status !== "string") return false;
  const expected = createHash("sha1").update(`${octo.uniqueKey()}${b.octo_payment_UUID}${b.status}`).digest("hex");
  const a = Buffer.from(expected.toLowerCase());
  const g = Buffer.from(b.signature.toLowerCase());
  return a.length === g.length && timingSafeEqual(a, g);
}

export async function octoNotify(req: Request, res: Response) {
  const b = req.body ?? {};
  try {
    if (!octo.enabled() || !signatureOk(b)) {
      res.status(403).json({ error: "bad_signature" });
      return;
    }
    const tx = await findTx("card", String(b.octo_payment_UUID));
    const order = tx ? await getOrder(tx.orderNo) : undefined;
    if (!tx || !order || String(b.shop_transaction_id) !== `UD-${order.no}`) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    if (b.status === "succeeded") {
      if (Math.abs(Number(b.total_sum) - order.amount) >= 0.01) {
        logger.error({ order: order.no, total: b.total_sum }, "octo amount mismatch");
        res.status(400).json({ error: "amount" });
        return;
      }
      if (tx.state === 1 && (await fulfillOrder(order.no))) {
        await transitionTx(tx.id, 1, { state: 2, performTime: Date.now() });
      }
    } else if (b.status === "canceled" || b.status === "cancelled") {
      if (tx.state === 1) await transitionTx(tx.id, 1, { state: -1, cancelTime: Date.now() });
      else if (tx.state === 2 && (await transitionTx(tx.id, 2, { state: -2, cancelTime: Date.now() }))) {
        await revokeOrder(order.no);
      }
    }
    // auto_capture is on, so there is never a hold to accept or decline.
    res.json({ accept_status: "capture" });
  } catch (err) {
    logger.error({ err }, "octo notify error");
    res.status(500).json({ error: "server" });
  }
}
