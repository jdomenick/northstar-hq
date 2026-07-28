// Pure money helpers for billing. Integer cents only. No floating-point.

export type Money = { amount_cents: number; currency: string };

export const DEFAULT_CURRENCY = "USD";

/** ISO-4217 style 3-letter uppercase currency check. */
export function isValidCurrency(code: string | null | undefined): boolean {
  return typeof code === "string" && /^[A-Z]{3}$/.test(code);
}

export function normalizeCurrency(code: string | null | undefined): string {
  if (!code) return DEFAULT_CURRENCY;
  const up = code.toUpperCase();
  return isValidCurrency(up) ? up : DEFAULT_CURRENCY;
}

/**
 * Split a setup fee into deposit + final balance with deterministic rounding.
 * deposit = floor(setup / 2); final = setup - deposit.
 * Guarantees deposit + final === setup for all non-negative integers.
 */
export function splitSetupFee(setup_fee_cents: number): {
  deposit_cents: number;
  final_cents: number;
} {
  if (!Number.isInteger(setup_fee_cents) || setup_fee_cents < 0) {
    throw new Error(`invalid setup_fee_cents: ${String(setup_fee_cents)}`);
  }
  const deposit = Math.floor(setup_fee_cents / 2);
  const final_cents = setup_fee_cents - deposit;
  return { deposit_cents: deposit, final_cents };
}

/** Format an integer cents amount for en-US display. */
export function formatMoney(cents: number, currency = DEFAULT_CURRENCY): string {
  const c = Number(cents) || 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: normalizeCurrency(currency),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(c / 100);
}

/** Idempotency key builder. Stable per business operation. */
export function buildIdempotencyKey(...parts: Array<string | number>): string {
  return parts.map((p) => String(p)).join(":");
}