import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const OrgOnly = z.object({ organizationId: z.string().uuid() });

async function requireRole(supabase: unknown, orgId: string, userId: string, min: "executive" | "owner"): Promise<string> {
  const sb = supabase as { from: (t: string) => { select: (s: string) => { eq: (a: string, b: string) => { eq: (c: string, d: string) => { maybeSingle: () => Promise<{ data: { role: string; status: string } | null }> } } } } };
  const { data } = await sb.from("organization_members").select("role, status").eq("organization_id", orgId).eq("user_id", userId).maybeSingle();
  if (!data || data.status !== "active") throw new Error("Not a member");
  const order = ["viewer", "member", "executive", "admin", "owner"];
  if (order.indexOf(data.role) < order.indexOf(min)) throw new Error(`Requires ${min}+ role`);
  return data.role;
}

export const getAutonomy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => OrgOnly.parse(i))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("sam_org_autonomy" as never)
      .select("state, reason, changed_by, changed_at, updated_at" as never)
      .eq("organization_id", data.organizationId)
      .maybeSingle();
    return (row ?? { state: "active", reason: null, changed_by: null, changed_at: null, updated_at: null }) as unknown as {
      state: "active" | "paused" | "emergency_stopped";
      reason: string | null;
      changed_by: string | null;
      changed_at: string | null;
      updated_at: string | null;
    };
  });

const SetInput = z.object({
  organizationId: z.string().uuid(),
  state: z.enum(["active", "paused", "emergency_stopped"]),
  reason: z.string().max(500).optional(),
  confirm: z.literal("STOP").optional(),
});
export const setAutonomy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => SetInput.parse(i))
  .handler(async ({ data, context }) => {
    const min = data.state === "emergency_stopped" ? "owner" : "executive";
    await requireRole(context.supabase, data.organizationId, context.userId, min);
    if (data.state === "emergency_stopped" && data.confirm !== "STOP") {
      throw new Error('Emergency stop requires typed confirmation "STOP"');
    }
    const now = new Date().toISOString();
    const { error } = await context.supabase.from("sam_org_autonomy" as never)
      .upsert({
        organization_id: data.organizationId, state: data.state,
        reason: data.reason ?? null, changed_by: context.userId, changed_at: now,
      } as never, { onConflict: "organization_id" } as never);
    if (error) throw new Error(error.message);

    // Emergency stop: cancel queued/scheduled/retrying jobs for this org.
    if (data.state === "emergency_stopped") {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("automation_jobs")
        .update({ status: "cancelled", completed_at: now, error_code: "cancelled_by_emergency_stop" })
        .eq("organization_id", data.organizationId)
        .in("status", ["queued", "scheduled", "retrying", "blocked"]);
    }

    await context.supabase.from("activity_events").insert({
      organization_id: data.organizationId, actor_user_id: context.userId,
      action: `sam_autonomy_${data.state}`, entity_type: "sam_org_autonomy", entity_id: data.organizationId,
      summary: `SAM state -> ${data.state}`,
      metadata: { reason: data.reason ?? null } as never,
    });
    return { ok: true, state: data.state };
  });

// Convenience: enqueue a proof mission from the founder controls.
export const runProofMissionFromControl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => OrgOnly.parse(i))
  .handler(async ({ data, context }) => {
    const { executeSamAction } = await import("@/lib/sam/actions/execute.server");
    const receipt = await executeSamAction({
      supabase: context.supabase, organizationId: data.organizationId,
      userId: context.userId, ventureId: null,
      message: "Run SAM proof mission",
      conversationId: "control-panel",
    });
    return receipt;
  });