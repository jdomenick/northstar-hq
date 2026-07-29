// Client-safe billing shapes for the public proposal surface.
// Nothing here may contain internal identifiers (invoice ids, client ids,
// organization ids, Stripe customer ids) or internal audit data.

export type PublicInvoicePurpose = "setup_deposit" | "setup_final" | "recurring" | "other";

export interface PublicInvoice {
  purpose: PublicInvoicePurpose;
  label: string;
  status: string;
  amount_cents: number;
  amount_paid_cents: number;
  amount_remaining_cents: number;
  currency: string;
  due_at: string | null;
  paid_at: string | null;
  payment_url: string | null;
  receipt_url: string | null;
}

export interface PublicSubscription {
  status: string;
  amount_cents: number;
  currency: string;
  interval: string;
  current_period_end: string | null;
}

export interface PublicBilling {
  invoices: PublicInvoice[];
  subscription: PublicSubscription | null;
}

export interface ClientNextStep {
  headline: string;
  detail: string;
  action: "pay" | "wait" | "none";
}

export const INVOICE_LABEL: Record<PublicInvoicePurpose, string> = {
  setup_deposit: "Initial deposit",
  setup_final: "Remaining setup balance",
  recurring: "Monthly service",
  other: "Invoice",
};

function isOpen(i: PublicInvoice) {
  return i.status === "open";
}

function isPaid(i: PublicInvoice) {
  return i.status === "paid" || i.status === "partially_refunded" || i.status === "refunded";
}

/**
 * Deterministic next-step derivation from reconciled billing state.
 * Never infers payment from browser state.
 */
export function deriveNextStep(billing: PublicBilling, recurringFeeCents: number): ClientNextStep {
  const invoices = billing.invoices;
  const deposit = invoices.find((i) => i.purpose === "setup_deposit");
  const final = invoices.find((i) => i.purpose === "setup_final");
  const sub = billing.subscription;

  if (deposit && isOpen(deposit)) {
    return {
      headline: "Your initial invoice is ready. Complete payment to begin onboarding.",
      detail: "Payment is processed securely by Stripe. Onboarding begins once the deposit clears.",
      action: "pay",
    };
  }
  if (final && isOpen(final)) {
    return {
      headline: "Your remaining setup balance is ready for payment.",
      detail: "Completing this payment moves your engagement into implementation.",
      action: "pay",
    };
  }
  if (sub && (sub.status === "active" || sub.status === "trialing")) {
    return {
      headline: "Your NorthStar Labs service is active.",
      detail: "Recurring billing is running. Your team will continue working your engagement.",
      action: "none",
    };
  }
  if (deposit && isPaid(deposit) && final && isPaid(final)) {
    return {
      headline: "Your setup payments are complete. NorthStar Labs is preparing your onboarding and implementation.",
      detail: "You will be contacted with onboarding details and next actions.",
      action: "wait",
    };
  }
  if (deposit && isPaid(deposit)) {
    return {
      headline: "Your deposit has been received. NorthStar Labs will begin preparing your implementation.",
      detail: "Watch for your remaining balance invoice. You will receive an email when it is ready.",
      action: "wait",
    };
  }
  return {
    headline: "Your proposal has been accepted. NorthStar Labs is preparing your initial invoice.",
    detail: "You will receive an email when it is ready. No action is needed right now.",
    action: "wait",
  };
}

export const CLIENT_SAFE_UNAVAILABLE =
  "This proposal link is unavailable, expired, or has been replaced. Contact NorthStar Labs for a new link.";