import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { ContentOpsError } from "./errors";

type SB = SupabaseClient<Database>;
type OrgRole = Database["public"]["Enums"]["org_role"];

const ROLE_ORDER: Record<OrgRole, number> = {
  viewer: 1,
  member: 2,
  executive: 3,
  admin: 4,
  owner: 5,
};

/**
 * Verify the caller is an active member of the organization AND (when given)
 * that the venture belongs to that organization. Returns the caller's role.
 * Never trust client-provided ids; every server function must call this first.
 */
export async function requireMembership(
  supabase: SB,
  userId: string,
  organizationId: string,
  ventureId: string | null,
  minRole: OrgRole = "member",
): Promise<{ role: OrgRole }> {
  const { data: mem, error } = await supabase
    .from("organization_members")
    .select("role, status")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !mem || mem.status !== "active") {
    throw new ContentOpsError("forbidden", "not an active member of this organization");
  }
  if (ROLE_ORDER[mem.role as OrgRole] < ROLE_ORDER[minRole]) {
    throw new ContentOpsError("forbidden", `requires role >= ${minRole}`);
  }
  if (ventureId) {
    const { data: v, error: vErr } = await supabase
      .from("ventures")
      .select("organization_id")
      .eq("id", ventureId)
      .maybeSingle();
    if (vErr || !v || v.organization_id !== organizationId) {
      throw new ContentOpsError("not_found", "venture not in this organization");
    }
  }
  return { role: mem.role as OrgRole };
}