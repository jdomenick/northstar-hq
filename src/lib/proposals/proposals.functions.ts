// NorthStar Labs Proposals - authenticated server functions.
//
// Every mutating function verifies org role via has_org_role and passes
// through the RLS-scoped authenticated Supabase client. Content edits are
// blocked once the proposal is sent/locked.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { assertTransition, isTerminal, type ProposalStatus } from "./transitions";
import { contentHash, type ProposalContent } from "./content";

const OrgId = z.string().uuid();

/* ------------------------- list + get + metrics ------------------------- */

export const listProposals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organizationId: string; status?: ProposalStatus }) =>
    z.object({ organizationId: OrgId, status: z.string().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("nsl_proposals")
      .select("id, proposal_number, title, status, total_value_cents, client_id, created_at, sent_at, accepted_at, updated_at, version")
      .eq("organization_id", data.organizationId)
      .order("created_at", { ascending: false });
    if (data.status) q = q.eq("status", data.status as ProposalStatus);
    const { data: rows, error } = await q;
    if (error) throw error;
    const clientIds = Array.from(new Set((rows ?? []).map((r) => r.client_id)));
    const clients = clientIds.length
      ? await context.supabase.from("revenue_clients").select("id, name").in("id", clientIds)
      : { data: [] as Array<{ id: string; name: string }> };
    const nameMap = new Map((clients.data ?? []).map((c) => [c.id, c.name] as const));
    return (rows ?? []).map((r) => ({ ...r, client_name: nameMap.get(r.client_id) ?? "Unknown client" }));
  });

export const getProposalMetrics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organizationId: string }) => z.object({ organizationId: OrgId }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("nsl_proposals")
      .select("status, total_value_cents")
      .eq("organization_id", data.organizationId);
    if (error) throw error;
    const by: Record<string, number> = {};
    let total = 0, accepted = 0, pending = 0, sent = 0, decided = 0;
    for (const r of rows ?? []) {
      by[r.status] = (by[r.status] ?? 0) + 1;
      total += Number(r.total_value_cents ?? 0);
      if (r.status === "accepted") { accepted += Number(r.total_value_cents ?? 0); decided++; }
      if (r.status === "declined" || r.status === "expired") decided++;
      if (r.status === "sent" || r.status === "viewed") { pending += Number(r.total_value_cents ?? 0); sent++; }
    }
    const acceptanceRate = sent + decided > 0 ? ((by.accepted ?? 0) / Math.max(1, sent + decided)) : 0;
    return {
      total: rows?.length ?? 0,
      draft: by.draft ?? 0,
      internalReview: by.internal_review ?? 0,
      approved: by.approved ?? 0,
      sent: (by.sent ?? 0) + (by.viewed ?? 0),
      viewed: by.viewed ?? 0,
      accepted: by.accepted ?? 0,
      declined: by.declined ?? 0,
      expired: by.expired ?? 0,
      totalValueCents: total,
      acceptedValueCents: accepted,
      pendingValueCents: pending,
      acceptanceRate,
    };
  });

export const getProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { proposalId: string }) => z.object({ proposalId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: proposal, error } = await context.supabase
      .from("nsl_proposals").select("*").eq("id", data.proposalId).maybeSingle();
    if (error) throw error;
    if (!proposal) throw new Error("proposal_not_found");
    const [client, activity, versions, signature] = await Promise.all([
      context.supabase.from("revenue_clients").select("id, name").eq("id", proposal.client_id).maybeSingle(),
      context.supabase.from("nsl_proposal_activity").select("*").eq("proposal_id", proposal.id).order("created_at", { ascending: false }).limit(50),
      context.supabase.from("nsl_proposal_versions").select("id, version, change_summary, created_at, created_by").eq("proposal_id", proposal.id).order("version", { ascending: false }),
      context.supabase.from("nsl_proposal_signatures").select("*").eq("proposal_id", proposal.id).maybeSingle(),
    ]);
    return {
      proposal,
      client: client.data,
      activity: activity.data ?? [],
      versions: versions.data ?? [],
      signature: signature.data,
    };
  });

/* ------------------------------ generate ------------------------------ */

