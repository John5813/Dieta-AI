/**
 * Uzum Bank Merchant API: Uzum calls five webhooks on our side
 * (check → create → confirm, plus reverse and status). Amounts are in tiyin,
 * requests use HTTP Basic auth, and the order number arrives in `params`.
 */
import type { Request, Response } from "express";
import { timingSafeEqual } from "crypto";
import { uzum } from "./config";
import { fulfillOrder, getOrder, revokeOrder } from "./orders";
import { findTx, insertTx, transitionTx } from "./transactions";
import type { PayTransaction, WebOrder } from "@workspace/db";
import { logger } from "../logger";

const CODE = {
  access: "10001",
  json: "10002",
  operation: "10003",
  missing: "10005",
  service: "10006",
  account: "10007",
  alreadyPaid: "10008",
  cancelled: "10009",
  amount: "10011",
  txNotFound: "10014",
} as const;

class UzumError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

function authorized(req: Request): boolean {
  const m = /^Basic\s+(.+)$/i.exec(req.headers.authorization ?? "");
  if (!m) return false;
  const a = Buffer.from(Buffer.from(m[1]!, "base64").toString("utf8"));
  const b = Buffer.from(`${uzum.login()}:${uzum.password()}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

function orderNoFrom(params: unknown): number {
  const p = (params && typeof params === "object" ? params : {}) as Record<string, unknown>;
  return Number(p.account ?? p.order_id ?? p.orderId);
}

async function orderFrom(params: unknown): Promise<WebOrder> {
  const order = await getOrder(orderNoFrom(params));
  if (!order || order.provider !== "uzum") throw new UzumError(CODE.account);
  return order;
}

const STATUS: Record<number, string> = { 1: "CREATED", 2: "CONFIRMED", [-1]: "REVERSED", [-2]: "REVERSED" };

function txBody(tx: PayTransaction, serviceId: unknown) {
  return {
    serviceId,
    transId: tx.extId,
    status: STATUS[tx.state] ?? "FAILED",
    transTime: tx.createTime,
    confirmTime: tx.performTime || null,
    reverseTime: tx.cancelTime || null,
    data: { account: { value: String(tx.orderNo) } },
    amount: tx.amount,
  };
}

async function handle(op: string, b: any): Promise<object> {
  switch (op) {
    case "check": {
      const order = await orderFrom(b.params);
      if (order.status === "paid") throw new UzumError(CODE.alreadyPaid);
      if (order.status !== "created") throw new UzumError(CODE.cancelled);
      return { serviceId: b.serviceId, timestamp: Date.now(), status: "OK", data: { account: { value: String(order.no) } } };
    }
    case "create": {
      if (!b.transId || b.amount === undefined) throw new UzumError(CODE.missing);
      const existing = await findTx("uzum", String(b.transId));
      if (existing) return txBody(existing, b.serviceId);
      const order = await orderFrom(b.params);
      if (order.status === "paid") throw new UzumError(CODE.alreadyPaid);
      if (order.status !== "created") throw new UzumError(CODE.cancelled);
      if (Number(b.amount) !== order.amount * 100) throw new UzumError(CODE.amount);
      const tx = await insertTx({
        provider: "uzum",
        extId: String(b.transId),
        orderNo: order.no,
        amount: Number(b.amount),
        extTime: Number(b.timestamp) || Date.now(),
      });
      return txBody(tx, b.serviceId);
    }
    case "confirm": {
      const tx = await findTx("uzum", String(b.transId ?? ""));
      if (!tx) throw new UzumError(CODE.txNotFound);
      if (tx.state === 2) return txBody(tx, b.serviceId);
      if (tx.state < 0) throw new UzumError(CODE.cancelled);
      const ok = await fulfillOrder(tx.orderNo);
      if (!ok) throw new UzumError(CODE.cancelled);
      const done = (await transitionTx(tx.id, 1, { state: 2, performTime: Date.now() })) ?? (await findTx("uzum", tx.extId))!;
      return txBody(done, b.serviceId);
    }
    case "reverse": {
      const tx = await findTx("uzum", String(b.transId ?? ""));
      if (!tx) throw new UzumError(CODE.txNotFound);
      if (tx.state < 0) return txBody(tx, b.serviceId);
      const next = tx.state === 2 ? -2 : -1;
      const done = (await transitionTx(tx.id, tx.state, { state: next, cancelTime: Date.now() })) ?? (await findTx("uzum", tx.extId))!;
      if (tx.state === 2 && done.state === -2) await revokeOrder(tx.orderNo);
      return txBody(done, b.serviceId);
    }
    case "status": {
      const tx = await findTx("uzum", String(b.transId ?? ""));
      if (!tx) throw new UzumError(CODE.txNotFound);
      return txBody(tx, b.serviceId);
    }
    default:
      throw new UzumError(CODE.operation);
  }
}

export function uzumWebhook(op: string) {
  return async (req: Request, res: Response) => {
    const b = req.body ?? {};
    const fail = (code: string) =>
      res.status(400).json({ serviceId: b.serviceId ?? null, timestamp: Date.now(), status: "FAILED", errorCode: code });
    try {
      if (!uzum.enabled() || !authorized(req)) {
        fail(CODE.access);
        return;
      }
      if (String(b.serviceId) !== uzum.serviceId()) {
        fail(CODE.service);
        return;
      }
      res.status(200).json(await handle(op, b));
    } catch (err) {
      if (err instanceof UzumError) {
        fail(err.code);
        return;
      }
      logger.error({ err, op }, "uzum webhook error");
      fail(CODE.operation);
    }
  };
}

/** Opens the Uzum Bank payment screen for this order. */
export function uzumCheckoutUrl(order: WebOrder, returnUrl: string): string {
  const q = new URLSearchParams({
    serviceId: uzum.serviceId(),
    order_id: String(order.no),
    amount: String(order.amount * 100),
    redirectUrl: returnUrl,
  });
  return `${uzum.checkoutUrl()}?${q.toString()}`;
}
