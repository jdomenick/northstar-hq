import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireMembership } from "./membership.server";
import { ContentOpsError } from "./errors";
import {
  CONTENT_OPS_POLICY_VERSION,
  CONTENT_OPS_LIMITS,
  type ContentOpsAutonomyMode,
} from "./constants";
import { EmergencyPauseInput, SetAutonomyInput, SetKillSwitchInput } from "./schemas";

export const getAutonomy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ({
    organizationId: (input as { organizationId: string }).organizationId,
    ventureId: (input as { ventureId: string }).ventureId,
  }))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId, "member");
    const { data: row, error } = await context.supabase
      .from("content_ops_autonomy")
      .select("*")
      .eq("organization_id", data.organizationId)
      .eq("venture_id", data.ventureId)
      .maybeSingle();
    if (error) throw new ContentOpsError("unknown", error.message);
    if (!row) {
      return {
        mode: "approval_required" as ContentOpsAutonomyMode,
        emergencyPause: false,
        emergencyPauseReason: null as string | null,
        platformPauses: {} as Record<string, boolean>,
        campaignPauses: {} as Record<string, boolean>,
        policyVersion: CONTENT_OPS_POLICY_VERSION,
        existsInDb: false,
      };
    }
    return {
      mode: row.mode as ContentOpsAutonomyMode,
      emergencyPause: row.emergency_pause,
      emergencyPauseReason: row.emergency_pause_reason,
      platformPauses: (row.platform_pauses ?? {}) as Record<string, boolean>,
      campaignPauses: (row.campaign_pauses ?? {}) as Record<string, boolean>,
      policyVersion: row.policy_version,
      existsInDb: true,
    };
  });

export const setAutonomy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SetAutonomyInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId, "executive");
    if (data.mode === "guarded_autopilot" || data.mode === "full_autopilot") {
      throw new ContentOpsError(
        "autonomy_forbids",
        "guarded_autopilot and full_autopilot are not enabled in this validation phase",
      );
    }
    const { data: row, error } = await context.supabase
      .from("content_ops_autonomy")
      .upsert({
        organization_id: data.organizationId,
        venture_id: data.ventureId,
        mode: data.mode,
        platform_pauses: data.platformPauses,
        campaign_pauses: data.campaignPauses,
        policy_version: CONTENT_OPS_POLICY_VERSION,
        changed_by: context.userId,
        changed_at: new Date().toISOString(),
      } as never, { onConflict: "venture_id" })
      .select("id, mode")
      .single();
    if (error) throw new ContentOpsError("unknown", error.message);
    return { id: row.id, mode: row.mode };
  });

export const triggerEmergencyPause = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => EmergencyPauseInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId, "owner");
    const { error } = await context.supabase
      .from("content_ops_autonomy")
      .upsert({
        organization_id: data.organizationId,
        venture_id: data.ventureId,
        mode: "approval_required",
        emergency_pause: true,
        emergency_pause_reason: data.reason,
        policy_version: CONTENT_OPS_POLICY_VERSION,
        changed_by: context.userId,
        changed_at: new Date().toISOString(),
      } as never, { onConflict: "venture_id" });
    if (error) throw new ContentOpsError("unknown", error.message);
    return { ok: true };
  });

export const clearEmergencyPause = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ({
    organizationId: (input as { organizationId: string }).organizationId,
    ventureId: (input as { ventureId: string }).ventureId,
  }))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId, "owner");
    const { error } = await context.supabase
      .from("content_ops_autonomy")
      .update({
        emergency_pause: false,
        emergency_pause_reason: null,
        changed_by: context.userId,
        changed_at: new Date().toISOString(),
      } as never)
      .eq("organization_id", data.organizationId)
      .eq("venture_id", data.ventureId);
    if (error) throw new ContentOpsError("unknown", error.message);
    return { ok: true };
  });

export const listKillSwitches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ({
    organizationId: (input as { organizationId: string }).organizationId,
  }))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, null, "member");
    const { data: rows, error } = await context.supabase
      .from("content_ops_kill_switches")
      .select("*")
      .eq("organization_id", data.organizationId)
      .eq("active", true)
      .order("set_at", { ascending: false })
      .limit(CONTENT_OPS_LIMITS.maxKillSwitchesPerOrg);
    if (error) throw new ContentOpsError("unknown", error.message);
    return rows ?? [];
  });

export const setKillSwitch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SetKillSwitchInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId ?? null, "owner");
    const { data: row, error } = await context.supabase
      .from("content_ops_kill_switches")
      .insert({
        organization_id: data.organizationId,
        scope: data.scope,
        scope_ref: data.scopeRef ?? null,
        venture_id: data.ventureId ?? null,
        active: true,
        reason: data.reason,
        set_by: context.userId,
      } as never)
      .select("id")
      .single();
    if (error) throw new ContentOpsError("unknown", error.message);
    return { id: row.id };
  });

export const clearKillSwitch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ({
    organizationId: (input as { organizationId: string }).organizationId,
    killSwitchId: (input as { killSwitchId: string }).killSwitchId,
  }))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, null, "owner");
    const { error } = await context.supabase
      .from("content_ops_kill_switches")
      .update({ active: false, cleared_by: context.userId, cleared_at: new Date().toISOString() } as never)
      .eq("id", data.killSwitchId)
      .eq("organization_id", data.organizationId);
    if (error) throw new ContentOpsError("unknown", error.message);
    return { ok: true };
  });

/**
 * Server-side gate: throws when publishing is blocked by autonomy, an
 * emergency pause, or any active kill switch (org, platform, or venture).
 */
export async function assertPublishingAllowed(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  ventureId: string,
  platform: string,
): Promise<void> {
  const [autonomyRes, ksRes] = await Promise.all([
    supabase.from("content_ops_autonomy")
      .select("mode, emergency_pause, platform_pauses")
      .eq("organization_id", organizationId)
      .eq("venture_id", ventureId)
      .maybeSingle(),
    supabase.from("content_ops_kill_switches")
      .select("scope, scope_ref, venture_id, active")
      .eq("organization_id", organizationId)
      .eq("active", true),
  ]);
  const autonomy = autonomyRes.data;
  if (autonomy?.emergency_pause) {
    throw new ContentOpsError("emergency_pause", "venture is under emergency pause");
  }
  const platformPauses = (autonomy?.platform_pauses ?? {}) as Record<string, boolean>;
  if (platformPauses[platform]) {
    throw new ContentOpsError("emergency_pause", `platform ${platform} is paused for this venture`);
  }
  for (const ks of ksRes.data ?? []) {
    if (ks.scope === "organization") {
      throw new ContentOpsError("kill_switch_active", "organization-wide kill switch is active");
    }
    if (ks.scope === "platform" && ks.scope_ref === platform) {
      throw new ContentOpsError("kill_switch_active", `platform kill switch active for ${platform}`);
    }
    if (ks.scope === "venture" && ks.venture_id === ventureId) {
      throw new ContentOpsError("kill_switch_active", "venture kill switch is active");
    }
  }
}