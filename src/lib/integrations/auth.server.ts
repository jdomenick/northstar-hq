// Server-side authorization for integration operations.
// Every integration server function must resolve scope through here.
// The client cannot forge organization_id - it is derived server-side from
// the authenticated user's membership.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { IntegrationError } from "./errors";
import type { ConnectionScope } from "./types";

type SB = SupabaseClient<Database>;

export interface ResolvedScope extends ConnectionScope {
  role: "viewer" | "member" | "executive" | "admin" | "owner";
}

// Confirm the caller is an active member of the org, optionally scoped to a venture.
export async function resolveScope(
  supabase: SB,
  userId: string,
  organizationId: string,
  ventureId: string | null,
): Promise<ResolvedScope> {
  const { data: membership, error } = await supabase
    .from("organization_members")
    .select("role, status")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (error) throw new IntegrationError("internal_error", "membership lookup failed");
  if (!membership) throw new IntegrationError("forbidden", "not a member of this organization");

  if (ventureId) {
    const { data: venture, error: vErr } = await supabase
      .from("ventures")
      .select("id, organization_id")
      .eq("id", ventureId)
      .maybeSingle();
    if (vErr) throw new IntegrationError("internal_error", "venture lookup failed");
    if (!venture) throw new IntegrationError("venture_not_found");
    if (venture.organization_id !== organizationId) {
      throw new IntegrationError("cross_org_denied");
    }
  }

  return {
    organizationId,
    ventureId,
    role: membership.role as ResolvedScope["role"],
  };
}

export function requireRole(
  scope: ResolvedScope,
  min: "viewer" | "member" | "executive" | "admin" | "owner",
): void {
  const order = ["viewer", "member", "executive", "admin", "owner"] as const;
  if (order.indexOf(scope.role) < order.indexOf(min)) {
    throw new IntegrationError("forbidden", `requires role >= ${min}`);
  }
}

// Load a connection and verify it belongs to the caller's org.
export async function requireConnectionAccess(
  supabase: SB,
  connectionId: string,
  scope: ResolvedScope,
) {
  const { data, error } = await supabase
    .from("integration_connections")
    .select("*")
    .eq("id", connectionId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new IntegrationError("internal_error", "connection lookup failed");
  if (!data) throw new IntegrationError("connection_not_found");
  if (data.organization_id !== scope.organizationId) throw new IntegrationError("cross_org_denied");
  if (data.status === "disabled") throw new IntegrationError("connection_disabled");
  if (data.status === "archived") throw new IntegrationError("connection_archived");
  return data;
}

export async function requireSourceAccess(
  supabase: SB,
  sourceId: string,
  scope: ResolvedScope,
) {
  const { data, error } = await supabase
    .from("integration_sources")
    .select("*")
    .eq("id", sourceId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new IntegrationError("internal_error", "source lookup failed");
  if (!data) throw new IntegrationError("source_not_found");
  if (data.organization_id !== scope.organizationId) throw new IntegrationError("cross_org_denied");
  return data;
}