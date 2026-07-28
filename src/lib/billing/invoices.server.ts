// Invoice + refund operations. All operations are idempotent.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { getStripe, stripeErrorMessage } from "./stripe.server";
import { ensureBillingCustomer } from "./customers.server";
import { recordBillingEvent } from "./events.server";
import {
  buildIdempotencyKey,
  isValidCurrency,
  normalizeCurrency,
  splitSetupFee,
  DEFAULT_CURRENCY,
} from "./money";

export type BillingInvoiceRow = Database["public"]["Tables"]["billing_invoices"]["Row"];

type InvoiceType = "setup_deposit" | "setup_final";

/** Load the proposal and verify it is a valid billing source. */
async function loadAcceptedLockedProposal(
  supabase: SupabaseClient<Database>,
  proposalId: string,
  organizationId: string,
) {
  const { data, error } = await supabase
    .from("nsl_proposals")
    .select(
      "id, organization_id, client_id, status, version, setup_fee_cents, recurring_fee_cents, locked_at, accepted_at, title, proposal_number",
    )
    .eq("id", proposalId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Proposal not found");
  if (data.status !== "accepted") throw new Error("Proposal is not accepted");
  if (!data.locked_at) throw new Error("Proposal is not locked");
  if (!data.accepted_at) throw new Error("Proposal is missing acceptance evidence");
  const setup = Number(data.setup_fee_cents ?? 0);
  if (!Number.isFinite(setup) || setup <= 0) throw new Error("Setup fee is zero or invalid");
  // Acceptance evidence: at least one signature row.
  const sig = await supabase
    .from("nsl_proposal_signatures")
    .select("id")
    .eq("proposal_id", proposalId)
    .limit(1)
    .maybeSingle();
  if (!sig.data) throw new Error("Proposal is missing acceptance evidence");
  return data;
}

async function getExistingActiveInvoice(
  supabase: SupabaseClient<Database>,
  proposalId: string,
  type: InvoiceType,
) {
  const { data } = await supabase
    .from("billing_invoices")
    .select("*")
    .eq("proposal_id", proposalId)
    .eq("type", type)
    .not("status", "in", "(void,uncollectible)")
    .maybeSingle();
  return data ?? null;
}

async function createFinalizedInvoice(
  supabase: SupabaseClient<Database>,
  args: {
    organization_id: string;
    client_id: string;
    proposal_id: string;
    proposal_version: number;
    proposal_number: string;
    customer_row_id: string;
    stripe_customer_id: string;
    type: InvoiceType;
    amount_cents: number;
    currency: string;
    description: string;
    actor_id: string | null;
  },
): Promise<BillingInvoiceRow> {
  const stripe = getStripe();
  const baseKey = buildIdempotencyKey(
    "nsl_inv",
    args.proposal_id,
    args.proposal_version,
    args.type,
  );

  // 1. Invoice item.
  await stripe.invoiceItems.create(
    {
      customer: args.stripe_customer_id,
      amount: args.amount_cents,
      currency: args.currency.toLowerCase(),
      description: args.description,
      metadata: {
        proposal_id: args.proposal_id,
        proposal_version: String(args.proposal_version),
        invoice_type: args.type,
      },
    },
    { idempotencyKey: `${baseKey}:item` },
  );

  // 2. Draft invoice (send_invoice collection).
  const draft = await stripe.invoices.create(
    {
      customer: args.stripe_customer_id,
      collection_method: "send_invoice",
      days_until_due: 14,
      auto_advance: false,
      description: args.description,
      metadata: {
        organization_id: args.organization_id,
        client_id: args.client_id,
        proposal_id: args.proposal_id,
        proposal_version: String(args.proposal_version),
        proposal_number: args.proposal_number,
        invoice_type: args.type,
      },
    },
    { idempotencyKey: `${baseKey}:invoice` },
  );

  // 3. Finalize so hosted URL/PDF are guaranteed.
  if (!draft.id) throw new Error("Stripe did not return an invoice id");
  const finalized = await stripe.invoices.finalizeInvoice(draft.id, undefined, {
    idempotencyKey: `${baseKey}:finalize`,
  });

  if (!finalized.hosted_invoice_url || !finalized.invoice_pdf) {
    throw new Error("Stripe finalized invoice without a hosted URL");
  }

  const { data: row, error } = await supabase
    .from("billing_invoices")
    .insert({
      organization_id: args.organization_id,
      client_id: args.client_id,
      proposal_id: args.proposal_id,
      proposal_version: args.proposal_version,
      customer_id: args.customer_row_id,
      type: args.type,
      stripe_invoice_id: finalized.id!,
      stripe_payment_intent_id: null,
      amount_cents: args.amount_cents,
      currency: args.currency,
      status: "open",
      collection_method: "send_invoice",
      hosted_invoice_url: finalized.hosted_invoice_url,
      invoice_pdf_url: finalized.invoice_pdf,
      finalized_at: new Date().toISOString(),
      due_at: finalized.due_date
        ? new Date(finalized.due_date * 1000).toISOString()
        : null,
      created_by: args.actor_id,
      metadata: {},
    })
    .select("*")
    .maybeSingle();

  if (error) {
    // Concurrent creator won the race — return existing.
    const existing = await getExistingActiveInvoice(
      supabase,
      args.proposal_id,
      args.type,
    );
    if (existing) return existing;
    throw error;
  }
  if (!row) throw new Error("Failed to persist billing invoice");

  await recordBillingEvent(supabase, {
    organization_id: args.organization_id,
    client_id: args.client_id,
    proposal_id: args.proposal_id,
    invoice_id: row.id,
    event_type: "invoice_created",
    actor_id: args.actor_id,
    actor_type: args.actor_id ? "user" : "system",
    payload: { type: args.type, amount_cents: args.amount_cents },
  });
  await recordBillingEvent(supabase, {
    organization_id: args.organization_id,
    client_id: args.client_id,
    proposal_id: args.proposal_id,
    invoice_id: row.id,
    event_type: "invoice_finalized",
    actor_id: args.actor_id,
    actor_type: args.actor_id ? "user" : "system",
    payload: { stripe_invoice_id: finalized.id },
  });

  return row;
}

export async function startBillingFromProposal(
  supabase: SupabaseClient<Database>,
  input: { organization_id: string; proposal_id: string; actor_id?: string | null },
): Promise<BillingInvoiceRow> {
  const proposal = await loadAcceptedLockedProposal(
    supabase,
    input.proposal_id,
    input.organization_id,
  );
  // Idempotent: return existing active deposit if present.
  const existing = await getExistingActiveInvoice(supabase, input.proposal_id, "setup_deposit");
  if (existing) return existing;

  const setup = Number(proposal.setup_fee_cents ?? 0);
  const { deposit_cents } = splitSetupFee(setup);
  const currency = DEFAULT_CURRENCY; // proposals table has no currency column yet
  if (!isValidCurrency(currency)) throw new Error("Invalid currency");

  const customer = await ensureBillingCustomer(supabase, {
    organization_id: input.organization_id,
    client_id: proposal.client_id,
    actor_id: input.actor_id ?? null,
  });

  return createFinalizedInvoice(supabase, {
    organization_id: input.organization_id,
    client_id: proposal.client_id,
    proposal_id: proposal.id,
    proposal_version: Number(proposal.version),
    proposal_number: String(proposal.proposal_number ?? proposal.id),
    customer_row_id: customer.id,
    stripe_customer_id: customer.stripe_customer_id,
    type: "setup_deposit",
    amount_cents: deposit_cents,
    currency: normalizeCurrency(currency),
    description: `Setup deposit (50%) - ${proposal.title ?? proposal.proposal_number}`,
    actor_id: input.actor_id ?? null,
  });
}

export async function generateFinalSetupInvoice(
  supabase: SupabaseClient<Database>,
  input: { organization_id: string; proposal_id: string; actor_id?: string | null },
): Promise<BillingInvoiceRow> {
  const proposal = await loadAcceptedLockedProposal(
    supabase,
    input.proposal_id,
    input.organization_id,
  );
  const existing = await getExistingActiveInvoice(supabase, input.proposal_id, "setup_final");
  if (existing) return existing;

  const setup = Number(proposal.setup_fee_cents ?? 0);
  const { final_cents } = splitSetupFee(setup);
  const currency = DEFAULT_CURRENCY;

  const customer = await ensureBillingCustomer(supabase, {
    organization_id: input.organization_id,
    client_id: proposal.client_id,
    actor_id: input.actor_id ?? null,
  });

  return createFinalizedInvoice(supabase, {
    organization_id: input.organization_id,
    client_id: proposal.client_id,
    proposal_id: proposal.id,
    proposal_version: Number(proposal.version),
    proposal_number: String(proposal.proposal_number ?? proposal.id),
    customer_row_id: customer.id,
    stripe_customer_id: customer.stripe_customer_id,
    type: "setup_final",
    amount_cents: final_cents,
    currency: normalizeCurrency(currency),
    description: `Setup final balance - ${proposal.title ?? proposal.proposal_number}`,
    actor_id: input.actor_id ?? null,
  });
}

/** Full refund of the most recent successful payment on an invoice. V1: full refunds only. */
export async function refundPayment(
  supabase: SupabaseClient<Database>,
  input: { organization_id: string; invoice_id: string; actor_id?: string | null },
): Promise<BillingInvoiceRow> {
  const { data: invoice, error } = await supabase
    .from("billing_invoices")
    .select("*")
    .eq("id", input.invoice_id)
    .eq("organization_id", input.organization_id)
    .maybeSingle();
  if (error || !invoice) throw new Error("Invoice not found");
  if (invoice.status !== "paid" && invoice.status !== "partially_refunded") {
    throw new Error("Only paid invoices can be refunded");
  }

  const { data: payment } = await supabase
    .from("billing_payments")
    .select("*")
    .eq("invoice_id", invoice.id)
    .eq("status", "succeeded")
    .order("paid_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!payment) throw new Error("No successful payment found for this invoice");
  if (!payment.stripe_payment_intent_id && !payment.stripe_charge_id) {
    throw new Error("Payment has no Stripe reference to refund");
  }

  const refundable = payment.amount_cents - payment.refunded_amount_cents;
  if (refundable <= 0) throw new Error("Payment already fully refunded");

  const stripe = getStripe();
  const idem = buildIdempotencyKey("nsl_refund", payment.id, refundable);
  const refund = await stripe.refunds.create(
    {
      ...(payment.stripe_payment_intent_id
        ? { payment_intent: payment.stripe_payment_intent_id }
        : { charge: payment.stripe_charge_id! }),
      amount: refundable,
      metadata: { invoice_id: invoice.id, organization_id: invoice.organization_id },
    },
    { idempotencyKey: idem },
  ).catch((err) => {
    throw new Error(`Stripe refund failed: ${stripeErrorMessage(err)}`);
  });

  const newRefunded = payment.refunded_amount_cents + refundable;
  await supabase
    .from("billing_payments")
    .update({
      refunded_amount_cents: newRefunded,
      status: newRefunded >= payment.amount_cents ? "refunded" : "partially_refunded",
      refunded_at: new Date().toISOString(),
    })
    .eq("id", payment.id);

  const invNewRefunded = invoice.refunded_amount_cents + refundable;
  const invNewStatus =
    invNewRefunded >= invoice.amount_paid_cents ? "refunded" : "partially_refunded";
  const { data: updated } = await supabase
    .from("billing_invoices")
    .update({ refunded_amount_cents: invNewRefunded, status: invNewStatus })
    .eq("id", invoice.id)
    .select("*")
    .maybeSingle();

  await recordBillingEvent(supabase, {
    organization_id: invoice.organization_id,
    client_id: invoice.client_id,
    proposal_id: invoice.proposal_id,
    invoice_id: invoice.id,
    event_type: "refund_issued",
    actor_id: input.actor_id ?? null,
    actor_type: input.actor_id ? "user" : "system",
    payload: { stripe_refund_id: refund.id, amount_cents: refundable },
  });

  return updated ?? invoice;
}

/** For send_invoice invoices: resend the email. Requires an email on the customer. */
export async function resendInvoiceEmail(
  supabase: SupabaseClient<Database>,
  input: { organization_id: string; invoice_id: string },
): Promise<void> {
  const { data: invoice, error } = await supabase
    .from("billing_invoices")
    .select("*")
    .eq("id", input.invoice_id)
    .eq("organization_id", input.organization_id)
    .maybeSingle();
  if (error || !invoice) throw new Error("Invoice not found");
  if (invoice.collection_method !== "send_invoice") {
    throw new Error("Resend is only available for hosted invoices");
  }
  if (invoice.status !== "open") {
    throw new Error("Only open invoices can be resent");
  }
  const stripe = getStripe();
  await stripe.invoices.sendInvoice(invoice.stripe_invoice_id);
  await recordBillingEvent(supabase, {
    organization_id: invoice.organization_id,
    client_id: invoice.client_id,
    proposal_id: invoice.proposal_id,
    invoice_id: invoice.id,
    event_type: "invoice_sent",
    payload: { channel: "email" },
  });
}