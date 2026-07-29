// Final lifecycle step: turn a fully paid setup engagement into delivery.
//
// One idempotent entry point, callable from the Stripe webhook (system) and
// from an executive recovery action. Every activation condition is enforced
// here, never at the call site, so both paths behave identically.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { recordBillingEvent } from "@/lib/billing/events.server";
import {
  buildImplementationReadyEvent,
  emitClientLifecycleEvent,
} from "@/lib/client-workspace/lifecycle-events";

export type ActivationBlockedReason =
  | "proposal_not_found"
  | "proposal_not_accepted"
  | "proposal_not_locked"
  | "acceptance_evidence_missing"
  | "client_mismatch"
  | "deposit_invoice_missing"
  | "deposit_invoice_unpaid"
  | "final_invoice_missing"
  | "final_invoice_unpaid"
  | "billing_reconciliation_failed";

export type ActivationEvaluation =
  | { status: "ready"; clientId: string; recurringPending: boolean }
  | { status: "already_active"; projectId: string; clientId: string; recurringPending: boolean }
  | { status: "blocked"; reason: ActivationBlockedReason; message: string }
  | { status: "failed"; message: string };

export type ActivationResult =
  | { status: "created"; projectId: string; clientId: string; recurringPending: boolean }
  | { status: "already_active"; projectId: string; clientId: string; recurringPending: boolean }
  | { status: "blocked"; reason: ActivationBlockedReason; message: string }
  | { status: "failed"; message: string };

const BLOCKED_MESSAGES: Record<ActivationBlockedReason, string> = {
  proposal_not_found: "Proposal not found in this organization.",
  proposal_not_accepted: "The proposal has not been accepted by the client.",
  proposal_not_locked: "The accepted proposal is not locked.",
  acceptance_evidence_missing: "No signature is on file for this proposal.",
  client_mismatch: "The billing records do not belong to the proposal client.",
  deposit_invoice_missing: "The deposit invoice has not been created yet.",
  deposit_invoice_unpaid: "The deposit invoice is not paid.",
  final_invoice_missing: "The final balance invoice has not been created yet.",
  final_invoice_unpaid: "The final balance invoice is not paid.",
  billing_reconciliation_failed:
    "Billing does not reconcile: recorded payments are less than the invoiced setup total.",
};

function blocked(reason: ActivationBlockedReason): ActivationResult {
  return { status: "blocked", reason, message: BLOCKED_MESSAGES[reason] };
}

/** Delivery project title. Uses a hyphen, never an em dash. */
export function deliveryProjectName(clientName: string): string {
  return `${clientName} - Implementation`;
}

function truncate(value: string | null | undefined, max: number): string | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  return v.length > max ? `${v.slice(0, max - 1)}\u2026` : v;
}

/**
 * Create (or return) the delivery project for a fully paid engagement and move
 * the client into active delivery.
 *
 * Idempotent on (organization_id, client_id, proposal_id, proposal_version),
 * enforced by a unique index. Safe to call from webhook retries, operator
 * clicks, and page refreshes.
 */
