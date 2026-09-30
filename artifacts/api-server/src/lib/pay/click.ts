/**
 * Click SHOP API: two-step Prepare / Complete callbacks from Click to us.
 * https://docs.click.uz/click-api-request/
 *
 * Amounts are in so'm (may arrive as "260000.00"). The order number travels as
 * `merchant_trans_id` (set via `transaction_param` in the checkout link).
 */
import type { Request, Response } from "express";
import { createHash, timingSafeEqual } from "crypto";
import { click } from "./config";
import { fulfillOrder, getOrder } from "./orders";
import { findTxById, insertTx, transitionTx } from "./transactions";
import type { WebOrder } from "@workspace/db";
import { logger } from "../logger";

const ERR = {
  ok: [0, "Success"],
  sign: [-1, "SIGN CHECK FAILED!"],
  amount: [-2, "Incorrect parameter amount"],
  action: [-3, "Action not found"],
  paid: [-4, "Already paid"],
  order: [-5, "User does not exist"],
  tx: [-6, "Transaction does not exist"],
  update: [-7, "Failed to update user"],
  request: [-8, "Error in request from click"],
  cancelled: [-9, "Transaction cancelled"],
} as const;

type ClickBody = Record<string, string | undefined>;

const md5 = (s: string) => createHash("md5").update(s).digest("hex");

function signOk(b: ClickBody, withPrepareId: boolean): boolean {
  const parts = [
    b.click_trans_id,
    b.service_id,
    click.secretKey(),
    b.merchant_trans_id,
    ...(withPrepareId ? [b.merchant_prepare_id] : []),
    b.amount,
    b.action,
    b.sign_time,
  ];
  if (parts.some((p) => p === undefined)) return false;
  const expected = Buffer.from(md5(parts.join("")));
  const got = Buffer.from(String(b.sign_string ?? "").toLowerCase());
  return expected.length === got.length && timingSafeEqual(expected, got);
}

function amountOk(order: WebOrder, raw: string | undefined): boolean {
  const n = Number(raw);
  return Number.isFinite(n) && Math.abs(n - order.amount) < 0.01;
}

async function loadOrder(b: ClickBody): Promise<WebOrder | undefined> {
  const order = await getOrder(Number(b.merchant_trans_id));
  return order && order.provider === "click" ? order : undefined;
}

export async function clickPrepare(req: Request, res: Response) {
  const b = (req.body ?? {}) as ClickBody;
  const reply = (e: readonly [number, string], prepareId?: number) =>
    res.json({
      click_trans_id: b.click_trans_id,
      merchant_trans_id: b.merchant_trans_id,
      merchant_prepare_id: prepareId ?? null,
      error: e[0],
      error_note: e[1],
    });
  try {
    if (!click.enabled() || b.service_id !== click.serviceId() || !signOk(b, false)) return reply(ERR.sign);
    if (b.action !== "0") return reply(ERR.action);
    const order = await loadOrder(b);
    if (!order) return reply(ERR.order);
    if (order.status === "paid") return reply(ERR.paid);
    if (order.status !== "created") return reply(ERR.cancelled);
    if (!amountOk(order, b.amount)) return reply(ERR.amount);

    const tx = await insertTx({
      provider: "click",
      extId: String(b.click_trans_id),
      orderNo: order.no,
      amount: Math.round(Number(b.amount) * 100),
      extTime: Date.now(),
      extra: b.click_paydoc_id ? JSON.stringify({ paydoc: b.click_paydoc_id }) : null,
    });
    if (tx.orderNo !== order.no) return reply(ERR.tx);
    if (tx.state < 0) return reply(ERR.cancelled);
    return reply(ERR.ok, tx.id);
  } catch (err) {
    logger.error({ err }, "click prepare error");
    return reply(ERR.update);
  }
}

export async function clickComplete(req: Request, res: Response) {
  const b = (req.body ?? {}) as ClickBody;
  const reply = (e: readonly [number, string], confirmId?: number) =>
    res.json({
      click_trans_id: b.click_trans_id,
      merchant_trans_id: b.merchant_trans_id,
      merchant_confirm_id: confirmId ?? null,
      error: e[0],
      error_note: e[1],
    });
  try {
    if (!click.enabled() || b.service_id !== click.serviceId() || !signOk(b, true)) return reply(ERR.sign);
    if (b.action !== "1") return reply(ERR.action);
    const order = await loadOrder(b);
    if (!order) return reply(ERR.order);
    const tx = await findTxById(Number(b.merchant_prepare_id));
    if (!tx || tx.provider !== "click" || tx.extId !== String(b.click_trans_id) || tx.orderNo !== order.no) {
      return reply(ERR.tx);
    }
    if (tx.state === 2) return reply(ERR.paid, tx.id);
    if (tx.state < 0) return reply(ERR.cancelled);
    if (!amountOk(order, b.amount)) return reply(ERR.amount);

    // Click reports a failed charge with a negative `error`: cancel our side.
    if (Number(b.error) < 0) {
      await transitionTx(tx.id, 1, { state: -1, cancelTime: Date.now(), reason: Number(b.error) });
      return reply(ERR.cancelled);
    }
    if (order.status === "paid") {
      // Paid through another Click transaction — don't take money twice.
      await transitionTx(tx.id, 1, { state: -1, cancelTime: Date.now() });
      return reply(ERR.paid);
    }
    if (order.status !== "created") return reply(ERR.cancelled);

    const ok = await fulfillOrder(order.no);
    if (!ok) return reply(ERR.update);
    await transitionTx(tx.id, 1, { state: 2, performTime: Date.now() });
    return reply(ERR.ok, tx.id);
  } catch (err) {
    logger.error({ err }, "click complete error");
    return reply(ERR.update);
  }
}

/** Link to Click's hosted checkout for an order. */
export function clickCheckoutUrl(order: WebOrder, returnUrl: string): string {
  const q = new URLSearchParams({
    service_id: click.serviceId(),
    merchant_id: click.merchantId(),
    amount: String(order.amount),
    transaction_param: String(order.no),
    return_url: returnUrl,
  });
  return `https://my.click.uz/services/pay?${q.toString()}`;
}

