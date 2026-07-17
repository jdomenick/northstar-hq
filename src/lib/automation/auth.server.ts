// Server-side authorization for the Automation Engine. Callers never supply
// an authoritative organization_id - it is derived from active membership.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { AutomationError } from "./errors";
import type { AutomationScope } from "./types";

type SB = SupabaseClient<Database>;

export type OrgRole = "viewer" | "member" | "executive" | "admin" | "owner";
const ROLE_ORDER: OrgRole[] = ["viewer", "member", "executive", "admin", "owner"];

export interface ResolvedAutomationScope extends AutomationScope {
  role: OrgRole;
  userId: string;
}

export async function resolveAutomationScope(
  supabase: SB,
  userId: string,
  organizationId: string,
  opts: {
    ventureId?: string | null;
    assetId?: string | null;
    integrationConnectionId?: string | null;
    integrationSourceId?: string | null;
  } = {},
): Promise<ResolvedAutomationScope> {
  const { data: membership, error } = await supabase
    .from("organization_members")
    .select("role, status")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new AutomationError("internal_automation_error", "membership lookup failed");
  if (!membership) throw new AutomationError("permission_denied", "not a member of this organization");

  if (opts.ventureId) {
    const { data, error: err } = await supabase
      .from("ventures").select("id, organization_id").eq("id", opts.ventureId).maybeSingle();
    if (err) throw new AutomationError("internal_automation_error", "venture lookup failed");
    if (!data) throw new AutomationError("record_unavailable", "venture not found");
    if (data.organization_id !== organizationId) throw new AutomationError("cross_org_denied");
  }
  if (opts.assetId) {
    const { data, error: err } = await supabase
      .from("assets").select("id, organization_id").eq("id", opts.assetId).maybeSingle();
    if (err) throw new AutomationError("internal_automation_error", "asset lookup failed");
    if (!data) throw new AutomationError("record_unavailable", "asset not found");
    if (data.organization_id !== organizationId) throw new AutomationError("cross_org_denied");
  }
  if (opts.integrationConnectionId) {
    const { data, error: err } = await supabase
      .from("integration_connections").select("id, organization_id").eq("id", opts.integrationConnectionId).maybeSingle();
    if (err) throw new AutomationError("internal_automation_error", "connection lookup failed");
    if (!data) throw new AutomationError("record_unavailable", "connection not found");
    if (data.organization_id !== organizationId) throw new AutomationError("cross_org_denied");
  }
  if (opts.integrationSourceId) {
    const { data, error: err } = await supabase
      .from("integration_sources").select("id, organization_id").eq("id", opts.integrationSourceId).maybeSingle();
    if (err) throw new AutomationError("internal_automation_error", "source lookup failed");
    if (!data) throw new AutomationError("record_unavailable", "source not found");
    if (data.organization_id !== organizationId) throw new AutomationError("cross_org_denied");
  }

  return {
    organizationId,
    ventureId: opts.ventureId ?? null,
    assetId: opts.assetId ?? null,
    integrationConnectionId: opts.integrationConnectionId ?? null,
    integrationSourceId: opts.integrationSourceId ?? null,
    role: membership.role as OrgRole,
    userId,
  };
}

export function requireRole(scope: ResolvedAutomationScope, min: OrgRole): void {
  if (ROLE_ORDER.indexOf(scope.role) < ROLE_ORDER.indexOf(min)) {
    throw new AutomationError("permission_denied", `requires role >= ${min}`);
  }
}

// Assert that a stored automation definition belongs to caller's org.
export async function requireAutomationDefinitionAccess(
  supabase: SB,
  automationDefinitionId: string,
  organizationId: string,
) {
  const { data, error } = await supabase
    .from("automation_definitions")
    .select("*")
    .eq("id", automationDefinitionId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new AutomationError("internal_automation_error", "automation lookup failed");
  if (!data) throw new AutomationError("automation_not_found");
  if (data.organization_id !== organizationId) throw new AutomationError("cross_org_denied");
  return data;
}

export async function requireJobAccess(
  supabase: SB,
  jobId: string,
  organizationId: string,
) {
  const { data, error } = await supabase
    .from("automation_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();
  if (error) throw new AutomationError("internal_automation_error", "job lookup failed");
  if (!data) throw new AutomationError("job_not_found");
  if (data.organization_id !== organizationId) throw new AutomationError("cross_org_denied");
  return data;
}