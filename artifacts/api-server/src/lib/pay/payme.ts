/**
 * Payme (Paycom) Merchant API: JSON-RPC 2.0 callbacks from Payme to us.
 * https://developer.help.paycom.uz/metody-merchant-api/
 *
 * Amounts are in tiyin. The order number is passed in `account[PAYME_ACCOUNT_FIELD]`.
 */
import type { Request, Response } from "express";
import { timingSafeEqual } from "crypto";
import { payme, TX_TIMEOUT_MS } from "./config";
import { fulfillOrder, getOrder, revokeOrder } from "./orders";
import { activeTxForOrder, findTx, insertTx, transitionTx, txByExtTime } from "./transactions";
import type { PayTransaction, WebOrder } from "@workspace/db";
import { logger } from "../logger";

type Msg = { ru: string; uz: string; en: string };

class RpcError extends Error {
  constructor(public code: number, public msg: Msg, public data?: string) {
    super(msg.en);
  }
}

const E = {
  auth: () => new RpcError(-32504, { ru: "Недостаточно привилегий", uz: "Ruxsat yo'q", en: "Insufficient privileges" }),
  parse: () => new RpcError(-32700, { ru: "Ошибка разбора JSON", uz: "JSON xato", en: "Parse error" }),
  method: () => new RpcError(-32601, { ru: "Метод не найден", uz: "Metod topilmadi", en: "Method not found" }),
  params: () => new RpcError(-32600, { ru: "Неверный запрос", uz: "Noto'g'ri so'rov", en: "Invalid request" }),
  amount: () => new RpcError(-31001, { ru: "Неверная сумма", uz: "Noto'g'ri summa", en: "Incorrect amount" }),
  txNotFound: () => new RpcError(-31003, { ru: "Транзакция не найдена", uz: "Tranzaksiya topilmadi", en: "Transaction not found" }),
  cannotPerform: () => new RpcError(-31008, { ru: "Невозможно выполнить операцию", uz: "Amalni bajarib bo'lmaydi", en: "Unable to perform operation" }),
  orderNotFound: (field: string) =>
    new RpcError(-31050, { ru: "Заказ не найден", uz: "Buyurtma topilmadi", en: "Order not found" }, field),
  orderBusy: (field: string) =>
    new RpcError(-31050, { ru: "Заказ ожидает оплаты", uz: "Buyurtma to'lovni kutmoqda", en: "Order is awaiting payment" }, field),
  orderClosed: (field: string) =>
    new RpcError(-31051, { ru: "Заказ уже оплачен или отменён", uz: "Buyurtma to'langan yoki bekor qilingan", en: "Order already paid or cancelled" }, field),
};

function authorized(req: Request): boolean {
  const header = req.headers.authorization ?? "";
  const m = /^Basic\s+(.+)$/i.exec(header);
  if (!m) return false;
  const decoded = Buffer.from(m[1]!, "base64").toString("utf8");
  const expected = `Paycom:${payme.key()}`;
  const a = Buffer.from(decoded);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function orderFromAccount(account: unknown): Promise<WebOrder> {
  const field = payme.accountField();
  const raw = account && typeof account === "object" ? (account as Record<string, unknown>)[field] : undefined;
  const no = Number(raw);
  const order = Number.isSafeInteger(no) ? await getOrder(no) : undefined;
  if (!order || order.provider !== "payme") throw E.orderNotFound(field);
  return order;
}

function checkAmount(order: WebOrder, amount: unknown) {
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount !== order.amount * 100) throw E.amount();
}

const isExpired = (tx: PayTransaction) => Date.now() - tx.createTime > TX_TIMEOUT_MS;

async function cancelExpired(tx: PayTransaction) {
  await transitionTx(tx.id, 1, { state: -1, cancelTime: Date.now(), reason: 4 });
}

async function checkPerform(params: any) {
  const order = await orderFromAccount(params?.account);
  checkAmount(order, params?.amount);
  if (order.status !== "created") throw E.orderClosed(payme.accountField());
  return order;
}

const txView = (tx: PayTransaction) => ({
  create_time: tx.createTime,
  perform_time: tx.performTime,
  cancel_time: tx.cancelTime,
  transaction: String(tx.id),
  state: tx.state,
  reason: tx.reason ?? null,
});

