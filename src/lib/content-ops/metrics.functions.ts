import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireMembership } from "./membership.server";
import { ContentOpsError } from "./errors";

export const listPerformance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ({
    organizationId: (input as { organizationId: string }).organizationId,
    ventureId: (input as { ventureId: string }).ventureId,
    fromDate: (input as { fromDate?: string }).fromDate,
  }))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId, "member");
    let q = context.supabase
      .from("social_content_metrics")
      .select("id, content_item_id, social_account_id, platform, collected_at, impressions, reach, likes, comments, shares, clicks, saves")
      .eq("organization_id", data.organizationId)
      .eq("venture_id", data.ventureId)
      .order("collected_at", { ascending: false })
      .limit(500);
    if (data.fromDate) q = q.gte("collected_at", data.fromDate);
    const { data: rows, error } = await q;
    if (error) throw new ContentOpsError("unknown", error.message);
    return rows ?? [];
  });

export const contentPerformanceSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ({
    organizationId: (input as { organizationId: string }).organizationId,
    ventureId: (input as { ventureId: string }).ventureId,
    contentItemId: (input as { contentItemId: string }).contentItemId,
  }))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId, "member");
    const { data: rows, error } = await context.supabase
      .from("social_content_metrics")
      .select("impressions, reach, likes, comments, shares, clicks, saves, collected_at")
      .eq("organization_id", data.organizationId)
      .eq("venture_id", data.ventureId)
      .eq("content_item_id", data.contentItemId)
      .order("collected_at", { ascending: false })
      .limit(1);
    if (error) throw new ContentOpsError("unknown", error.message);
    return rows?.[0] ?? null;
  });