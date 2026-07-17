import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireMembership } from "./membership.server";
import { ContentOpsError } from "./errors";
import { CancelScheduleInput, ScheduleContentInput } from "./schemas";

export const scheduleContentItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ScheduleContentInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId, "executive");
    const { data: item, error: readErr } = await context.supabase
      .from("social_content_items")
      .select("id, approval_status, platform, venture_id, organization_id")
      .eq("id", data.contentItemId)
      .eq("organization_id", data.organizationId)
      .eq("venture_id", data.ventureId)
      .maybeSingle();
    if (readErr) throw new ContentOpsError("unknown", readErr.message);
    if (!item) throw new ContentOpsError("not_found", "content item not found");
    if (item.approval_status !== "approved") {
      throw new ContentOpsError("autonomy_forbids", "content item must be human-approved before scheduling");
    }
    const { error } = await context.supabase
      .from("social_content_items")
      .update({ status: "scheduled", scheduled_for: data.scheduledFor } as never)
      .eq("id", item.id);
    if (error) throw new ContentOpsError("unknown", error.message);
    const { data: job, error: jobErr } = await context.supabase
      .from("automation_jobs")
      .insert({
        organization_id: data.organizationId,
        venture_id: data.ventureId,
        job_kind: "social.publish",
        status: "queued",
        priority: "normal",
        scheduled_for: data.scheduledFor,
        available_at: data.scheduledFor,
        max_attempts: 3,
        timeout_seconds: 300,
        payload: { contentItemId: item.id, platform: item.platform },
      } as never)
      .select("id")
      .single();
    if (jobErr) throw new ContentOpsError("unknown", jobErr.message);
    return { ok: true, jobId: job.id };
  });

export const cancelSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CancelScheduleInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId, "executive");
    const { error } = await context.supabase
      .from("social_content_items")
      .update({ status: "ready", scheduled_for: null } as never)
      .eq("id", data.contentItemId)
      .eq("organization_id", data.organizationId)
      .eq("venture_id", data.ventureId);
    if (error) throw new ContentOpsError("unknown", error.message);
    return { ok: true };
  });