import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireMembership } from "./membership.server";
import { ContentOpsError } from "./errors";
import { ApproveContentInput, BatchApproveInput, RejectContentInput } from "./schemas";
import { CONTENT_OPS_LIMITS } from "./constants";

async function recordApproval(
  supabase: Parameters<typeof requireMembership>[0],
  args: {
    organizationId: string;
    ventureId: string;
    contentItemId: string;
    userId: string;
    action: "approved" | "rejected" | "changes_requested";
    notes: string | null;
  },
) {
  const { error } = await supabase.from("content_ops_approvals").insert({
    organization_id: args.organizationId,
    venture_id: args.ventureId,
    content_item_id: args.contentItemId,
    action: args.action,
    notes: args.notes,
    decided_by: args.userId,
    decided_at: new Date().toISOString(),
  } as never);
  if (error) throw new ContentOpsError("unknown", error.message);
}

export const approveContentItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ApproveContentInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId, "executive");
    const { data: item, error: readErr } = await context.supabase
      .from("social_content_items")
      .select("id, organization_id, venture_id, approval_status, status")
      .eq("id", data.contentItemId)
      .eq("organization_id", data.organizationId)
      .eq("venture_id", data.ventureId)
      .maybeSingle();
    if (readErr) throw new ContentOpsError("unknown", readErr.message);
    if (!item) throw new ContentOpsError("not_found", "content item not found");
    if (item.approval_status === "approved") return { ok: true, alreadyApproved: true };
    const { error } = await context.supabase
      .from("social_content_items")
      .update({
        approval_status: "approved",
        approved_by: context.userId,
        approved_at: new Date().toISOString(),
        human_reviewed: true,
        status: item.status === "draft" ? "ready" : item.status,
      } as never)
      .eq("id", item.id);
    if (error) throw new ContentOpsError("unknown", error.message);
    await recordApproval(context.supabase, {
      organizationId: data.organizationId,
      ventureId: data.ventureId,
      contentItemId: item.id,
      userId: context.userId,
      action: "approved",
      notes: data.notes ?? null,
    });
    return { ok: true, alreadyApproved: false };
  });

export const rejectContentItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RejectContentInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId, "executive");
    const { error } = await context.supabase
      .from("social_content_items")
      .update({
        approval_status: "rejected",
        rejected_by: context.userId,
        rejected_at: new Date().toISOString(),
        rejection_reason: data.reason,
        human_reviewed: true,
      } as never)
      .eq("id", data.contentItemId)
      .eq("organization_id", data.organizationId)
      .eq("venture_id", data.ventureId);
    if (error) throw new ContentOpsError("unknown", error.message);
    await recordApproval(context.supabase, {
      organizationId: data.organizationId,
      ventureId: data.ventureId,
      contentItemId: data.contentItemId,
      userId: context.userId,
      action: "rejected",
      notes: data.reason,
    });
    return { ok: true };
  });

export const batchApprove = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => BatchApproveInput.parse(input))
  .handler(async ({ data, context }) => {
    if (data.contentItemIds.length > CONTENT_OPS_LIMITS.maxBatchApproveSize) {
      throw new ContentOpsError("invalid_input", `batch too large; max ${CONTENT_OPS_LIMITS.maxBatchApproveSize}`);
    }
    if (!data.confirmationToken || data.confirmationToken.length < 8) {
      throw new ContentOpsError("invalid_input", "batch approval requires a deliberate confirmation token");
    }
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId, "executive");
    const results: Array<{ id: string; ok: boolean; error?: string }> = [];
    for (const id of data.contentItemIds) {
      const { error } = await context.supabase
        .from("social_content_items")
        .update({
          approval_status: "approved",
          approved_by: context.userId,
          approved_at: new Date().toISOString(),
          human_reviewed: true,
        } as never)
        .eq("id", id)
        .eq("organization_id", data.organizationId)
        .eq("venture_id", data.ventureId);
      if (error) {
        results.push({ id, ok: false, error: error.message });
      } else {
        await recordApproval(context.supabase, {
          organizationId: data.organizationId,
          ventureId: data.ventureId,
          contentItemId: id,
          userId: context.userId,
          action: "approved",
          notes: data.notes ?? "batch_approval",
        });
        results.push({ id, ok: true });
      }
    }
    return { results };
  });