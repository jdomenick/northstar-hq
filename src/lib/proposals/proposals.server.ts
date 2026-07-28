// Server-only helpers shared by proposals.functions.ts. Kept in a .server.ts
// file so client bundles cannot pull them in.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type DB = SupabaseClient<Database>;

export async function assertOrgRole(
  supabase: DB,
  userId: string,
  orgId: string,
  min: "member" | "executive" | "admin" | "owner",
): Promise<void> {
  const { data, error } = await supabase.rpc("has_org_role", {
    _org: orgId,
    _user: userId,
    _min: min,
  });
  if (error) throw new Error(`role_check_failed:${error.message}`);
  if (!data) throw new Error(`forbidden:${min}_required`);
}

export async function nextProposalNumber(supabase: DB, orgId: string): Promise<string> {
  const year = new Date().getUTCFullYear();
  const prefix = `NSL-${year}-`;
  const { data, error } = await supabase
    .from("nsl_proposals")
    .select("proposal_number")
    .eq("organization_id", orgId)
    .like("proposal_number", `${prefix}%`)
    .order("proposal_number", { ascending: false })
    .limit(1);
  if (error) throw error;
  const last = data?.[0]?.proposal_number;
  const seq = last ? Number(last.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

export async function logProposalActivity(
  supabase: DB,
  input: {
    organizationId: string;
    proposalId: string;
    action: string;
    actorType?: "user" | "client" | "system";
    actorId?: string | null;
    notes?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await supabase.from("nsl_proposal_activity").insert({
    organization_id: input.organizationId,
    proposal_id: input.proposalId,
    action: input.action,
    actor_type: input.actorType ?? "user",
    actor_id: input.actorId ?? null,
    notes: input.notes ?? null,
    metadata: (input.metadata ?? null) as never,
  });
  const mirror = [
    "submitted_for_review",
    "approved",
    "sent",
    "viewed",
    "accepted",
    "declined",
    "expired",
  ];
  if (mirror.includes(input.action)) {
    await supabase.from("activity_events").insert({
      organization_id: input.organizationId,
      actor_user_id: input.actorId ?? null,
      action: `proposal.${input.action}`,
      summary: input.notes ?? null,
      entity_type: "nsl_proposal",
      entity_id: input.proposalId,
      metadata: (input.metadata ?? null) as never,
    });
  }
}