export const generateProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organizationId: string; clientId: string; pipelineId?: string }) =>
    z.object({
      organizationId: OrgId,
      clientId: z.string().uuid(),
      pipelineId: z.string().uuid().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { assertOrgRole, nextProposalNumber, logProposalActivity } = await import("./proposals.server");
    const { assembleDraft } = await import("./generate.server");
    await assertOrgRole(context.supabase, context.userId, data.organizationId, "member");

    const draft = await assembleDraft(context.supabase, data.organizationId, data.clientId, data.pipelineId ?? null);
    const proposal_number = await nextProposalNumber(context.supabase, data.organizationId);

    const { data: inserted, error } = await context.supabase
      .from("nsl_proposals")
      .insert({
        organization_id: data.organizationId,
        client_id: data.clientId,
        pipeline_id: data.pipelineId ?? null,
        proposal_number,
        title: draft.title,
        executive_summary: draft.executive_summary,
        business_overview: draft.business_overview,
        current_challenges: draft.current_challenges,
        assessment_summary: draft.assessment_summary,
        growth_opportunities: draft.growth_opportunities,
        recommended_strategy: draft.recommended_strategy,
        recommended_services: draft.recommended_services,
        deliverables: draft.deliverables,
        implementation_timeline: draft.implementation_timeline,
        investment_summary: draft.investment_summary,
        payment_schedule: draft.payment_schedule,
        terms: draft.terms,
        total_value_cents: draft.total_value_cents,
        setup_fee_cents: draft.setup_fee_cents,
        recurring_fee_cents: draft.recurring_fee_cents,
        status: "draft",
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw error;

    await logProposalActivity(context.supabase, {
      organizationId: data.organizationId,
      proposalId: inserted.id,
      action: "created",
      actorId: context.userId,
    });
    return { proposalId: inserted.id, proposalNumber: proposal_number };
  });

/* ---------------------------- update draft --------------------------- */

const UpdateInput = z.object({
  proposalId: z.string().uuid(),
  patch: z
    .object({
      title: z.string().min(1).max(300).optional(),
      executive_summary: z.string().max(20_000).optional(),
      business_overview: z.string().max(20_000).optional(),
      current_challenges: z.string().max(20_000).optional(),
      assessment_summary: z.string().max(20_000).optional(),
      growth_opportunities: z.string().max(20_000).optional(),
      recommended_strategy: z.string().max(20_000).optional(),
      recommended_services: z.string().max(20_000).optional(),
      deliverables: z.string().max(20_000).optional(),
      implementation_timeline: z.string().max(20_000).optional(),
      investment_summary: z.string().max(20_000).optional(),
      payment_schedule: z.string().max(20_000).optional(),
      terms: z.string().max(20_000).optional(),
      total_value_cents: z.number().int().min(0).max(1_000_000_000).optional(),
      setup_fee_cents: z.number().int().min(0).max(1_000_000_000).optional(),
      recurring_fee_cents: z.number().int().min(0).max(1_000_000_000).optional(),
    })
    .strict(),
  changeSummary: z.string().max(500).optional(),
});

export const updateProposalDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpdateInput.parse(d))
  .handler(async ({ data, context }) => {
    const { assertOrgRole, logProposalActivity } = await import("./proposals.server");
    const { data: current, error: e0 } = await context.supabase
      .from("nsl_proposals").select("*").eq("id", data.proposalId).maybeSingle();
    if (e0) throw e0;
    if (!current) throw new Error("proposal_not_found");
    if (isTerminal(current.status) || current.locked_at) throw new Error("proposal_locked");
    if (!(current.status === "draft" || current.status === "internal_review" || current.status === "approved" || current.status === "ready_to_send")) {
      throw new Error("proposal_not_editable");
    }
    await assertOrgRole(context.supabase, context.userId, current.organization_id, "member");

    const before = extractContent(current as unknown as ProposalContent);
    const after: ProposalContent = { ...before, ...data.patch };
    const changed = contentHash(before) !== contentHash(after);

    const { error } = await context.supabase
      .from("nsl_proposals")
      .update(data.patch)
      .eq("id", data.proposalId);
    if (error) throw error;

    if (changed) {
      const nextVersion = current.version + 1;
      await context.supabase.from("nsl_proposals").update({ version: nextVersion }).eq("id", data.proposalId);
      await context.supabase.from("nsl_proposal_versions").insert({
        organization_id: current.organization_id,
        proposal_id: current.id,
        version: nextVersion,
        snapshot: after as never,
        change_summary: data.changeSummary ?? "Content edited",
        created_by: context.userId,
      });
      await logProposalActivity(context.supabase, {
        organizationId: current.organization_id,
        proposalId: current.id,
        action: "edited",
        actorId: context.userId,
        metadata: { version: nextVersion },
      });
    }
    return { ok: true, versioned: changed };
  });

function extractContent(p: ProposalContent): ProposalContent {
  return {
    title: p.title,
    executive_summary: p.executive_summary ?? "",
    business_overview: p.business_overview ?? "",
    current_challenges: p.current_challenges ?? "",
    assessment_summary: p.assessment_summary ?? "",
    growth_opportunities: p.growth_opportunities ?? "",
    recommended_strategy: p.recommended_strategy ?? "",
    recommended_services: p.recommended_services ?? "",
    deliverables: p.deliverables ?? "",
    implementation_timeline: p.implementation_timeline ?? "",
    investment_summary: p.investment_summary ?? "",
    payment_schedule: p.payment_schedule ?? "",
    terms: p.terms ?? "",
    total_value_cents: Number(p.total_value_cents ?? 0),
    setup_fee_cents: Number(p.setup_fee_cents ?? 0),
    recurring_fee_cents: Number(p.recurring_fee_cents ?? 0),
  };
}

/* -------------------------- state transitions -------------------------- */

async function transition(
  supabase: import("@supabase/supabase-js").SupabaseClient<import("@/integrations/supabase/types").Database>,
  userId: string,
  proposalId: string,
  to: ProposalStatus,
  minRole: "member" | "executive" | "admin",
  action: string,
  extraUpdate: Record<string, unknown> = {},
  notes?: string,
) {
  const { assertOrgRole, logProposalActivity } = await import("./proposals.server");
  const { data: p, error } = await supabase.from("nsl_proposals").select("*").eq("id", proposalId).maybeSingle();
  if (error) throw error;
  if (!p) throw new Error("proposal_not_found");
  await assertOrgRole(supabase, userId, p.organization_id, minRole);
  assertTransition(p.status, to);
  const { error: uErr } = await supabase.from("nsl_proposals").update({ status: to, ...extraUpdate }).eq("id", proposalId);
  if (uErr) throw uErr;
  await logProposalActivity(supabase, {
    organizationId: p.organization_id,
    proposalId,
    action,
    actorId: userId,
    notes,
  });
  return { ok: true, from: p.status, to };
}

export const submitForReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { proposalId: string }) => z.object({ proposalId: z.string().uuid() }).parse(d))
  .handler(({ data, context }) => transition(context.supabase, context.userId, data.proposalId, "internal_review", "member", "submitted_for_review"));

