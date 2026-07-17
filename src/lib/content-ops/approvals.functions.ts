import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireMembership } from "./membership.server";
import { ContentOpsError } from "./errors";
import { ApproveContentInput, BatchApproveInput, RejectContentInput } from "./schemas";
import { CONTENT_OPS_LIMITS } from "./constants";

// Insert an approval-log row. Column names match content_ops_approvals: the
// table uses approved_by/approved_at and requires content_version, and the
// action column's CHECK is ("approved","rejected","requested_revision",
// "batch_approved","revoked"). Passing "changes_requested" here would fail
// the DB check - callers use "requested_revision" instead.
async function recordApproval(
  supabase: Parameters<typeof requireMembership>[0],
  args: {
    organizationId: string;
    ventureId: string;
    contentItemId: string;
    contentVersion: number;
    userId: string;
    action: "approved" | "rejected" | "requested_revision" | "batch_approved" | "revoked";
    notes: string | null;
    batchId?: string | null;
    brandProfileVersion?: number | null;
  },
) {
  const { error } = await supabase.from("content_ops_approvals").insert({
    organization_id: args.organizationId,
    venture_id: args.ventureId,
    content_item_id: args.contentItemId,
    content_version: args.contentVersion,
    action: args.action,
    notes: args.notes,
    approved_by: args.userId,
    approved_at: new Date().toISOString(),
    batch_id: args.batchId ?? null,
    brand_profile_version: args.brandProfileVersion ?? null,
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
      .select("id, organization_id, venture_id, approval_status, status, content_version, brand_profile_version")
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
        approved_content_version: item.content_version,
        human_reviewed: true,
        status: item.status === "draft" ? "ready" : item.status,
      } as never)
      .eq("id", item.id);
    if (error) throw new ContentOpsError("unknown", error.message);
    await recordApproval(context.supabase, {
      organizationId: data.organizationId,
      ventureId: data.ventureId,
      contentItemId: item.id,
      contentVersion: item.content_version,
      userId: context.userId,
      action: "approved",
      notes: data.notes ?? null,
      brandProfileVersion: item.brand_profile_version ?? null,
    });
    return { ok: true, alreadyApproved: false };
  });

export const rejectContentItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RejectContentInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId, "executive");
    const { data: item, error: readErr } = await context.supabase
      .from("social_content_items")
      .select("id, content_version, brand_profile_version")
      .eq("id", data.contentItemId)
      .eq("organization_id", data.organizationId)
      .eq("venture_id", data.ventureId)
      .maybeSingle();
    if (readErr) throw new ContentOpsError("unknown", readErr.message);
    if (!item) throw new ContentOpsError("not_found", "content item not found");
    const { error } = await context.supabase
      .from("social_content_items")
      .update({
        approval_status: "rejected",
        status: "cancelled",
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
      contentVersion: item.content_version,
      userId: context.userId,
      action: "rejected",
      notes: data.reason,
      brandProfileVersion: item.brand_profile_version ?? null,
    });
    return { ok: true };
  });

export const batchApprove = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => BatchApproveInput.parse(input))
  .handler(async ({ data, context }) => {
    if (data.contentItemIds.length > CONTENT_OPS_LIMITS.maxBatchApprovalSize) {
      throw new ContentOpsError("invalid_input", `batch too large; max ${CONTENT_OPS_LIMITS.maxBatchApprovalSize}`);
    }
    if (!data.confirmationToken || data.confirmationToken.length < 8) {
      throw new ContentOpsError("invalid_input", "batch approval requires a deliberate confirmation token");
    }
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId, "executive");
    const batchId = crypto.randomUUID();
    const results: Array<{ id: string; ok: boolean; error?: string }> = [];
    for (const id of data.contentItemIds) {
      const { data: item, error: readErr } = await context.supabase
        .from("social_content_items")
        .select("id, content_version, status, brand_profile_version")
        .eq("id", id)
        .eq("organization_id", data.organizationId)
        .eq("venture_id", data.ventureId)
        .maybeSingle();
      if (readErr || !item) {
        results.push({ id, ok: false, error: readErr?.message ?? "not found" });
        continue;
      }
      const { error } = await context.supabase
        .from("social_content_items")
        .update({
          approval_status: "approved",
          approved_by: context.userId,
          approved_at: new Date().toISOString(),
          approved_content_version: item.content_version,
          human_reviewed: true,
          status: item.status === "draft" ? "ready" : item.status,
        } as never)
        .eq("id", id);
      if (error) {
        results.push({ id, ok: false, error: error.message });
      } else {
        await recordApproval(context.supabase, {
          organizationId: data.organizationId,
          ventureId: data.ventureId,
          contentItemId: id,
          contentVersion: item.content_version,
          userId: context.userId,
          action: "batch_approved",
          notes: data.notes ?? "batch_approval",
          batchId,
          brandProfileVersion: item.brand_profile_version ?? null,
        });
        results.push({ id, ok: true });
      }
    }
    return { results, batchId };
  });