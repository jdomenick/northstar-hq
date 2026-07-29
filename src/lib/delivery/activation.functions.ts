// Executive-only recovery + read surface for delivery activation.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const input = z.object({
  organization_id: z.string().uuid(),
  proposal_id: z.string().uuid(),
});

const proposalOnly = z.object({ proposal_id: z.string().uuid() });

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

/** Manual recovery. Enforces every activation condition, same as the webhook. */
export const retryDeliveryActivationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => input.parse(data))
  .handler(async ({ data, context }) => {
    await requireExecutive(context.supabase, data.organization_id, context.userId);
    const { activateClientDeliveryFromBilling } = await import("./activation.server");
    return activateClientDeliveryFromBilling(context.supabase, {
      proposal_id: data.proposal_id,
      organization_id: data.organization_id,
      actor_id: context.userId,
    });
  });

/** Delivery project linked to a proposal, if activation already happened. */
export const getDeliveryProjectFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => input.parse(data))
  .handler(async ({ data, context }) => {
    const { data: project } = await context.supabase
      .from("projects")
      .select("id, name, status, start_date, created_source, client_id")
      .eq("organization_id", data.organization_id)
      .eq("proposal_id", data.proposal_id)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    return { project: project ?? null };
  });

/**
 * Everything the lifecycle rail needs for one engagement: setup invoice
 * statuses, subscription status, the delivery project, and the real reason
 * activation has not happened yet. Read-only, RLS-scoped to the caller's org.
 */
export const getEngagementStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => proposalOnly.parse(data))
  .handler(async ({ data, context }) => {
    const { data: proposal } = await context.supabase
      .from("nsl_proposals")
      .select("id, organization_id, status, recurring_fee_cents")
      .eq("id", data.proposal_id)
      .maybeSingle();
    if (!proposal) throw new Error("Proposal not found");
    const orgId = proposal.organization_id;

    const [invoicesRes, subRes, projectRes] = await Promise.all([
      context.supabase
        .from("billing_invoices")
        .select("id, type, status, hosted_invoice_url")
        .eq("organization_id", orgId)
        .eq("proposal_id", proposal.id),
      context.supabase
        .from("billing_subscriptions")
        .select("id, status")
        .eq("organization_id", orgId)
        .eq("proposal_id", proposal.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      context.supabase
        .from("projects")
        .select("id, name, status")
        .eq("organization_id", orgId)
        .eq("proposal_id", proposal.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

    const invoices = (invoicesRes.data ?? []).filter((i) => i.status !== "void");
    const deposit = invoices.find((i) => i.type === "setup_deposit") ?? null;
    const final = invoices.find((i) => i.type === "setup_final") ?? null;

    // Only surface an activation problem once setup is genuinely paid.
    let activationError: string | null = null;
    if (!projectRes.data && deposit?.status === "paid" && final?.status === "paid") {
      const { evaluateDeliveryActivation } = await import("./activation.server");
      const evaluation = await evaluateDeliveryActivation(context.supabase, {
        proposal_id: proposal.id,
        organization_id: orgId,
      });
      if (evaluation.status === "blocked") activationError = evaluation.message;
      if (evaluation.status === "failed") activationError = evaluation.message;
    }

    return {
      organizationId: orgId,
      recurringFeeCents: Number(proposal.recurring_fee_cents ?? 0),
      depositStatus: deposit?.status ?? null,
      finalStatus: final?.status ?? null,
      subscriptionStatus: subRes.data?.status ?? null,
      project: projectRes.data ?? null,
      activationError,
    };
  });

/** Delivery projects created from proposals, keyed by proposal for list views. */
export const listDeliveryProjectsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ organization_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("projects")
      .select("id, name, status, proposal_id")
      .eq("organization_id", data.organization_id)
      .not("proposal_id", "is", null)
      .is("deleted_at", null);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
