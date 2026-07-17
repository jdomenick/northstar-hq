// Server functions for organization and venture operating context.
// All routed through requireSupabaseAuth so RLS enforces org + role scope.
// Executives and above may create / update / review. Admins may delete.
// History is written automatically by database triggers.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { SamError } from "@/lib/errors";
import {
  OrgOperatingContextInput,
  VentureOperatingContextInput,
  ReviewContextInput,
  type OrgOperatingContextRow,
  type VentureOperatingContextRow,
} from "./schema";
import { COO_OP_CONTEXT_VERSION, COO_VENTURE_CONTEXT_VERSION, COO_LIMITS } from "@/lib/constants";
import type { Database } from "@/integrations/supabase/types";

type Sb = import("@supabase/supabase-js").SupabaseClient<Database>;

async function assertMembership(supabase: Sb, orgId: string, userId: string) {
  const { data: mem } = await supabase
    .from("organization_members")
    .select("role, status")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!mem || mem.status !== "active") throw new SamError("membership_unavailable");
  return mem;
}

function stripUndefined<T extends Record<string, unknown>>(patch: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) out[k] = v;
  }
  return out as Partial<T>;
}

// ---- Organization operating context --------------------------------------

const OrgReadInput = z.object({ organizationId: z.string().uuid() });

export const getOrgOperatingContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => OrgReadInput.parse(input))
  .handler(async ({ data, context }): Promise<OrgOperatingContextRow | null> => {
    const { supabase, userId } = context;
    await assertMembership(supabase, data.organizationId, userId);
    const { data: row, error } = await supabase
      .from("organization_operating_context")
      .select("*")
      .eq("organization_id", data.organizationId)
      .maybeSingle();
    if (error) throw new SamError("op_context_persistence_failed", error.message);
    return row;
  });

export const upsertOrgOperatingContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => OrgOperatingContextInput.parse(input))
  .handler(async ({ data, context }): Promise<OrgOperatingContextRow> => {
    const { supabase, userId } = context;
    await assertMembership(supabase, data.organizationId, userId);

    const { data: existing } = await supabase
      .from("organization_operating_context")
      .select("id")
      .eq("organization_id", data.organizationId)
      .maybeSingle();

    const patch = stripUndefined({
      company_summary: data.company_summary ?? null,
      mission: data.mission ?? null,
      current_stage: data.current_stage ?? null,
      business_model: data.business_model ?? null,
      primary_customers: data.primary_customers ?? null,
      strategic_priorities: data.strategic_priorities,
      current_constraints: data.current_constraints,
      operating_principles: data.operating_principles,
      founder_preferences: data.founder_preferences,
      decision_preferences: data.decision_preferences,
      risk_tolerance: data.risk_tolerance ?? null,
      time_horizon: data.time_horizon ?? null,
      current_focus: data.current_focus ?? null,
      major_goals: data.major_goals,
      major_risks: data.major_risks,
      important_metrics: data.important_metrics,
      active_ventures: data.active_ventures,
      source_lineage: data.source_lineage,
      policy_version: COO_OP_CONTEXT_VERSION,
      updated_by: userId,
    });

    if (existing) {
      const { data: row, error } = await supabase
        .from("organization_operating_context")
        .update(patch)
        .eq("id", existing.id)
        .eq("organization_id", data.organizationId)
        .select("*")
        .single();
      if (error || !row) throw new SamError("op_context_persistence_failed", error?.message);
      return row;
    }

    const { data: row, error } = await supabase
      .from("organization_operating_context")
      .insert({
        organization_id: data.organizationId,
        ...patch,
        created_by: userId,
      })
      .select("*")
      .single();
    if (error || !row) throw new SamError("op_context_persistence_failed", error?.message);
    return row;
  });

export const reviewOrgOperatingContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ReviewContextInput.parse(input))
  .handler(async ({ data, context }): Promise<OrgOperatingContextRow> => {
    const { supabase, userId } = context;
    await assertMembership(supabase, data.organizationId, userId);
    const { data: row, error } = await supabase
      .from("organization_operating_context")
      .update({
        last_reviewed_at: new Date().toISOString(),
        last_reviewed_by: userId,
        updated_by: userId,
      })
      .eq("organization_id", data.organizationId)
      .select("*")
      .single();
    if (error) throw new SamError("op_context_persistence_failed", error.message);
    if (!row) throw new SamError("op_context_not_found");
    return row;
  });

export const listOrgOperatingContextHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => OrgReadInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMembership(supabase, data.organizationId, userId);
    const { data: rows, error } = await supabase
      .from("organization_operating_context_history")
      .select("*")
      .eq("organization_id", data.organizationId)
      .order("changed_at", { ascending: false })
      .limit(COO_LIMITS.maxHistoryPage);
    if (error) throw new SamError("op_context_persistence_failed", error.message);
    return rows ?? [];
  });

