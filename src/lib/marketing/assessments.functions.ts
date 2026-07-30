// Operator-side access to public Assessment requests. RLS on
// nsl_assessment_requests restricts these rows to operator accounts, so the
// authenticated per-user client is the only client used here.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const ASSESSMENT_STATUSES = ["new", "reviewed", "converted", "archived"] as const;

/** Statuses an operator may set directly. `converted` is set by conversion. */
export const SETTABLE_ASSESSMENT_STATUSES = ["new", "reviewed", "archived"] as const;

export type AssessmentStatus = (typeof ASSESSMENT_STATUSES)[number];

const SELECT =
  "id, created_at, updated_at, full_name, company, email, phone, website, industry, business_size, biggest_challenge, referral_source, status, operator_notes, reviewed_at, notification_status, notification_attempted_at, notification_sent_at, notification_error, organization_id, revenue_client_id, converted_at, proposal_id, archived_at";

const OrgId = z.string().uuid();

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|co|corp|company|group|holdings)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function normalizeDomain(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim().toLowerCase();
  if (!raw) return null;
  const withoutScheme = raw.replace(/^https?:\/\//, "").replace(/^www\./, "");
  const host = withoutScheme.split("/")[0]?.trim();
  return host && host.includes(".") ? host : null;
}

function emailDomain(email: string): string | null {
  const part = email.trim().toLowerCase().split("@")[1];
  return part && part.includes(".") ? part : null;
}

export const listAssessmentRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("nsl_assessment_requests")
      .select(SELECT)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getAssessmentRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("nsl_assessment_requests")
      .select(SELECT)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Assessment request not found or not accessible.");

    const client = row.revenue_client_id
      ? (
          await context.supabase
            .from("revenue_clients")
            .select("id, name, status")
            .eq("id", row.revenue_client_id)
            .maybeSingle()
        ).data
      : null;

    const proposal = row.proposal_id
      ? (
          await context.supabase
            .from("nsl_proposals")
            .select("id, proposal_number, title, status")
            .eq("id", row.proposal_id)
            .maybeSingle()
        ).data
      : null;

    return { request: row, client, proposal };
  });

const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(SETTABLE_ASSESSMENT_STATUSES).optional(),
  operatorNotes: z.string().trim().max(4000).optional(),
});

export const updateAssessmentRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const now = new Date().toISOString();
    const patch: {
      updated_at: string;
      status?: AssessmentStatus;
      reviewed_at?: string;
      reviewed_by?: string;
      archived_at?: string;
      archived_by?: string;
      operator_notes?: string;
    } = { updated_at: now };
    if (data.status) {
      patch.status = data.status;
      if (data.status === "reviewed") {
        patch.reviewed_at = now;
        patch.reviewed_by = context.userId;
      }
      if (data.status === "archived") {
        patch.archived_at = now;
        patch.archived_by = context.userId;
      }
    }
    if (data.operatorNotes !== undefined) patch.operator_notes = data.operatorNotes;

    const { data: row, error } = await context.supabase
      .from("nsl_assessment_requests")
      .update(patch)
      .eq("id", data.id)
      .neq("status", "converted")
      .select(SELECT)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Request not found, not accessible, or already converted.");
    return row;
  });

/* ------------------------- duplicate detection ------------------------- */

export const findAssessmentDuplicates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), organizationId: OrgId }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: request, error } = await context.supabase
      .from("nsl_assessment_requests")
      .select("company, email, website")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!request) throw new Error("Assessment request not found or not accessible.");

    const [clientsRes, profilesRes] = await Promise.all([
      context.supabase
        .from("revenue_clients")
        .select("id, name, status, created_at")
        .eq("organization_id", data.organizationId)
        .limit(500),
      context.supabase
        .from("client_company_profiles")
        .select("client_id, primary_email, website_url, legal_business_name")
        .eq("organization_id", data.organizationId)
        .limit(500),
    ]);
    if (clientsRes.error) throw new Error(clientsRes.error.message);
    if (profilesRes.error) throw new Error(profilesRes.error.message);

    const targetName = normalizeName(request.company);
    const targetEmail = request.email.trim().toLowerCase();
    const targetDomain = normalizeDomain(request.website) ?? emailDomain(targetEmail);

    const profileByClient = new Map(
      (profilesRes.data ?? []).map((p) => [p.client_id, p] as const),
    );

    const matches = (clientsRes.data ?? [])
      .map((c) => {
        const profile = profileByClient.get(c.id);
        const reasons: string[] = [];
        if (targetName && normalizeName(c.name) === targetName) reasons.push("Same company name");
        if (profile?.primary_email && profile.primary_email.trim().toLowerCase() === targetEmail) {
          reasons.push("Same contact email");
        }
        const clientDomain =
          normalizeDomain(profile?.website_url) ??
          (profile?.primary_email ? emailDomain(profile.primary_email) : null);
        if (targetDomain && clientDomain && targetDomain === clientDomain) {
          reasons.push("Same web domain");
        }
        return { id: c.id, name: c.name, status: c.status, created_at: c.created_at, reasons };
      })
      .filter((m) => m.reasons.length > 0)
      .sort((a, b) => b.reasons.length - a.reasons.length)
      .slice(0, 10);

    return matches;
  });

