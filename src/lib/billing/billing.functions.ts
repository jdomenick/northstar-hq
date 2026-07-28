// Authenticated server functions for the billing UI.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const idInput = z.object({ organization_id: z.string().uuid(), proposal_id: z.string().uuid() });
const invoiceInput = z.object({ organization_id: z.string().uuid(), invoice_id: z.string().uuid() });

async function requireExecutive(
  supabase: SupabaseClient<Database>,
  organization_id: string,
  user_id: string,
): Promise<void> {
  const { data, error } = await supabase.rpc("has_org_role", {
    _org: organization_id,
    _user: user_id,
    _min: "executive",
  });
  if (error) throw new Error("Authorization check failed");
  if (!data) throw new Error("Forbidden: executive role required");
}

export const startBillingFromProposalFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idInput.parse(data))
  .handler(async ({ data, context }) => {
    await requireExecutive(context.supabase, data.organization_id, context.userId);
    const { startBillingFromProposal } = await import("./invoices.server");
    const inv = await startBillingFromProposal(context.supabase, {
      organization_id: data.organization_id,
      proposal_id: data.proposal_id,
      actor_id: context.userId,
    });
    return { invoice_id: inv.id, stripe_invoice_id: inv.stripe_invoice_id, hosted_invoice_url: inv.hosted_invoice_url };
  });

export const generateFinalInvoiceFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idInput.parse(data))
  .handler(async ({ data, context }) => {
    await requireExecutive(context.supabase, data.organization_id, context.userId);
    const { generateFinalSetupInvoice } = await import("./invoices.server");
    const inv = await generateFinalSetupInvoice(context.supabase, {
      organization_id: data.organization_id,
      proposal_id: data.proposal_id,
      actor_id: context.userId,
    });
    return { invoice_id: inv.id, hosted_invoice_url: inv.hosted_invoice_url };
  });

export const activateSubscriptionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idInput.parse(data))
  .handler(async ({ data, context }) => {
    await requireExecutive(context.supabase, data.organization_id, context.userId);
    const { activateRecurringBilling } = await import("./subscriptions.server");
    const sub = await activateRecurringBilling(context.supabase, {
      organization_id: data.organization_id,
      proposal_id: data.proposal_id,
      actor_id: context.userId,
    });
    return { subscription_id: sub.id, status: sub.status };
  });

export const refundInvoiceFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => invoiceInput.parse(data))
  .handler(async ({ data, context }) => {
    await requireExecutive(context.supabase, data.organization_id, context.userId);
    const { refundPayment } = await import("./invoices.server");
    const inv = await refundPayment(context.supabase, {
      organization_id: data.organization_id,
      invoice_id: data.invoice_id,
      actor_id: context.userId,
    });
    return { invoice_id: inv.id, status: inv.status };
  });

export const resendInvoiceFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => invoiceInput.parse(data))
  .handler(async ({ data, context }) => {
    await requireExecutive(context.supabase, data.organization_id, context.userId);
    const { resendInvoiceEmail } = await import("./invoices.server");
    await resendInvoiceEmail(context.supabase, {
      organization_id: data.organization_id,
      invoice_id: data.invoice_id,
    });
    return { ok: true };
  });

// Read-only billing summary for the org.
export const getBillingOverviewFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ organization_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const [customers, invoices, subs, events] = await Promise.all([
      context.supabase
        .from("billing_customers")
        .select("id, client_id, stripe_customer_id, name, email, created_at")
        .eq("organization_id", data.organization_id)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("billing_invoices")
        .select(
          "id, client_id, proposal_id, proposal_version, type, amount_cents, amount_paid_cents, refunded_amount_cents, currency, status, collection_method, hosted_invoice_url, invoice_pdf_url, paid_at, due_at, created_at",
        )
        .eq("organization_id", data.organization_id)
        .order("created_at", { ascending: false })
        .limit(200),
      context.supabase
        .from("billing_subscriptions")
        .select(
          "id, client_id, proposal_id, stripe_subscription_id, status, amount_cents, currency, interval, current_period_start, current_period_end, cancel_at, created_at",
        )
        .eq("organization_id", data.organization_id)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("billing_events")
        .select("id, event_type, invoice_id, subscription_id, proposal_id, payload, created_at")
        .eq("organization_id", data.organization_id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    return {
      customers: customers.data ?? [],
      invoices: invoices.data ?? [],
      subscriptions: subs.data ?? [],
      events: events.data ?? [],
      configured: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET),
    };
  });

// Accepted proposals that don't yet have any billing invoice — candidates to start.
export const getBillableProposalsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ organization_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: proposals, error } = await context.supabase
      .from("nsl_proposals")
      .select(
        "id, client_id, title, proposal_number, status, version, setup_fee_cents, recurring_fee_cents, accepted_at, locked_at",
      )
      .eq("organization_id", data.organization_id)
      .eq("status", "accepted")
      .not("locked_at", "is", null);
    if (error) throw error;
    return proposals ?? [];
  });