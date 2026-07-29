// Stripe webhook processor. Atomic claim + idempotent state sync.
// Callable ONLY from the server route after signature verification.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Stripe } from "stripe";
import type { Database } from "@/integrations/supabase/types";
import { recordBillingEvent } from "./events.server";
import { getStripe, isStripeLive } from "./stripe.server";

export type WebhookResult =
  | { kind: "already_processed" }
  | { kind: "processed" }
  | { kind: "failed"; retryable: true; message: string };

const HANDLED_EVENTS = new Set([
  "invoice.paid",
  "invoice.payment_failed",
  "invoice.finalized",
  "invoice.sent",
  "invoice.voided",
  "invoice.marked_uncollectible",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

function toInvoiceStatus(s: string | null | undefined) {
  const allowed = [
    "draft",
    "open",
    "paid",
    "void",
    "uncollectible",
    "refunded",
    "partially_refunded",
  ];
  return allowed.includes(s ?? "") ? (s as string) : "open";
}
function toSubStatus(s: string | null | undefined) {
  const allowed = [
    "incomplete",
    "incomplete_expired",
    "trialing",
    "active",
    "past_due",
    "canceled",
    "unpaid",
    "paused",
  ];
  return allowed.includes(s ?? "") ? (s as string) : "incomplete";
}

/**
 * Atomically claim the event. Returns:
 *  - "already_processed" -> return 200 immediately
 *  - "claimed" -> proceed to process
 *  - "retry_later" -> another worker is processing; return 200 to skip
 */
async function claimEvent(
  supabase: SupabaseClient<Database>,
  event: Stripe.Event,
): Promise<"already_processed" | "claimed" | "retry_later"> {
  const { data: existing } = await supabase
    .from("billing_webhook_events")
    .select("id, processing_status, attempt_count")
    .eq("stripe_event_id", event.id)
    .maybeSingle();

  if (existing?.processing_status === "processed") return "already_processed";

  if (!existing) {
    const { error } = await supabase.from("billing_webhook_events").insert({
      stripe_event_id: event.id,
      event_type: event.type,
      processing_status: "processing",
      attempt_count: 1,
      received_at: new Date().toISOString(),
      payload: event as never,
      livemode: Boolean(event.livemode),
    });
    if (error) {
      // Concurrent insert; treat as already claimed by another worker.
      return "retry_later";
    }
    return "claimed";
  }

  // Existing but not processed: allow retry.
  const { error: upErr } = await supabase
    .from("billing_webhook_events")
    .update({
      processing_status: "processing",
      attempt_count: (existing.attempt_count ?? 0) + 1,
      last_error: null,
    })
    .eq("id", existing.id)
    .eq("processing_status", existing.processing_status);
  if (upErr) return "retry_later";
  return "claimed";
}

async function markProcessed(supabase: SupabaseClient<Database>, eventId: string) {
  await supabase
    .from("billing_webhook_events")
    .update({
      processing_status: "processed",
      processed_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("stripe_event_id", eventId);
}
async function markFailed(
  supabase: SupabaseClient<Database>,
  eventId: string,
  message: string,
) {
  await supabase
    .from("billing_webhook_events")
    .update({ processing_status: "failed", last_error: message.slice(0, 500) })
    .eq("stripe_event_id", eventId);
}

async function syncInvoice(
  supabase: SupabaseClient<Database>,
  invoice: Stripe.Invoice,
): Promise<void> {
  if (!invoice.id) return;
  const { data: local } = await supabase
    .from("billing_invoices")
    .select("*")
    .eq("stripe_invoice_id", invoice.id)
    .maybeSingle();
  if (!local) return; // unknown invoice — not ours

  // Event snapshots can lag or omit amount_paid/hosted URLs; re-fetch from
  // Stripe when the event says "paid" or the snapshot is incomplete so the
  // ledger reflects real state rather than an in-flight partial payload.
  let source: Stripe.Invoice = invoice;
  const snapshotAmount = Number(invoice.amount_paid ?? 0);
  const needsRefresh =
    invoice.status === "paid" && (snapshotAmount <= 0 || !invoice.hosted_invoice_url);
  if (needsRefresh) {
    try {
      source = await getStripe().invoices.retrieve(invoice.id);
    } catch {
      // Fall back to snapshot; will still mark paid but amount may be 0.
    }
  }
  const status = toInvoiceStatus(source.status);
  const paidCents = Number(source.amount_paid ?? 0);
  const hosted = source.hosted_invoice_url ?? local.hosted_invoice_url;
  const pdf = source.invoice_pdf ?? local.invoice_pdf_url;

  await supabase
    .from("billing_invoices")
    .update({
      status: status as never,
      amount_paid_cents: paidCents,
      hosted_invoice_url: hosted,
      invoice_pdf_url: pdf,
      paid_at:
        status === "paid" && !local.paid_at
          ? new Date().toISOString()
          : local.paid_at,
    })
    .eq("id", local.id);

  // On paid: create payment row + emit readiness events.
  if (source.status === "paid" && paidCents > 0) {
    const chargeId: string | null = null;
    const piId =
      typeof (source as unknown as { payment_intent?: string | { id: string } })
        .payment_intent === "string"
        ? ((source as unknown as { payment_intent: string }).payment_intent)
        : ((source as unknown as { payment_intent?: { id: string } }).payment_intent?.id ??
          null);

    // Upsert-guard: check if a payment for this invoice/charge already exists.
    const { data: existingPay } = await supabase
      .from("billing_payments")
      .select("id")
      .eq("invoice_id", local.id)
      .eq("status", "succeeded" as never)
      .maybeSingle();
    if (!existingPay) {
      await supabase.from("billing_payments").insert({
        organization_id: local.organization_id,
        invoice_id: local.id,
        stripe_charge_id: chargeId,
        stripe_payment_intent_id: piId,
        amount_cents: paidCents,
        currency: local.currency,
        status: "succeeded" as never,
        paid_at: new Date().toISOString(),
        livemode: Boolean(source.livemode ?? local.livemode ?? false),
      });
    }

    if (local.type === "setup_deposit") {
      await recordBillingEvent(supabase, {
        organization_id: local.organization_id,
        client_id: local.client_id,
        proposal_id: local.proposal_id,
        invoice_id: local.id,
        event_type: "setup_deposit_paid",
        actor_type: "stripe",
        payload: { amount_cents: paidCents },
      });
      await recordBillingEvent(supabase, {
        organization_id: local.organization_id,
        client_id: local.client_id,
        proposal_id: local.proposal_id,
        invoice_id: local.id,
        event_type: "onboarding_payment_complete",
        actor_type: "stripe",
      });
    } else if (local.type === "setup_final") {
      await recordBillingEvent(supabase, {
        organization_id: local.organization_id,
        client_id: local.client_id,
        proposal_id: local.proposal_id,
        invoice_id: local.id,
        event_type: "setup_final_paid",
        actor_type: "stripe",
        payload: { amount_cents: paidCents },
      });
      await recordBillingEvent(supabase, {
        organization_id: local.organization_id,
        client_id: local.client_id,
        proposal_id: local.proposal_id,
        invoice_id: local.id,
        event_type: "ready_for_go_live",
        actor_type: "stripe",
      });
    }
  }

  if (source.status === "open" && source.attempted && source.next_payment_attempt === null) {
    await recordBillingEvent(supabase, {
      organization_id: local.organization_id,
      client_id: local.client_id,
      proposal_id: local.proposal_id,
      invoice_id: local.id,
      event_type: "invoice_payment_failed",
      actor_type: "stripe",
    });
  }
}

async function syncSubscription(
  supabase: SupabaseClient<Database>,
  sub: Stripe.Subscription,
  eventType: string,
): Promise<void> {
  const { data: local } = await supabase
    .from("billing_subscriptions")
    .select("*")
    .eq("stripe_subscription_id", sub.id)
    .maybeSingle();
  if (!local) return;

  const status = toSubStatus(sub.status);
  const item = sub.items?.data?.[0];
  const cancelAt = sub.cancel_at ? new Date(sub.cancel_at * 1000).toISOString() : null;
  const canceledAt = sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null;

  await supabase
    .from("billing_subscriptions")
    .update({
      status: status as never,
      current_period_start: item?.current_period_start
        ? new Date(item.current_period_start * 1000).toISOString()
        : local.current_period_start,
      current_period_end: item?.current_period_end
        ? new Date(item.current_period_end * 1000).toISOString()
        : local.current_period_end,
      cancel_at: cancelAt,
      canceled_at: canceledAt,
    })
    .eq("id", local.id);

  if (eventType === "customer.subscription.deleted") {
    await recordBillingEvent(supabase, {
      organization_id: local.organization_id,
      client_id: local.client_id,
      proposal_id: local.proposal_id,
      subscription_id: local.id,
      event_type: "subscription_canceled",
      actor_type: "stripe",
    });
  } else if (eventType === "customer.subscription.updated") {
    await recordBillingEvent(supabase, {
      organization_id: local.organization_id,
      client_id: local.client_id,
      proposal_id: local.proposal_id,
      subscription_id: local.id,
      event_type: "subscription_updated",
      actor_type: "stripe",
      payload: { status },
    });
  }
  if (
    (status === "active" || status === "trialing") &&
    local.status !== "active" &&
    local.status !== "trialing"
  ) {
    await recordBillingEvent(supabase, {
      organization_id: local.organization_id,
      client_id: local.client_id,
      proposal_id: local.proposal_id,
      subscription_id: local.id,
      event_type: "recurring_billing_active",
      actor_type: "stripe",
    });
  }
}

export async function processStripeEvent(
  supabase: SupabaseClient<Database>,
  event: Stripe.Event,
): Promise<WebhookResult> {
  // Mode isolation: a live app must reject test events and vice versa. This
  // prevents cross-contamination even if webhook secrets were misconfigured.
  if (Boolean(event.livemode) !== isStripeLive()) {
    return {
      kind: "failed",
      retryable: true,
      message: `mode_mismatch: event livemode=${event.livemode} app livemode=${isStripeLive()}`,
    };
  }
  if (!HANDLED_EVENTS.has(event.type)) {
    // Persist for observability but don't retry.
    const { data: existing } = await supabase
      .from("billing_webhook_events")
      .select("id")
      .eq("stripe_event_id", event.id)
      .maybeSingle();
    if (!existing) {
      await supabase.from("billing_webhook_events").insert({
        stripe_event_id: event.id,
        event_type: event.type,
        processing_status: "processed",
        received_at: new Date().toISOString(),
        processed_at: new Date().toISOString(),
        payload: event as never,
        livemode: Boolean(event.livemode),
      });
    }
    return { kind: "already_processed" };
  }

  const claim = await claimEvent(supabase, event);
  if (claim === "already_processed") return { kind: "already_processed" };
  if (claim === "retry_later") return { kind: "already_processed" };

  try {
    const obj = event.data.object as unknown;
    switch (event.type) {
      case "invoice.paid":
      case "invoice.payment_failed":
      case "invoice.finalized":
      case "invoice.sent":
      case "invoice.voided":
      case "invoice.marked_uncollectible":
        await syncInvoice(supabase, obj as Stripe.Invoice);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(supabase, obj as Stripe.Subscription, event.type);
        break;
    }
    await markProcessed(supabase, event.id);
    return { kind: "processed" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markFailed(supabase, event.id, message);
    return { kind: "failed", retryable: true, message };
  }
}