// Recurring subscription activation. Idempotent per proposal.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { getStripe, isStripeLive, stripeErrorMessage } from "./stripe.server";
import { ensureBillingCustomer } from "./customers.server";
import { recordBillingEvent } from "./events.server";
import { buildIdempotencyKey, DEFAULT_CURRENCY, normalizeCurrency } from "./money";

export type BillingSubscriptionRow = Database["public"]["Tables"]["billing_subscriptions"]["Row"];

export async function activateRecurringBilling(
  supabase: SupabaseClient<Database>,
  input: { organization_id: string; proposal_id: string; actor_id?: string | null },
): Promise<BillingSubscriptionRow> {
  // 1. Load proposal (locked/accepted, with recurring fee > 0).
  const { data: proposal, error } = await supabase
    .from("nsl_proposals")
    .select(
      "id, organization_id, client_id, status, version, locked_at, accepted_at, recurring_fee_cents, setup_fee_cents, title",
    )
    .eq("id", input.proposal_id)
    .eq("organization_id", input.organization_id)
    .maybeSingle();
  if (error || !proposal) throw new Error("Proposal not found");
  if (proposal.status !== "accepted" || !proposal.locked_at || !proposal.accepted_at) {
    throw new Error("Proposal is not accepted and locked");
  }
  const monthly = Number(proposal.recurring_fee_cents ?? 0);
  if (!Number.isFinite(monthly) || monthly <= 0) {
    throw new Error("Proposal has no recurring fee");
  }

  // 2. Verify setup final invoice is paid.
  const setup = Number(proposal.setup_fee_cents ?? 0);
  if (setup > 0) {
    const { data: finalInv } = await supabase
      .from("billing_invoices")
      .select("id, status")
      .eq("proposal_id", proposal.id)
      .eq("type", "setup_final")
      .maybeSingle();
    if (!finalInv || finalInv.status !== "paid") {
      throw new Error("Final setup invoice must be paid before activating recurring billing");
    }
  }

  // 3. Idempotency: return existing active subscription if present.
  const { data: existing } = await supabase
    .from("billing_subscriptions")
    .select("*")
    .eq("proposal_id", proposal.id)
    .in("status", ["active", "trialing", "past_due"])
    .maybeSingle();
  if (existing) return existing;

  const customer = await ensureBillingCustomer(supabase, {
    organization_id: proposal.organization_id,
    client_id: proposal.client_id,
    actor_id: input.actor_id ?? null,
    email: await (async () => {
      const { data } = await supabase
        .from("nsl_proposal_signatures")
        .select("signer_email, signed_at")
        .eq("proposal_id", proposal.id)
        .order("signed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data?.signer_email ?? null;
    })(),
  });

  const stripe = getStripe();
  const currency = normalizeCurrency(DEFAULT_CURRENCY).toLowerCase();
  const idem = buildIdempotencyKey("nsl_sub", proposal.id, proposal.version, monthly);

  try {
    const product = await stripe.products.create(
      {
        name: `NorthStar Labs - ${proposal.title ?? "Retainer"}`,
        metadata: {
          organization_id: proposal.organization_id,
          proposal_id: proposal.id,
        },
      },
      { idempotencyKey: buildIdempotencyKey("nsl_product", proposal.id, proposal.version) },
    );
    const sub = await stripe.subscriptions.create(
      {
        customer: customer.stripe_customer_id,
        collection_method: "send_invoice",
        days_until_due: 14,
        items: [
          {
            price_data: {
              currency,
              unit_amount: monthly,
              recurring: { interval: "month" },
              product: product.id,
            },
          },
        ],
        metadata: {
          organization_id: proposal.organization_id,
          client_id: proposal.client_id,
          proposal_id: proposal.id,
          proposal_version: String(proposal.version),
        },
      },
      { idempotencyKey: idem },
    );

    const item = sub.items?.data?.[0];
    const priceId = item?.price?.id ?? null;

    const { data: row, error: insErr } = await supabase
      .from("billing_subscriptions")
      .insert({
        organization_id: proposal.organization_id,
        client_id: proposal.client_id,
        proposal_id: proposal.id,
        proposal_version: Number(proposal.version),
        customer_id: customer.id,
        stripe_subscription_id: sub.id,
        stripe_price_id: priceId,
        status: (sub.status as BillingSubscriptionRow["status"]) ?? "incomplete",
        amount_cents: monthly,
        currency: DEFAULT_CURRENCY,
        interval: "month",
        current_period_start: item?.current_period_start
          ? new Date(item.current_period_start * 1000).toISOString()
          : null,
        current_period_end: item?.current_period_end
          ? new Date(item.current_period_end * 1000).toISOString()
          : null,
        created_by: input.actor_id ?? null,
        livemode: isStripeLive(),
      })
      .select("*")
      .maybeSingle();

    if (insErr) {
      // Concurrent creation — return existing.
      const retry = await supabase
        .from("billing_subscriptions")
        .select("*")
        .eq("stripe_subscription_id", sub.id)
        .maybeSingle();
      if (retry.data) return retry.data;
      throw insErr;
    }
    if (!row) throw new Error("Failed to persist subscription");

    await recordBillingEvent(supabase, {
      organization_id: proposal.organization_id,
      client_id: proposal.client_id,
      proposal_id: proposal.id,
      subscription_id: row.id,
      event_type: "subscription_created",
      actor_id: input.actor_id ?? null,
      actor_type: input.actor_id ? "user" : "system",
      payload: { stripe_subscription_id: sub.id, amount_cents: monthly },
    });
    if (row.status === "active" || row.status === "trialing") {
      await recordBillingEvent(supabase, {
        organization_id: proposal.organization_id,
        client_id: proposal.client_id,
        proposal_id: proposal.id,
        subscription_id: row.id,
        event_type: "recurring_billing_active",
        payload: { amount_cents: monthly },
      });
    }

    return row;
  } catch (err) {
    throw new Error(`Failed to activate subscription: ${stripeErrorMessage(err)}`);
  }
}