async function handle(method: string, params: any): Promise<unknown> {
  switch (method) {
    case "CheckPerformTransaction": {
      await checkPerform(params);
      return { allow: true };
    }

    case "CreateTransaction": {
      if (typeof params?.id !== "string" || typeof params?.time !== "number") throw E.params();
      const existing = await findTx("payme", params.id);
      if (existing) {
        if (existing.state !== 1) throw E.cannotPerform();
        if (isExpired(existing)) {
          await cancelExpired(existing);
          throw E.cannotPerform();
        }
        return { create_time: existing.createTime, transaction: String(existing.id), state: existing.state };
      }
      const order = await checkPerform(params);
      const busy = await activeTxForOrder("payme", order.no);
      if (busy) {
        if (!isExpired(busy)) throw E.orderBusy(payme.accountField());
        await cancelExpired(busy);
      }
      const tx = await insertTx({
        provider: "payme",
        extId: params.id,
        orderNo: order.no,
        amount: params.amount,
        extTime: params.time,
      });
      if (tx.orderNo !== order.no) throw E.cannotPerform();
      return { create_time: tx.createTime, transaction: String(tx.id), state: tx.state };
    }

    case "PerformTransaction": {
      const tx = await findTx("payme", String(params?.id ?? ""));
      if (!tx) throw E.txNotFound();
      if (tx.state === 2) return { transaction: String(tx.id), perform_time: tx.performTime, state: 2 };
      if (tx.state !== 1) throw E.cannotPerform();
      if (isExpired(tx)) {
        await cancelExpired(tx);
        throw E.cannotPerform();
      }
      const ok = await fulfillOrder(tx.orderNo);
      if (!ok) throw E.cannotPerform();
      const done = (await transitionTx(tx.id, 1, { state: 2, performTime: Date.now() })) ?? (await findTx("payme", tx.extId))!;
      if (done.state !== 2) throw E.cannotPerform();
      return { transaction: String(done.id), perform_time: done.performTime, state: 2 };
    }

    case "CancelTransaction": {
      const tx = await findTx("payme", String(params?.id ?? ""));
      if (!tx) throw E.txNotFound();
      const reason = Number.isInteger(params?.reason) ? params.reason : null;
      let current = tx;
      if (tx.state === 1) {
        current = (await transitionTx(tx.id, 1, { state: -1, cancelTime: Date.now(), reason })) ?? (await findTx("payme", tx.extId))!;
      } else if (tx.state === 2) {
        // Premium is a digital service with no shipment to stop, so a refund
        // simply takes the premium back.
        current = (await transitionTx(tx.id, 2, { state: -2, cancelTime: Date.now(), reason })) ?? (await findTx("payme", tx.extId))!;
        if (current.state === -2) await revokeOrder(tx.orderNo);
      }
      return { transaction: String(current.id), cancel_time: current.cancelTime, state: current.state };
    }

    case "CheckTransaction": {
      const tx = await findTx("payme", String(params?.id ?? ""));
      if (!tx) throw E.txNotFound();
      return txView(tx);
    }

    case "GetStatement": {
      const from = Number(params?.from);
      const to = Number(params?.to);
      if (!Number.isFinite(from) || !Number.isFinite(to)) throw E.params();
      const list = await txByExtTime("payme", from, to);
      const field = payme.accountField();
      return {
        transactions: list.map((tx) => ({
          id: tx.extId,
          time: tx.extTime,
          amount: tx.amount,
          account: { [field]: String(tx.orderNo) },
          ...txView(tx),
          receivers: null,
        })),
      };
    }

    case "ChangePassword":
      // The key lives in an environment variable; refuse rather than pretend.
      throw E.cannotPerform();

    default:
      throw E.method();
  }
}

export async function paymeWebhook(req: Request, res: Response) {
  const body = req.body ?? {};
  const id = body.id ?? null;
  const reply = (payload: object) => res.status(200).json({ jsonrpc: "2.0", id, ...payload });
  try {
    if (!payme.enabled()) throw E.method();
    if (!authorized(req)) throw E.auth();
    if (typeof body.method !== "string") throw E.parse();
    const result = await handle(body.method, body.params ?? {});
    reply({ result });
  } catch (err) {
    if (err instanceof RpcError) {
      reply({ error: { code: err.code, message: err.msg, ...(err.data ? { data: err.data } : {}) } });
      return;
    }
    logger.error({ err }, "payme webhook error");
    reply({ error: { code: -32400, message: { ru: "Системная ошибка", uz: "Tizim xatosi", en: "System error" } } });
  }
}

/** Link to Payme's hosted checkout for an order. */
export function paymeCheckoutUrl(order: WebOrder, returnUrl: string, lang: string): string {
  const l = lang === "ru" ? "ru" : lang === "uz" || lang === "uz-kril" ? "uz" : "en";
  const params = [
    `m=${payme.merchantId()}`,
    `ac.${payme.accountField()}=${order.no}`,
    `a=${order.amount * 100}`,
    `c=${returnUrl}`,
    `l=${l}`,
  ].join(";");
  const base = payme.test() ? "https://checkout.test.paycom.uz" : "https://checkout.paycom.uz";
  return `${base}/${Buffer.from(params).toString("base64")}`;
}
