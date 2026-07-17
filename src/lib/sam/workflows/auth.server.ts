// Server-side authentication and scope resolution for workflows.
// The client never sends authoritative organization_id — it is resolved
// from the caller's active membership. Venture scope, minimum role, and
// date range are all validated here.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { SamError } from "@/lib/errors";
import { SAM_WORKFLOW_LIMITS } from "@/lib/constants";
import type { WorkflowMinRole, WorkflowRunInput } from "./types";
import type { WorkflowRegistryEntry } from "./types";

type Client = SupabaseClient<Database>;
type OrgRole = Database["public"]["Enums"]["org_role"];

export interface ResolvedScope {
  orgId: string;
  userId: string;
  role: OrgRole;
  ventureId: string | null;
  periodStart: string | null;
  periodEnd: string | null;
}

async function resolveActiveOrganization(supabase: Client, userId: string): Promise<{ orgId: string; role: OrgRole }> {
  // Pick the caller's most recently updated active membership.
  const { data, error } = await supabase
    .from("organization_members")
    .select("organization_id, role, status, updated_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1);
  if (error) throw new SamError("membership_unavailable", error.message);
  const row = data?.[0];
  if (!row) throw new SamError("membership_unavailable");
  return { orgId: row.organization_id, role: row.role as OrgRole };
}

function roleMeetsMinimum(role: OrgRole, min: WorkflowMinRole): boolean {
  const order: Record<OrgRole, number> = {
    viewer: 1,
    member: 2,
    executive: 3,
    admin: 4,
    owner: 5,
  };
  const need: Record<WorkflowMinRole, number> = {
    viewer: 1,
    member: 2,
    executive: 3,
    admin: 4,
    owner: 5,
  };
  return (order[role] ?? 0) >= (need[min] ?? 99);
}

function validateDateRange(input: WorkflowRunInput, registry: WorkflowRegistryEntry): { start: string | null; end: string | null } {
  if (!input.periodStart && !input.periodEnd) return { start: null, end: null };
  if (!registry.supportsDateRange) throw new SamError("invalid_date_range");
  if (!input.periodStart || !input.periodEnd) throw new SamError("invalid_date_range");
  const start = new Date(input.periodStart);
  const end = new Date(input.periodEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new SamError("invalid_date_range");
  if (end.getTime() <= start.getTime()) throw new SamError("invalid_date_range");
  const days = (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
  if (days > SAM_WORKFLOW_LIMITS.maxDateRangeDays) throw new SamError("invalid_date_range");
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function resolveWorkflowScope(
  supabase: Client,
  userId: string,
  input: WorkflowRunInput,
  registry: WorkflowRegistryEntry,
): Promise<ResolvedScope> {
  if (!userId) throw new SamError("auth_required");
  const { orgId, role } = await resolveActiveOrganization(supabase, userId);

  // Enforce minimum role.
  if (!roleMeetsMinimum(role, registry.minRole)) throw new SamError("workflow_access_denied");

  // Scope check: registry declares which scopes it supports.
  if (!registry.supportedScopes.includes(input.scope)) throw new SamError("invalid_workflow_scope");

  // Venture validation.
  let ventureId: string | null = null;
  if (input.ventureId) {
    const { data: v, error: verr } = await supabase
      .from("ventures")
      .select("id, organization_id, deleted_at")
      .eq("id", input.ventureId)
      .maybeSingle();
    if (verr) throw new SamError("record_unavailable", verr.message);
    if (!v || v.organization_id !== orgId || v.deleted_at) throw new SamError("invalid_workflow_scope");
    ventureId = v.id;
  }
  if (registry.ventureRequired && !ventureId) throw new SamError("venture_required");
  if (input.scope === "venture" && !ventureId) throw new SamError("venture_required");

  const { start, end } = validateDateRange(input, registry);

  return { orgId, userId, role, ventureId, periodStart: start, periodEnd: end };
}