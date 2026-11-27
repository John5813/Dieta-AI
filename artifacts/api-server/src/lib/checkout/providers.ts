/**
 * Online payment for meal subscriptions (website checkout).
 *
 * MEAL_PAYMENT_MODE=demo (default): Payme / Click / Uzum buttons work in demo mode — the
 * order is marked paid at once (no money moves) and is labelled "demo" everywhere.
 *
 * Going live: implement `start()` for a provider so it returns { status: "redirect", url }
 * (the merchant's checkout page), and call `markOrderPaid()` from lib/checkout/service.ts in
 * that merchant's webhook once the payment is confirmed. The app-Premium integration in
 * lib/pay (Click / Payme / Uzum merchant APIs) shows the request signing to reuse.
 */

export type PayProviderId = "payme" | "click" | "uzum";
export type PaymentMode = "demo" | "live";

export const PAY_PROVIDERS: { id: PayProviderId; title: string }[] = [
  { id: "payme", title: "Payme" },
  { id: "click", title: "Click" },
  { id: "uzum", title: "Uzum" },
];

export function paymentMode(): PaymentMode {
  return process.env["MEAL_PAYMENT_MODE"]?.trim() === "live" ? "live" : "demo";
}

export interface StartInput {
  orderId: number;
  /** so'm */
  amount: number;
  description: string;
  returnUrl: string;
}
export type StartResult = { status: "paid"; ref: string } | { status: "redirect"; url: string };

export interface MealPaymentProvider {
  id: PayProviderId;
  mode: PaymentMode;
  start(input: StartInput): Promise<StartResult>;
}

/** Demo: "paid" immediately with a recognisable reference. */
function demoProvider(id: PayProviderId): MealPaymentProvider {
  return {
    id,
    mode: "demo",
    async start(input) {
      return { status: "paid", ref: `DEMO-${id.toUpperCase()}-${input.orderId}-${Date.now().toString(36).toUpperCase()}` };
    },
  };
}

/** Live merchant adapters go here (one per provider). None is connected yet. */
const LIVE: Partial<Record<PayProviderId, MealPaymentProvider>> = {};

export function getProvider(id: unknown): MealPaymentProvider | null {
  const p = PAY_PROVIDERS.find((x) => x.id === id);
  if (!p) return null;
  return paymentMode() === "demo" ? demoProvider(p.id) : LIVE[p.id] ?? null;
}

/** What the website shows: the mode and the providers that can take a payment right now. */
export function paymentsForSite(): { mode: PaymentMode; providers: { id: PayProviderId; title: string }[] } {
  const mode = paymentMode();
  return { mode, providers: PAY_PROVIDERS.filter((p) => mode === "demo" || LIVE[p.id]) };
}