// ---- Venture operating context -------------------------------------------

const VentureReadInput = z.object({
  organizationId: z.string().uuid(),
  ventureId: z.string().uuid(),
});

async function assertVentureScope(supabase: Sb, orgId: string, ventureId: string) {
  const { data: v } = await supabase
    .from("ventures")
    .select("id, organization_id")
    .eq("id", ventureId)
    .maybeSingle();
  if (!v || v.organization_id !== orgId) throw new SamError("op_context_scope_invalid");
}

export const getVentureOperatingContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => VentureReadInput.parse(input))
  .handler(async ({ data, context }): Promise<VentureOperatingContextRow | null> => {
    const { supabase, userId } = context;
    await assertMembership(supabase, data.organizationId, userId);
    await assertVentureScope(supabase, data.organizationId, data.ventureId);
    const { data: row, error } = await supabase
      .from("venture_operating_context")
      .select("*")
      .eq("venture_id", data.ventureId)
      .eq("organization_id", data.organizationId)
      .maybeSingle();
    if (error) throw new SamError("op_context_persistence_failed", error.message);
    return row;
  });

export const upsertVentureOperatingContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => VentureOperatingContextInput.parse(input))
  .handler(async ({ data, context }): Promise<VentureOperatingContextRow> => {
    const { supabase, userId } = context;
    await assertMembership(supabase, data.organizationId, userId);
    await assertVentureScope(supabase, data.organizationId, data.ventureId);

    const { data: existing } = await supabase
      .from("venture_operating_context")
      .select("id")
      .eq("venture_id", data.ventureId)
      .eq("organization_id", data.organizationId)
      .maybeSingle();

    const patch = stripUndefined({
      venture_summary: data.venture_summary ?? null,
      mission: data.mission ?? null,
      target_customer: data.target_customer ?? null,
      business_model: data.business_model ?? null,
      current_stage: data.current_stage ?? null,
      current_objectives: data.current_objectives,
      roadmap_summary: data.roadmap_summary ?? null,
      active_projects: data.active_projects,
      major_dependencies: data.major_dependencies,
      current_bottlenecks: data.current_bottlenecks,
      current_risks: data.current_risks,
      success_metrics: data.success_metrics,
      strategic_assumptions: data.strategic_assumptions,
      market_position: data.market_position ?? null,
      offers: data.offers,
      products: data.products,
      services: data.services,
      current_priorities: data.current_priorities,
      paused_priorities: data.paused_priorities,
      operating_notes: data.operating_notes ?? null,
      source_lineage: data.source_lineage,
      policy_version: COO_VENTURE_CONTEXT_VERSION,
      updated_by: userId,
    });

    if (existing) {
      const { data: row, error } = await supabase
        .from("venture_operating_context")
        .update(patch)
        .eq("id", existing.id)
        .eq("organization_id", data.organizationId)
        .select("*")
        .single();
      if (error || !row) throw new SamError("op_context_persistence_failed", error?.message);
      return row;
    }

    const { data: row, error } = await supabase
      .from("venture_operating_context")
      .insert({
        organization_id: data.organizationId,
        venture_id: data.ventureId,
        ...patch,
        created_by: userId,
      })
      .select("*")
      .single();
    if (error || !row) throw new SamError("op_context_persistence_failed", error?.message);
    return row;
  });

export const reviewVentureOperatingContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        organizationId: z.string().uuid(),
        ventureId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<VentureOperatingContextRow> => {
    const { supabase, userId } = context;
    await assertMembership(supabase, data.organizationId, userId);
    await assertVentureScope(supabase, data.organizationId, data.ventureId);
    const { data: row, error } = await supabase
      .from("venture_operating_context")
      .update({
        last_reviewed_at: new Date().toISOString(),
        last_reviewed_by: userId,
        updated_by: userId,
      })
      .eq("venture_id", data.ventureId)
      .eq("organization_id", data.organizationId)
      .select("*")
      .single();
    if (error) throw new SamError("op_context_persistence_failed", error.message);
    if (!row) throw new SamError("op_context_not_found");
    return row;
  });

export const listVentureOperatingContextHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => VentureReadInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMembership(supabase, data.organizationId, userId);
    await assertVentureScope(supabase, data.organizationId, data.ventureId);
    const { data: rows, error } = await supabase
      .from("venture_operating_context_history")
      .select("*")
      .eq("organization_id", data.organizationId)
      .eq("venture_id", data.ventureId)
      .order("changed_at", { ascending: false })
      .limit(COO_LIMITS.maxHistoryPage);
    if (error) throw new SamError("op_context_persistence_failed", error.message);
    return rows ?? [];
  });