// Truthful billing audit trail. Never persists Stripe secrets.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type BillingEventType =
  | "customer_created"
  | "invoice_created"
  | "invoice_finalized"
  | "invoice_sent"
  | "invoice_payment_failed"
  | "setup_deposit_paid"
  | "onboarding_payment_complete"
  | "setup_final_paid"
  | "ready_for_go_live"
  | "subscription_created"
  | "subscription_updated"
  | "subscription_canceled"
  | "recurring_billing_active"
  | "refund_issued";

/** Strip anything that could ever be a secret from a payload. */
function sanitizePayload(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object") return {};
  const bad = /^(client_secret|api_key|secret|password|authorization|token)$/i;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
    if (bad.test(k)) continue;
    if (v && typeof v === "object") {
      out[k] = sanitizePayload(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export async function recordBillingEvent(
  supabase: SupabaseClient<Database>,
  input: {
    organization_id: string;
    event_type: BillingEventType;
    client_id?: string | null;
    proposal_id?: string | null;
    invoice_id?: string | null;
    subscription_id?: string | null;
    actor_id?: string | null;
    actor_type?: "user" | "system" | "stripe";
    payload?: unknown;
  },
): Promise<void> {
  const { error } = await supabase.from("billing_events").insert({
    organization_id: input.organization_id,
    event_type: input.event_type,
    client_id: input.client_id ?? null,
    proposal_id: input.proposal_id ?? null,
    invoice_id: input.invoice_id ?? null,
    subscription_id: input.subscription_id ?? null,
    actor_id: input.actor_id ?? null,
    actor_type: input.actor_type ?? "system",
    payload: sanitizePayload(input.payload ?? {}) as never,
  });
  if (error) {
    // Audit failure must not crash the caller, but is logged.
    // eslint-disable-next-line no-console
    console.error("[billing_events] insert failed", error.message);
  }
}

export { sanitizePayload };