export async function activateClientDeliveryFromBilling(
  supabase: SupabaseClient<Database>,
  input: { proposal_id: string; organization_id?: string; actor_id?: string | null; dryRun?: boolean },
): Promise<ActivationResult> {
  try {
    // 1. Proposal must be accepted, locked, and signed.
    let proposalQuery = supabase
      .from("nsl_proposals")
      .select(
        "id, organization_id, client_id, pipeline_id, version, status, locked_at, accepted_at, title, proposal_number, recommended_services, recommended_strategy, deliverables, implementation_timeline, setup_fee_cents, recurring_fee_cents, created_by",
      )
      .eq("id", input.proposal_id);
    if (input.organization_id) {
      proposalQuery = proposalQuery.eq("organization_id", input.organization_id);
    }
    const { data: proposal, error: pErr } = await proposalQuery.maybeSingle();
    if (pErr) throw pErr;
    if (!proposal) return blocked("proposal_not_found");
    if (proposal.status !== "accepted") return blocked("proposal_not_accepted");
    if (!proposal.locked_at) return blocked("proposal_not_locked");
    if (!proposal.accepted_at) return blocked("acceptance_evidence_missing");

    const orgId = proposal.organization_id;
    const clientId = proposal.client_id;

    const { data: signature } = await supabase
      .from("nsl_proposal_signatures")
      .select("id")
      .eq("proposal_id", proposal.id)
      .limit(1)
      .maybeSingle();
    if (!signature) return blocked("acceptance_evidence_missing");

    const recurring = Number(proposal.recurring_fee_cents ?? 0);

    // 2. Idempotent lookup before anything is written.
    const existing = await findDeliveryProject(supabase, {
      organization_id: orgId,
      client_id: clientId,
      proposal_id: proposal.id,
      proposal_version: proposal.version,
    });
    if (existing) {
      return {
        status: "already_active",
        projectId: existing,
        clientId,
        recurringPending: recurring > 0 && !(await hasLiveSubscription(supabase, orgId, proposal.id)),
      };
    }

    // 3. Both setup invoices must exist, be paid, and reconcile.
    const { data: invoices, error: iErr } = await supabase
      .from("billing_invoices")
      .select("id, client_id, organization_id, type, status, amount_cents, amount_paid_cents, refunded_amount_cents")
      .eq("organization_id", orgId)
      .eq("proposal_id", proposal.id)
      .in("type", ["setup_deposit", "setup_final"]);
    if (iErr) throw iErr;
    const rows = invoices ?? [];
    if (rows.some((r) => r.client_id !== clientId)) return blocked("client_mismatch");

    const active = rows.filter((r) => r.status !== "void");
    const deposit = active.find((r) => r.type === "setup_deposit");
    const final = active.find((r) => r.type === "setup_final");
    if (!deposit) return blocked("deposit_invoice_missing");
    if (deposit.status !== "paid") return blocked("deposit_invoice_unpaid");
    if (!final) return blocked("final_invoice_missing");
    if (final.status !== "paid") return blocked("final_invoice_unpaid");

    const invoicedCents = Number(deposit.amount_cents) + Number(final.amount_cents);
    const paidCents =
      Number(deposit.amount_paid_cents ?? 0) - Number(deposit.refunded_amount_cents ?? 0) +
      (Number(final.amount_paid_cents ?? 0) - Number(final.refunded_amount_cents ?? 0));
    if (paidCents < invoicedCents) return blocked("billing_reconciliation_failed");

    // 4. Client context for the delivery project.
    const { data: client, error: cErr } = await supabase
      .from("revenue_clients")
      .select("id, organization_id, name, status, venture_id, started_at, activated_at")
      .eq("id", clientId)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!client) return blocked("client_mismatch");

    if (input.dryRun) {
      return {
        status: "created",
        projectId: "",
        clientId,
        recurringPending: recurring > 0 && !(await hasLiveSubscription(supabase, orgId, proposal.id)),
      };
    }

    // 5. Create the delivery project. Unique index is the real guard.
    const insert = await supabase
      .from("projects")
      .insert({
        organization_id: orgId,
        venture_id: client.venture_id ?? null,
        client_id: clientId,
        proposal_id: proposal.id,
        proposal_version: proposal.version,
        pipeline_id: proposal.pipeline_id ?? null,
        created_source: "billing_activation",
        name: deliveryProjectName(client.name),
        status: "planned" as never,
        objective: truncate(proposal.recommended_services || proposal.recommended_strategy, 4000),
        desired_outcome: truncate(proposal.deliverables, 4000),
        next_action: truncate(proposal.implementation_timeline, 1000) ?? "Schedule the kickoff call.",
        start_date: new Date().toISOString().slice(0, 10),
        owner_user_id: proposal.created_by ?? input.actor_id ?? null,
        created_by: input.actor_id ?? proposal.created_by ?? null,
      })
      .select("id")
      .maybeSingle();

    let projectId = insert.data?.id ?? null;
    if (insert.error) {
      // Concurrent activation won the race: return that project, emit nothing.
      const winner = await findDeliveryProject(supabase, {
        organization_id: orgId,
        client_id: clientId,
        proposal_id: proposal.id,
        proposal_version: proposal.version,
      });
      if (winner) {
        return {
          status: "already_active",
          projectId: winner,
          clientId,
          recurringPending: recurring > 0 && !(await hasLiveSubscription(supabase, orgId, proposal.id)),
        };
      }
      throw insert.error;
    }
    if (!projectId) throw new Error("Delivery project could not be created");

    await recordBillingEvent(supabase, {
      organization_id: orgId,
      client_id: clientId,
      proposal_id: proposal.id,
      event_type: "delivery_project_created",
      actor_id: input.actor_id ?? null,
      actor_type: input.actor_id ? "user" : "system",
      payload: { project_id: projectId, proposal_version: proposal.version },
    });

    // 6. Move the client into active delivery. Onboarding history is preserved.
    const { error: uErr } = await supabase
      .from("revenue_clients")
      .update({
        status: "active" as never,
        activated_at: client.activated_at ?? new Date().toISOString(),
        activation_proposal_id: proposal.id,
        activation_project_id: projectId,
      })
      .eq("id", clientId)
      .eq("organization_id", orgId);
    if (uErr) throw uErr;

    await recordBillingEvent(supabase, {
      organization_id: orgId,
      client_id: clientId,
      proposal_id: proposal.id,
      event_type: "client_activated",
      actor_id: input.actor_id ?? null,
      actor_type: input.actor_id ? "user" : "system",
      payload: { project_id: projectId, previous_status: client.status },
    });
    await recordBillingEvent(supabase, {
      organization_id: orgId,
      client_id: clientId,
      proposal_id: proposal.id,
      event_type: "delivery_ready_to_start",
      actor_id: input.actor_id ?? null,
      actor_type: input.actor_id ? "user" : "system",
      payload: { project_id: projectId, recurring_fee_cents: recurring },
    });

    // Client-facing activity. Emitted only on the transition that actually
    // created the delivery project and moved the client to active, so a retry
    // that returns "already_active" never reaches here. Deduped by
    // (client, proposal) as a second guard.
    await emitImplementationReadyEvent(supabase, {
      organization_id: orgId,
      client_id: clientId,
      proposal_id: proposal.id,
      project_id: projectId,
      implementation_name: deliveryProjectName(client.name),
      next_step: truncate(proposal.implementation_timeline, 300),
    });

    return {
      status: "created",
      projectId,
      clientId,
      recurringPending: recurring > 0 && !(await hasLiveSubscription(supabase, orgId, proposal.id)),
    };
  } catch (err) {
    return {
      status: "failed",
      message: err instanceof Error ? err.message.slice(0, 300) : "Activation failed",
    };
  }
}

