/**
 * Website payment configuration. Everything comes from environment variables
 * so merchant keys never live in the repo. A provider shows up on the payment
 * page only when all of its variables are set.
 */

export type ProviderId = "click" | "payme" | "uzum" | "card";

export interface Plan {
  id: string;
  months: number;
  /** Price in so'm. */
  amount: number;
}

const env = (k: string) => process.env[k]?.trim() || "";

/** Yearly premium at the price the Telegram flow already charges. */
const DEFAULT_PLANS: Plan[] = [{ id: "year", months: 12, amount: 260_000 }];

/** PREMIUM_PLANS='[{"id":"month","months":1,"amount":49000},{"id":"year","months":12,"amount":260000}]' */
export function getPlans(): Plan[] {
  const raw = env("PREMIUM_PLANS");
  if (!raw) return DEFAULT_PLANS;
  try {
    const parsed = JSON.parse(raw) as Plan[];
    const ok = parsed.filter(
      (p) =>
        p &&
        typeof p.id === "string" &&
        /^[a-z0-9_-]{1,20}$/.test(p.id) &&
        Number.isInteger(p.months) &&
        p.months > 0 &&
        p.months <= 36 &&
        Number.isInteger(p.amount) &&
        p.amount >= 1000,
    );
    return ok.length ? ok : DEFAULT_PLANS;
  } catch {
    return DEFAULT_PLANS;
  }
}

export function findPlan(id: string): Plan | undefined {
  return getPlans().find((p) => p.id === id);
}

/** Public https origin of this server, used for provider return/notify URLs. */
export function publicBaseUrl(fallbackHost?: string): string {
  const configured = env("PUBLIC_BASE_URL").replace(/\/+$/, "");
  if (configured) return configured;
  if (fallbackHost) return `https://${fallbackHost}`;
  return "https://dietaai-lexhk.ondigitalocean.app";
}

export const click = {
  serviceId: () => env("CLICK_SERVICE_ID"),
  merchantId: () => env("CLICK_MERCHANT_ID"),
  secretKey: () => env("CLICK_SECRET_KEY"),
  enabled() {
    return !!(this.serviceId() && this.merchantId() && this.secretKey());
  },
};

export const payme = {
  merchantId: () => env("PAYME_MERCHANT_ID"),
  /** Cashbox key (test key while PAYME_TEST=1). */
  key: () => env("PAYME_KEY"),
  test: () => env("PAYME_TEST") === "1",
  /** Name of the account field configured in the Payme cabinet. */
  accountField: () => env("PAYME_ACCOUNT_FIELD") || "order_id",
  enabled() {
    return !!(this.merchantId() && this.key());
  },
};

export const uzum = {
  serviceId: () => env("UZUM_SERVICE_ID"),
  /** Basic-auth credentials Uzum Bank uses when calling our webhooks. */
  login: () => env("UZUM_LOGIN"),
  password: () => env("UZUM_PASSWORD"),
  checkoutUrl: () => env("UZUM_CHECKOUT_URL") || "https://www.uzumbank.uz/open-service",
  enabled() {
    return !!(this.serviceId() && this.login() && this.password());
  },
};

/** Visa / Mastercard / Humo / Uzcard through Octo (octo.uz). */
export const octo = {
  shopId: () => env("OCTO_SHOP_ID"),
  secret: () => env("OCTO_SECRET"),
  /** "Unique key" from the Octo cabinet, used to verify notification signatures. */
  uniqueKey: () => env("OCTO_UNIQUE_KEY"),
  test: () => env("OCTO_TEST") === "1",
  apiUrl: () => env("OCTO_API_URL") || "https://secure.octo.uz",
  enabled() {
    return !!(this.shopId() && this.secret() && this.uniqueKey());
  },
};

export function enabledProviders(): ProviderId[] {
  const list: ProviderId[] = [];
  if (click.enabled()) list.push("click");
  if (payme.enabled()) list.push("payme");
  if (uzum.enabled()) list.push("uzum");
  if (octo.enabled()) list.push("card");
  return list;
}

/** Seller details that Click/Payme moderation expects to see on the site. */
export const merchantInfo = () => ({
  legalName: env("MERCHANT_LEGAL_NAME") || "Muydinov Javlonbek",
  inn: env("MERCHANT_INN"),
  address: env("MERCHANT_ADDRESS"),
  phone: env("MERCHANT_PHONE"),
  email: env("MERCHANT_EMAIL") || "moydinovjavlonbek5813@gmail.com",
  telegram: env("MERCHANT_TELEGRAM"),
});

/** Payme/Click keep a pending transaction for 12 hours. */
export const TX_TIMEOUT_MS = 12 * 60 * 60 * 1000;
