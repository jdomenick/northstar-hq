import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireMembership } from "./membership.server";
import { ContentOpsError } from "./errors";
import { CreateCalendarEntryInput } from "./schemas";
import { CONTENT_OPS_LIMITS } from "./constants";

export const createCalendarEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateCalendarEntryInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId, "executive");
    const { data: row, error } = await context.supabase
      .from("social_content_plans")
      .insert({
        organization_id: data.organizationId,
        venture_id: data.ventureId,
        campaign_id: data.campaignId ?? null,
        name: `${data.platform} - ${data.scheduledFor.slice(0, 10)}`,
        status: "draft",
        planned_start: data.scheduledFor,
        planned_end: data.scheduledFor,
        automation_mode: "approval_required",
        approval_policy: "human_required",
        created_by: context.userId,
        metadata: { platform: data.platform, contentType: data.contentType, pillarId: data.pillarId, brief: data.brief },
      } as never)
      .select("id")
      .single();
    if (error) throw new ContentOpsError("unknown", error.message);
    return { id: row.id };
  });

export const listCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ({
    organizationId: (input as { organizationId: string }).organizationId,
    ventureId: (input as { ventureId: string }).ventureId,
    fromDate: (input as { fromDate: string }).fromDate,
    toDate: (input as { toDate: string }).toDate,
  }))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId, "member");
    const { data: rows, error } = await context.supabase
      .from("social_content_plans")
      .select("id, name, status, planned_start, planned_end, campaign_id, metadata")
      .eq("organization_id", data.organizationId)
      .eq("venture_id", data.ventureId)
      .gte("planned_start", data.fromDate)
      .lte("planned_end", data.toDate)
      .is("deleted_at", null)
      .order("planned_start", { ascending: true })
      .limit(CONTENT_OPS_LIMITS.maxListPageSize);
    if (error) throw new ContentOpsError("unknown", error.message);
    return rows ?? [];
  });