export const approveProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { proposalId: string }) => z.object({ proposalId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: p } = await context.supabase.from("nsl_proposals").select("*").eq("id", data.proposalId).maybeSingle();
    if (!p) throw new Error("proposal_not_found");
    // Completeness: must have investment_summary and payment_schedule filled and > 0 total
    const missing: string[] = [];
    if (!p.investment_summary?.trim() || p.investment_summary.includes("[Needs input]")) missing.push("investment_summary");
    if (!p.payment_schedule?.trim() || p.payment_schedule.includes("[Needs input]")) missing.push("payment_schedule");
    if (!p.recommended_services?.trim() || p.recommended_services.includes("[Needs input]")) missing.push("recommended_services");
    if (Number(p.total_value_cents ?? 0) <= 0) missing.push("total_value_cents");
    if (missing.length) throw new Error(`incomplete:${missing.join(",")}`);
    return transition(
      context.supabase, context.userId, data.proposalId, "approved", "executive", "approved",
      { approved_by: context.userId, approved_at: new Date().toISOString() },
    );
  });

export const returnProposalToDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { proposalId: string; reason: string }) => z.object({ proposalId: z.string().uuid(), reason: z.string().min(3).max(500) }).parse(d))
  .handler(({ data, context }) => transition(context.supabase, context.userId, data.proposalId, "draft", "executive", "returned_to_draft", {}, data.reason));

export const markSuperseded = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { proposalId: string; reason?: string }) => z.object({ proposalId: z.string().uuid(), reason: z.string().max(500).optional() }).parse(d))
  .handler(({ data, context }) => transition(
    context.supabase, context.userId, data.proposalId, "superseded", "executive", "superseded",
    { public_token_hash: null, public_token_expires_at: null }, data.reason,
  ));

/* -------------------------------- send -------------------------------- */

export const sendProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { proposalId: string; expiresInDays?: number }) =>
    z.object({ proposalId: z.string().uuid(), expiresInDays: z.number().int().min(1).max(90).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { assertOrgRole, logProposalActivity } = await import("./proposals.server");
    const { generateToken } = await import("./token.server");
    const { data: p, error } = await context.supabase.from("nsl_proposals").select("*").eq("id", data.proposalId).maybeSingle();
    if (error) throw error;
    if (!p) throw new Error("proposal_not_found");
    await assertOrgRole(context.supabase, context.userId, p.organization_id, "executive");
    if (!(p.status === "approved" || p.status === "ready_to_send")) throw new Error("must_be_approved");

    const { token, hash } = generateToken();
    const days = data.expiresInDays ?? 30;
    const expiresAt = new Date(Date.now() + days * 86_400_000);

    // Final pre-send snapshot
    await context.supabase.from("nsl_proposal_versions").insert({
      organization_id: p.organization_id,
      proposal_id: p.id,
      version: p.version,
      snapshot: p as never,
      change_summary: "Pre-send snapshot",
      created_by: context.userId,
    });

    const { error: uErr } = await context.supabase
      .from("nsl_proposals").update({
        status: "sent",
        sent_at: new Date().toISOString(),
        public_token_hash: hash,
        public_token_expires_at: expiresAt.toISOString(),
      }).eq("id", p.id);
    if (uErr) throw uErr;

    await logProposalActivity(context.supabase, {
      organizationId: p.organization_id, proposalId: p.id, action: "sent", actorId: context.userId,
      metadata: { expires_at: expiresAt.toISOString() },
    });

    return { token, expiresAt: expiresAt.toISOString() };
  });

