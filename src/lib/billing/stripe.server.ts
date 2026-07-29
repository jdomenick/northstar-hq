// Stripe server client. Fails safely if configuration is missing.
// Never call getStripe() at module scope — always call inside a handler.

import Stripe from "stripe";

export class BillingConfigError extends Error {
  code = "BILLING_NOT_CONFIGURED" as const;
  constructor(message: string) {
    super(message);
    this.name = "BillingConfigError";
  }
}

let cached: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || !/^sk_(test|live)_/.test(key)) {
    throw new BillingConfigError(
      "STRIPE_SECRET_KEY is missing or malformed. Billing is not available.",
    );
  }
  if (cached) return cached;
  cached = new Stripe(key, {
    typescript: true,
    telemetry: false,
    maxNetworkRetries: 2,
  });
  return cached;
}

export function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || secret.length < 8) {
    throw new BillingConfigError(
      "STRIPE_WEBHOOK_SECRET is missing. Webhook verification is not available.",
    );
  }
  return secret;
}

export function isBillingConfigured(): boolean {
  const key = process.env.STRIPE_SECRET_KEY;
  const whsec = process.env.STRIPE_WEBHOOK_SECRET;
  return Boolean(key && /^sk_(test|live)_/.test(key) && whsec && whsec.length >= 8);
}

/** True iff STRIPE_SECRET_KEY is a LIVE key. Used to stamp DB rows so test
 *  and live records can never be confused. */
export function isStripeLive(): boolean {
  return (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_live_");
}

/** Safe extractor: never surfaces secret values in logs/responses. */
export function stripeErrorMessage(err: unknown): string {
  if (err instanceof Stripe.errors.StripeError) {
    return `${err.type}: ${err.message}`;
  }
  if (err instanceof Error) return err.message;
  return "Unknown Stripe error";
}