// Server-side authorization for social operations. Callers never supply
// authoritative organization_id; it is derived from active membership.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { SocialError } from "./errors";

type SB = SupabaseClient<Database>;

export type OrgRole = "viewer" | "member" | "executive" | "admin" | "owner";
const ORDER: OrgRole[] = ["viewer","member","executive","admin","owner"];

export interface ResolvedSocialScope {
  organizationId: string;
  userId: string;
  role: OrgRole;
  ventureId: string | null;
}

export async function resolveSocialScope(
  supabase: SB,
  userId: string,
  organizationId: string,
  opts: { ventureId?: string | null } = {},
): Promise<ResolvedSocialScope> {
  const { data: m, error } = await supabase
    .from("organization_members")
    .select("role, status")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new SocialError("internal_social_error", "membership lookup failed");
  if (!m) throw new SocialError("permission_denied", "not a member of this organization");

  if (opts.ventureId) {
    const { data: v, error: ve } = await supabase
      .from("ventures").select("id, organization_id").eq("id", opts.ventureId).maybeSingle();
    if (ve) throw new SocialError("internal_social_error", "venture lookup failed");
    if (!v) throw new SocialError("invalid_scope", "venture not found");
    if (v.organization_id !== organizationId) throw new SocialError("invalid_scope", "cross-org venture");
  }

  return {
    organizationId, userId,
    role: m.role as OrgRole,
    ventureId: opts.ventureId ?? null,
  };
}

export function requireSocialRole(scope: ResolvedSocialScope, min: OrgRole): void {
  if (ORDER.indexOf(scope.role) < ORDER.indexOf(min)) {
    throw new SocialError("permission_denied", `requires role >= ${min}`);
  }
}

export async function requireAccountAccess(supabase: SB, accountId: string, organizationId: string) {
  const { data, error } = await supabase.from("social_accounts")
    .select("*").eq("id", accountId).is("deleted_at", null).maybeSingle();
  if (error) throw new SocialError("internal_social_error", "account lookup failed");
  if (!data) throw new SocialError("social_account_not_found");
  if (data.organization_id !== organizationId) throw new SocialError("invalid_scope", "cross-org account");
  return data;
}

export async function requireVentureAccess(supabase: SB, ventureId: string, organizationId: string) {
  const { data, error } = await supabase.from("ventures")
    .select("id, organization_id").eq("id", ventureId).maybeSingle();
  if (error) throw new SocialError("internal_social_error", "venture lookup failed");
  if (!data) throw new SocialError("invalid_scope", "venture not found");
  if (data.organization_id !== organizationId) throw new SocialError("invalid_scope", "cross-org venture");
  return data;
}