/* ----------------------------- conversion ------------------------------ */

const convertSchema = z.object({
  id: z.string().uuid(),
  organizationId: OrgId,
  existingClientId: z.string().uuid().nullable().optional(),
  company: z.string().trim().min(2).max(160).optional(),
  contactName: z.string().trim().min(2).max(160).optional(),
  email: z.string().trim().email().max(255).optional(),
  phone: z.string().trim().max(40).optional(),
  website: z.string().trim().max(255).optional(),
});

export const convertAssessmentToClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => convertSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc("nsl_assessment_convert", {
      _assessment_id: data.id,
      _organization_id: data.organizationId,
      _existing_client_id: data.existingClientId ?? undefined,
      _company: data.company ?? undefined,
      _contact_name: data.contactName ?? undefined,
      _email: data.email ?? undefined,
      _phone: data.phone ?? undefined,
      _website: data.website ?? undefined,
    });
    if (error) {
      if (error.message.includes("forbidden")) {
        throw new Error("You need executive access in this organization to convert requests.");
      }
      throw new Error(error.message);
    }
    const row = Array.isArray(result) ? result[0] : result;
    if (!row?.client_id) throw new Error("Conversion did not return a client.");
    return { clientId: row.client_id, created: row.created, idempotent: row.idempotent };
  });

/* --------------------------- start proposal ---------------------------- */

export const startProposalFromAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), organizationId: OrgId }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: request, error } = await context.supabase
      .from("nsl_assessment_requests")
      .select(
        "id, company, industry, business_size, biggest_challenge, revenue_client_id, proposal_id, organization_id",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!request) throw new Error("Assessment request not found or not accessible.");
    if (request.proposal_id) {
      return { proposalId: request.proposal_id, created: false };
    }
    if (!request.revenue_client_id) {
      throw new Error("Convert this request to a client before starting a proposal.");
    }

    const { assertOrgRole, nextProposalNumber, logProposalActivity } = await import(
      "@/lib/proposals/proposals.server"
    );
    const { assembleDraft } = await import("@/lib/proposals/generate.server");
    await assertOrgRole(context.supabase, context.userId, data.organizationId, "member");

    const draft = await assembleDraft(
      context.supabase,
      data.organizationId,
      request.revenue_client_id,
      null,
    );
    const proposalNumber = await nextProposalNumber(context.supabase, data.organizationId);

    const contextLines = [
      `Industry: ${request.industry?.trim() || "Not provided"}`,
      `Business size: ${request.business_size?.trim() || "Not provided"}`,
    ].join("\n");

    const { data: inserted, error: insertError } = await context.supabase
      .from("nsl_proposals")
      .insert({
        organization_id: data.organizationId,
        client_id: request.revenue_client_id,
        proposal_number: proposalNumber,
        title: draft.title,
        executive_summary: draft.executive_summary,
        business_overview: `${draft.business_overview}\n\n${contextLines}`,
        current_challenges: request.biggest_challenge,
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
    if (insertError) throw new Error(insertError.message);

    await logProposalActivity(context.supabase, {
      organizationId: data.organizationId,
      proposalId: inserted.id,
      action: "created",
      actorId: context.userId,
      notes: "Created from a public Assessment request.",
    });

    const { error: linkError } = await context.supabase
      .from("nsl_assessment_requests")
      .update({ proposal_id: inserted.id, updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .is("proposal_id", null);
    if (linkError) throw new Error(linkError.message);

    return { proposalId: inserted.id, created: true };
  });

/* ------------------------ notification recovery ------------------------ */

export const retryAssessmentNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("nsl_assessment_requests")
      .select(
        "id, full_name, company, email, phone, website, industry, business_size, biggest_challenge, referral_source",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Assessment request not found or not accessible.");

    const { sendAssessmentNotification } = await import("./notify.server");
    const origin = process.env.PUBLIC_SITE_URL?.trim() || "https://northstar-labs.lovable.app";
    const outcome = await sendAssessmentNotification({
      id: row.id,
      fullName: row.full_name,
      company: row.company,
      email: row.email,
      phone: row.phone,
      website: row.website,
      industry: row.industry,
      businessSize: row.business_size,
      biggestChallenge: row.biggest_challenge,
      referralSource: row.referral_source,
      reviewUrl: `${origin}/labs/assessment/${row.id}`,
    });

    const now = new Date().toISOString();
    const { error: updateError } = await context.supabase
      .from("nsl_assessment_requests")
      .update({
        notification_status: outcome.status,
        notification_attempted_at: now,
        notification_sent_at: outcome.status === "sent" ? now : null,
        notification_error: outcome.status === "sent" ? null : outcome.error,
      })
      .eq("id", row.id);
    if (updateError) throw new Error(updateError.message);
    return outcome;
  });