/* -------------------------- comments (internal) -------------------------- */

export const listComments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { proposalId: string }) => z.object({ proposalId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("nsl_proposal_comments").select("*").eq("proposal_id", data.proposalId).order("created_at", { ascending: false });
    if (error) throw error;
    return rows ?? [];
  });

export const addComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { proposalId: string; comment: string }) =>
    z.object({ proposalId: z.string().uuid(), comment: z.string().min(1).max(4000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: p } = await context.supabase.from("nsl_proposals").select("organization_id").eq("id", data.proposalId).maybeSingle();
    if (!p) throw new Error("proposal_not_found");
    const { error } = await context.supabase.from("nsl_proposal_comments").insert({
      organization_id: p.organization_id,
      proposal_id: data.proposalId,
      author_id: context.userId,
      comment: data.comment,
    });
    if (error) throw error;
    return { ok: true };
  });

/* ------------------------- billing handoff (truth) ------------------------- */

/**
 * Re-issue the client-facing secure link. The raw token is only ever returned
 * once (at send time) because we store a hash, so recovering a lost link means
 * minting a new token. The previous link stops working immediately.
 */
export const reissueProposalLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { proposalId: string; expiresInDays?: number }) =>
    z.object({ proposalId: z.string().uuid(), expiresInDays: z.number().int().min(1).max(90).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { assertOrgRole, logProposalActivity } = await import("./proposals.server");
    const { generateToken } = await import("./token.server");
    const { data: p, error } = await context.supabase
      .from("nsl_proposals").select("*").eq("id", data.proposalId).maybeSingle();
    if (error) throw error;
    if (!p) throw new Error("proposal_not_found");
    await assertOrgRole(context.supabase, context.userId, p.organization_id, "executive");
    if (!["sent", "viewed"].includes(p.status)) throw new Error("link_only_available_while_awaiting_response");

    const { token, hash } = generateToken();
    const days = data.expiresInDays ?? 30;
    const expiresAt = new Date(Date.now() + days * 86_400_000);
    const { error: uErr } = await context.supabase
      .from("nsl_proposals")
      .update({ public_token_hash: hash, public_token_expires_at: expiresAt.toISOString() })
      .eq("id", p.id);
    if (uErr) throw uErr;

    await logProposalActivity(context.supabase, {
      organizationId: p.organization_id,
      proposalId: p.id,
      action: "link_reissued",
      actorId: context.userId,
      metadata: { expires_at: expiresAt.toISOString() },
    });
    return { token, expiresAt: expiresAt.toISOString() };
  });

export const prepareBillingHandoff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { proposalId: string }) => z.object({ proposalId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { assertOrgRole, logProposalActivity } = await import("./proposals.server");
    const { data: p } = await context.supabase.from("nsl_proposals").select("*").eq("id", data.proposalId).maybeSingle();
    if (!p) throw new Error("proposal_not_found");
    await assertOrgRole(context.supabase, context.userId, p.organization_id, "executive");
    if (p.status !== "accepted" || !p.locked_at) throw new Error("proposal_not_accepted");
    const { data: sig } = await context.supabase.from("nsl_proposal_signatures").select("*").eq("proposal_id", p.id).maybeSingle();
    if (!sig) throw new Error("no_signature_evidence");
    const { data: client } = await context.supabase.from("revenue_clients").select("id, name, mrr_cents").eq("id", p.client_id).maybeSingle();

    await logProposalActivity(context.supabase, {
      organizationId: p.organization_id, proposalId: p.id, action: "billing_pending_setup", actorId: context.userId,
    });

    return {
      status: "pending_billing_integration" as const,
      client,
      totals: {
        totalValueCents: Number(p.total_value_cents ?? 0),
        setupFeeCents: Number(p.setup_fee_cents ?? 0),
        recurringFeeCents: Number(p.recurring_fee_cents ?? 0),
      },
      signature: {
        signerName: sig.signer_name,
        signerEmail: sig.signer_email,
        signedAt: sig.signed_at,
        proposalVersion: sig.proposal_version,
      },
      proposalNumber: p.proposal_number,
    };
  });