async function findDeliveryProject(
  supabase: SupabaseClient<Database>,
  key: { organization_id: string; client_id: string; proposal_id: string; proposal_version: number },
): Promise<string | null> {
  const { data } = await supabase
    .from("projects")
    .select("id")
    .eq("organization_id", key.organization_id)
    .eq("client_id", key.client_id)
    .eq("proposal_id", key.proposal_id)
    .eq("proposal_version", key.proposal_version)
    .is("deleted_at", null)
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * Client-safe "implementation ready" activity entry. Contains the
 * implementation name, activation date, current phase, and a plain-language
 * next step. No project ids, no billing internals, no operator assignments.
 */
async function emitImplementationReadyEvent(
  supabase: SupabaseClient<Database>,
  input: {
    organization_id: string;
    client_id: string;
    proposal_id: string;
    project_id: string;
    implementation_name: string;
    next_step: string | null;
  },
): Promise<void> {
  const event = buildImplementationReadyEvent({
    client_id: input.client_id,
    proposal_id: input.proposal_id,
    project_id: input.project_id,
    implementation_name: input.implementation_name,
    activated_at: new Date().toISOString(),
    next_step: input.next_step,
  });
  const outcome = await emitClientLifecycleEvent(supabase as never, {
    organization_id: input.organization_id,
    client_id: input.client_id,
    event,
  });
  if (outcome === "failed") {
    // Activation succeeded; a feed entry must not roll it back.
    // eslint-disable-next-line no-console
    console.error("[client workspace] implementation_ready event insert failed");
  }
}

async function hasLiveSubscription(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  proposalId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("billing_subscriptions")
    .select("id, status")
    .eq("organization_id", organizationId)
    .eq("proposal_id", proposalId)
    .in("status", ["active", "trialing"])
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

/**
 * Read-only evaluation of the same conditions. Used by the UI to explain why
 * activation has not happened yet. Writes nothing.
 */
export async function evaluateDeliveryActivation(
  supabase: SupabaseClient<Database>,
  input: { proposal_id: string; organization_id?: string },
): Promise<ActivationEvaluation> {
  const result = await activateClientDeliveryFromBilling(supabase, { ...input, dryRun: true });
  if (result.status === "created") {
    return { status: "ready", clientId: result.clientId, recurringPending: result.recurringPending };
  }
  return result;
}
