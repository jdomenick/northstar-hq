// Content Operations - Shared media pipeline server functions.
//
// This is the only path through which media enters the system. Every
// publishing destination consumes assets produced here. Uploads use the
// existing organization-documents storage bucket with per-org RLS; no new
// bucket is created and no duplicate storage system is introduced.
//
// Path convention: <organization_id>/content-media/<venture_id>/<asset_id>[.ext]

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireMembership } from "./membership.server";
import { ContentOpsError } from "./errors";
import { CONTENT_OPS_LIMITS } from "./constants";

const uuid = z.string().uuid();

const MEDIA_BUCKET = "organization-documents";

// Central limits so nothing hardcodes them elsewhere.
export const MEDIA_UPLOAD_LIMITS = {
  maxBytes: 500 * 1024 * 1024,               // 500 MB hard cap; per-platform validation narrows
  maxAttachmentsPerVariant: 20,              // shared max across all destinations
} as const;

const MediaTypeEnum = z.enum([
  "image", "video", "carousel_image", "thumbnail", "document", "audio", "other",
]);
const AttachmentRoleEnum = z.enum(["primary", "carousel_item", "thumbnail", "reference"]);
const SourceEnum = z.enum(["upload", "reference", "generated", "placeholder"]);

function inferExtension(mime: string | null | undefined): string {
  if (!mime) return "";
  const map: Record<string, string> = {
    "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif",
    "video/mp4": ".mp4", "video/quicktime": ".mov", "video/webm": ".webm",
    "audio/mpeg": ".mp3", "audio/wav": ".wav",
    "application/pdf": ".pdf",
  };
  return map[mime] ?? "";
}

function storagePathFor(organizationId: string, ventureId: string, assetId: string, mime: string | null): string {
  return `${organizationId}/content-media/${ventureId}/${assetId}${inferExtension(mime)}`;
}

// ---- Create pending upload row (client uploads directly to storage) --------

export const createMediaUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    organizationId: uuid,
    ventureId: uuid,
    campaignId: uuid.optional().nullable(),
    mediaType: MediaTypeEnum,
    source: SourceEnum.optional().default("upload"),
    mimeType: z.string().min(1).max(120).nullable().optional(),
    originalFilename: z.string().min(1).max(500).nullable().optional(),
    fileSizeBytes: z.number().int().min(0).max(MEDIA_UPLOAD_LIMITS.maxBytes).nullable().optional(),
    displayName: z.string().min(1).max(300).nullable().optional(),
    creativeBrief: z.string().max(4000).nullable().optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId, "member");

    // Insert a pending row and derive its storage path from the assigned id.
    const { data: row, error } = await context.supabase
      .from("content_media_assets")
      .insert({
        organization_id: data.organizationId,
        venture_id: data.ventureId,
        campaign_id: data.campaignId ?? null,
        media_type: data.mediaType,
        source: data.source,
        status: data.source === "placeholder" ? "uploaded" : "pending",
        storage_bucket: MEDIA_BUCKET,
        storage_path: null,           // filled after we know the id
        mime_type: data.mimeType ?? null,
        original_filename: data.originalFilename ?? null,
        file_size_bytes: data.fileSizeBytes ?? null,
        display_name: data.displayName ?? data.originalFilename ?? null,
        creative_brief: data.creativeBrief ?? null,
        upload_started_at: data.source === "upload" ? new Date().toISOString() : null,
        uploaded_by: context.userId,
      })
      .select()
      .single();
    if (error || !row) throw new ContentOpsError("unknown", error?.message ?? "insert failed");

    const path = storagePathFor(data.organizationId, data.ventureId, row.id, data.mimeType ?? null);
    const { error: uErr } = await context.supabase
      .from("content_media_assets")
      .update({ storage_path: path })
      .eq("id", row.id);
    if (uErr) throw new ContentOpsError("unknown", uErr.message);

    const { recordMediaAudit } = await import("./media-audit.server");
    await recordMediaAudit({
      organizationId: data.organizationId, ventureId: data.ventureId, mediaAssetId: row.id,
      action: "upload_started", actorUserId: context.userId,
      newState: { mediaType: data.mediaType, source: data.source, mimeType: data.mimeType ?? null },
    });

    return {
      assetId: row.id,
      bucket: MEDIA_BUCKET,
      storagePath: path,
      source: data.source,
    };
  });

// ---- Finalize (mark uploaded after client PUT succeeds) --------------------

export const finalizeMediaUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    organizationId: uuid,
    assetId: uuid,
    mimeType: z.string().min(1).max(120).optional(),
    fileSizeBytes: z.number().int().min(0).max(MEDIA_UPLOAD_LIMITS.maxBytes).optional(),
    widthPx: z.number().int().min(1).max(20000).optional(),
    heightPx: z.number().int().min(1).max(20000).optional(),
    durationSeconds: z.number().min(0).max(24 * 60 * 60).optional(),
    checksumSha256: z.string().length(64).regex(/^[a-f0-9]+$/).optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: existing, error: eErr } = await context.supabase
      .from("content_media_assets")
      .select("id, organization_id, venture_id, storage_path, status, width_px, height_px, mime_type, file_size_bytes")
      .eq("id", data.assetId)
      .eq("organization_id", data.organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (eErr) throw new ContentOpsError("unknown", eErr.message);
    if (!existing) throw new ContentOpsError("not_found", "media asset not found");
    await requireMembership(context.supabase, context.userId, existing.organization_id, existing.venture_id, "member");
    if (!existing.storage_path) throw new ContentOpsError("invalid_transition", "asset has no storage path");

    const aspect = data.widthPx && data.heightPx ? computeAspectLabel(data.widthPx, data.heightPx) : null;

    const patch: Record<string, unknown> = {
      status: "uploaded",
      uploaded_at: new Date().toISOString(),
      upload_error: null,
    };
    if (data.mimeType) patch.mime_type = data.mimeType;
    if (data.fileSizeBytes != null) patch.file_size_bytes = data.fileSizeBytes;
    if (data.widthPx != null) patch.width_px = data.widthPx;
    if (data.heightPx != null) patch.height_px = data.heightPx;
    if (data.durationSeconds != null) patch.duration_seconds = data.durationSeconds;
    if (aspect) patch.aspect_ratio = aspect;
    if (data.checksumSha256) patch.checksum_sha256 = data.checksumSha256;

    const { data: updated, error: uErr } = await context.supabase
      .from("content_media_assets")
      .update(patch as never)
      .eq("id", data.assetId)
      .select()
      .single();
    if (uErr) throw new ContentOpsError("unknown", uErr.message);

    const { recordMediaAudit } = await import("./media-audit.server");
    await recordMediaAudit({
      organizationId: existing.organization_id, ventureId: existing.venture_id, mediaAssetId: data.assetId,
      action: "upload_completed", actorUserId: context.userId,
      previousState: { status: existing.status },
      newState: { status: "uploaded", mimeType: data.mimeType ?? existing.mime_type, fileSizeBytes: data.fileSizeBytes ?? existing.file_size_bytes, widthPx: data.widthPx ?? existing.width_px, heightPx: data.heightPx ?? existing.height_px },
    });
    return updated;
  });

function computeAspectLabel(w: number, h: number): string {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const g = gcd(w, h);
  return `${w / g}:${h / g}`;
}

// ---- Mark failure ----------------------------------------------------------

export const markMediaUploadFailed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    organizationId: uuid,
    assetId: uuid,
    errorMessage: z.string().min(1).max(1000),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase
      .from("content_media_assets")
      .select("organization_id, venture_id, status")
      .eq("id", data.assetId)
      .eq("organization_id", data.organizationId)
      .maybeSingle();
    if (!existing) throw new ContentOpsError("not_found", "asset not found");
    await requireMembership(context.supabase, context.userId, existing.organization_id, existing.venture_id, "member");

    const { error } = await context.supabase
      .from("content_media_assets")
      .update({ status: "failed", upload_error: data.errorMessage })
      .eq("id", data.assetId);
    if (error) throw new ContentOpsError("unknown", error.message);

    const { recordMediaAudit } = await import("./media-audit.server");
    await recordMediaAudit({
      organizationId: existing.organization_id, ventureId: existing.venture_id, mediaAssetId: data.assetId,
      action: "upload_failed", actorUserId: context.userId,
      previousState: { status: existing.status }, newState: { status: "failed" }, detail: { error: data.errorMessage },
    });
    return { ok: true as const };
  });

// ---- Library listing -------------------------------------------------------

const LibraryFilterSchema = z.object({
  organizationId: uuid,
  ventureId: uuid,
  mediaType: MediaTypeEnum.optional(),
  campaignId: uuid.optional().nullable(),
  archived: z.boolean().optional(),
  status: z.enum(["pending","uploaded","failed"]).optional(),
  reviewState: z.enum(["draft","approved","rejected"]).optional(),
  search: z.string().max(200).optional(),
  unusedOnly: z.boolean().optional(),
  sort: z.enum(["recent","oldest","name","size","usage"]).optional().default("recent"),
  limit: z.number().int().min(1).max(200).optional().default(60),
  offset: z.number().int().min(0).max(10000).optional().default(0),
});

export const listVentureMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => LibraryFilterSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId, "member");
    let q = context.supabase
      .from("content_media_assets")
      .select("*", { count: "exact" })
      .eq("organization_id", data.organizationId)
      .eq("venture_id", data.ventureId)
      .is("deleted_at", null);
    if (data.mediaType) q = q.eq("media_type", data.mediaType);
    if (data.campaignId !== undefined) {
      if (data.campaignId === null) q = q.is("campaign_id", null);
      else q = q.eq("campaign_id", data.campaignId);
    }
    if (data.archived !== undefined) q = q.eq("archived", data.archived);
    if (data.status) q = q.eq("status", data.status);
    if (data.reviewState) q = q.eq("review_state", data.reviewState);
    if (data.search) q = q.or(`display_name.ilike.%${data.search}%,original_filename.ilike.%${data.search}%,caption.ilike.%${data.search}%,alt_text.ilike.%${data.search}%`);
    switch (data.sort) {
      case "oldest": q = q.order("created_at", { ascending: true }); break;
      case "name":   q = q.order("display_name", { ascending: true, nullsFirst: true }); break;
      case "size":   q = q.order("file_size_bytes", { ascending: false, nullsFirst: false }); break;
      case "usage":  q = q.order("last_used_at", { ascending: false, nullsFirst: false }); break;
      case "recent":
      default: q = q.order("created_at", { ascending: false });
    }
    q = q.range(data.offset, data.offset + data.limit - 1);
    const { data: rows, error, count } = await q;
    if (error) throw new ContentOpsError("unknown", error.message);

    let filtered = rows ?? [];
    if (data.unusedOnly && filtered.length > 0) {
      const ids = filtered.map(r => r.id);
      const { data: attCounts } = await context.supabase
        .from("content_media_attachments")
        .select("media_asset_id")
        .in("media_asset_id", ids);
      const used = new Set((attCounts ?? []).map(a => a.media_asset_id));
      filtered = filtered.filter(r => !used.has(r.id));
    }
    return { rows: filtered, total: count ?? filtered.length };
  });

// ---- Attachments -----------------------------------------------------------

export const listAttachmentsForVariant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    organizationId: uuid,
    contentVersionId: uuid,
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: attRows, error } = await context.supabase
      .from("content_media_attachments")
      .select("*, content_media_assets!inner(*)")
      .eq("organization_id", data.organizationId)
      .eq("content_version_id", data.contentVersionId)
      .order("display_order", { ascending: true });
    if (error) throw new ContentOpsError("unknown", error.message);
    return attRows ?? [];
  });

export const attachMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    organizationId: uuid,
    ventureId: uuid,
    contentItemId: uuid,
    contentVersionId: uuid,
    mediaAssetId: uuid,
    role: AttachmentRoleEnum.optional().default("primary"),
    displayOrder: z.number().int().min(0).max(1000).optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId, "member");

    const { count } = await context.supabase
      .from("content_media_attachments")
      .select("id", { count: "exact", head: true })
      .eq("content_version_id", data.contentVersionId);
    if ((count ?? 0) >= MEDIA_UPLOAD_LIMITS.maxAttachmentsPerVariant) {
      throw new ContentOpsError("over_limit", `Max ${MEDIA_UPLOAD_LIMITS.maxAttachmentsPerVariant} attachments per variant.`);
    }
    const order = data.displayOrder ?? (count ?? 0);

    const { data: row, error } = await context.supabase
      .from("content_media_attachments")
      .insert({
        organization_id: data.organizationId,
        venture_id: data.ventureId,
        content_item_id: data.contentItemId,
        content_version_id: data.contentVersionId,
        media_asset_id: data.mediaAssetId,
        role: data.role,
        display_order: order,
        created_by: context.userId,
      })
      .select()
      .single();
    if (error) {
      if ((error as { code?: string }).code === "23505") throw new ContentOpsError("duplicate", "This asset is already attached in that role.");
      throw new ContentOpsError("unknown", error.message);
    }

    await context.supabase
      .from("content_media_assets")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", data.mediaAssetId);

    const { recordMediaAudit } = await import("./media-audit.server");
    await recordMediaAudit({
      organizationId: data.organizationId, ventureId: data.ventureId,
      mediaAssetId: data.mediaAssetId, contentVersionId: data.contentVersionId, contentItemId: data.contentItemId,
      action: "attach", actorUserId: context.userId, newState: { role: data.role, displayOrder: order },
    });
    return row;
  });

export const detachMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    organizationId: uuid,
    attachmentId: uuid,
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: att } = await context.supabase
      .from("content_media_attachments")
      .select("*")
      .eq("id", data.attachmentId)
      .eq("organization_id", data.organizationId)
      .maybeSingle();
    if (!att) throw new ContentOpsError("not_found", "attachment not found");
    await requireMembership(context.supabase, context.userId, att.organization_id, att.venture_id, "member");

    const { error } = await context.supabase
      .from("content_media_attachments")
      .delete()
      .eq("id", data.attachmentId);
    if (error) throw new ContentOpsError("unknown", error.message);

    const { recordMediaAudit } = await import("./media-audit.server");
    await recordMediaAudit({
      organizationId: att.organization_id, ventureId: att.venture_id,
      mediaAssetId: att.media_asset_id, contentVersionId: att.content_version_id, contentItemId: att.content_item_id,
      action: "detach", actorUserId: context.userId, previousState: { role: att.role, displayOrder: att.display_order },
    });
    return { ok: true as const };
  });

export const reorderMediaAttachments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    organizationId: uuid,
    contentVersionId: uuid,
    orderedAttachmentIds: z.array(uuid).min(1).max(MEDIA_UPLOAD_LIMITS.maxAttachmentsPerVariant),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase
      .from("content_media_attachments")
      .select("id, organization_id, venture_id")
      .eq("organization_id", data.organizationId)
      .eq("content_version_id", data.contentVersionId);
    if (!existing || existing.length === 0) throw new ContentOpsError("not_found", "no attachments");
    const { organization_id, venture_id } = existing[0];
    await requireMembership(context.supabase, context.userId, organization_id, venture_id, "member");

    const validIds = new Set(existing.map(r => r.id));
    for (const id of data.orderedAttachmentIds) {
      if (!validIds.has(id)) throw new ContentOpsError("invalid_input", "unknown attachment id in order");
    }

    for (let i = 0; i < data.orderedAttachmentIds.length; i++) {
      const { error } = await context.supabase
        .from("content_media_attachments")
        .update({ display_order: i })
        .eq("id", data.orderedAttachmentIds[i]);
      if (error) throw new ContentOpsError("unknown", error.message);
    }
    const { recordMediaAudit } = await import("./media-audit.server");
    await recordMediaAudit({
      organizationId: organization_id, ventureId: venture_id,
      contentVersionId: data.contentVersionId,
      action: "reorder", actorUserId: context.userId,
      newState: { order: data.orderedAttachmentIds },
    });
    return { ok: true as const };
  });

// ---- Asset metadata --------------------------------------------------------

export const updateMediaMetadata = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    organizationId: uuid,
    assetId: uuid,
    altText: z.string().max(CONTENT_OPS_LIMITS.maxAltTextBytes).nullable().optional(),
    caption: z.string().max(2000).nullable().optional(),
    credit: z.string().max(300).nullable().optional(),
    creativeNotes: z.string().max(4000).nullable().optional(),
    creativeBrief: z.string().max(4000).nullable().optional(),
    displayName: z.string().max(300).nullable().optional(),
    tags: z.array(z.string().min(1).max(60)).max(30).optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase
      .from("content_media_assets")
      .select("id, organization_id, venture_id, alt_text, caption")
      .eq("id", data.assetId)
      .eq("organization_id", data.organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!existing) throw new ContentOpsError("not_found", "asset not found");
    await requireMembership(context.supabase, context.userId, existing.organization_id, existing.venture_id, "member");

    const patch: Record<string, unknown> = {};
    if (data.altText !== undefined) patch.alt_text = data.altText;
    if (data.caption !== undefined) patch.caption = data.caption;
    if (data.credit !== undefined) patch.credit = data.credit;
    if (data.creativeNotes !== undefined) patch.creative_notes = data.creativeNotes;
    if (data.creativeBrief !== undefined) patch.creative_brief = data.creativeBrief;
    if (data.displayName !== undefined) patch.display_name = data.displayName;
    if (data.tags !== undefined) patch.tags = data.tags;

    const { data: updated, error } = await context.supabase
      .from("content_media_assets")
      .update(patch as never)
      .eq("id", data.assetId)
      .select()
      .single();
    if (error) throw new ContentOpsError("unknown", error.message);

    const { recordMediaAudit } = await import("./media-audit.server");
    await recordMediaAudit({
      organizationId: existing.organization_id, ventureId: existing.venture_id, mediaAssetId: data.assetId,
      action: "metadata_updated", actorUserId: context.userId,
      previousState: { altText: existing.alt_text, caption: existing.caption },
      newState: patch as Record<string, unknown>,
    });
    return updated;
  });

// ---- Archive / restore / delete --------------------------------------------

export const archiveMediaAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ organizationId: uuid, assetId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase
      .from("content_media_assets")
      .select("id, organization_id, venture_id, archived")
      .eq("id", data.assetId).eq("organization_id", data.organizationId).is("deleted_at", null).maybeSingle();
    if (!existing) throw new ContentOpsError("not_found", "asset not found");
    await requireMembership(context.supabase, context.userId, existing.organization_id, existing.venture_id, "member");

    const { error } = await context.supabase
      .from("content_media_assets").update({ archived: true }).eq("id", data.assetId);
    if (error) throw new ContentOpsError("unknown", error.message);
    const { recordMediaAudit } = await import("./media-audit.server");
    await recordMediaAudit({
      organizationId: existing.organization_id, ventureId: existing.venture_id, mediaAssetId: data.assetId,
      action: "archive", actorUserId: context.userId,
      previousState: { archived: existing.archived }, newState: { archived: true },
    });
    return { ok: true as const };
  });

export const restoreMediaAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ organizationId: uuid, assetId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase
      .from("content_media_assets")
      .select("id, organization_id, venture_id, archived")
      .eq("id", data.assetId).eq("organization_id", data.organizationId).is("deleted_at", null).maybeSingle();
    if (!existing) throw new ContentOpsError("not_found", "asset not found");
    await requireMembership(context.supabase, context.userId, existing.organization_id, existing.venture_id, "member");

    const { error } = await context.supabase
      .from("content_media_assets").update({ archived: false }).eq("id", data.assetId);
    if (error) throw new ContentOpsError("unknown", error.message);
    const { recordMediaAudit } = await import("./media-audit.server");
    await recordMediaAudit({
      organizationId: existing.organization_id, ventureId: existing.venture_id, mediaAssetId: data.assetId,
      action: "restore", actorUserId: context.userId,
      previousState: { archived: existing.archived }, newState: { archived: false },
    });
    return { ok: true as const };
  });

export const deleteMediaAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ organizationId: uuid, assetId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase
      .from("content_media_assets")
      .select("id, organization_id, venture_id, storage_bucket, storage_path")
      .eq("id", data.assetId).eq("organization_id", data.organizationId).is("deleted_at", null).maybeSingle();
    if (!existing) throw new ContentOpsError("not_found", "asset not found");
    await requireMembership(context.supabase, context.userId, existing.organization_id, existing.venture_id, "admin");

    // Soft delete: mark deleted_at, leave storage object; a later janitor
    // job will purge orphaned storage after a retention window. This keeps
    // publication_history joins meaningful.
    const { error } = await context.supabase
      .from("content_media_assets")
      .update({ deleted_at: new Date().toISOString(), archived: true })
      .eq("id", data.assetId);
    if (error) throw new ContentOpsError("unknown", error.message);
    const { recordMediaAudit } = await import("./media-audit.server");
    await recordMediaAudit({
      organizationId: existing.organization_id, ventureId: existing.venture_id, mediaAssetId: data.assetId,
      action: "delete", actorUserId: context.userId,
      detail: { storagePath: existing.storage_path, retention: "soft" },
    });
    return { ok: true as const };
  });

// ---- Approval state --------------------------------------------------------

export const setMediaReviewState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    organizationId: uuid,
    assetId: uuid,
    reviewState: z.enum(["draft","approved","rejected"]),
    comment: z.string().max(2000).nullable().optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase
      .from("content_media_assets")
      .select("id, organization_id, venture_id, review_state")
      .eq("id", data.assetId).eq("organization_id", data.organizationId).is("deleted_at", null).maybeSingle();
    if (!existing) throw new ContentOpsError("not_found", "asset not found");
    await requireMembership(context.supabase, context.userId, existing.organization_id, existing.venture_id, "member");

    const patch: Record<string, unknown> = { review_state: data.reviewState };
    if (data.reviewState === "approved") {
      patch.approved_by = context.userId;
      patch.approved_at = new Date().toISOString();
    } else {
      patch.approved_by = null;
      patch.approved_at = null;
    }
    const { error } = await context.supabase
      .from("content_media_assets").update(patch as never).eq("id", data.assetId);
    if (error) throw new ContentOpsError("unknown", error.message);

    const { recordMediaAudit } = await import("./media-audit.server");
    await recordMediaAudit({
      organizationId: existing.organization_id, ventureId: existing.venture_id, mediaAssetId: data.assetId,
      action: data.reviewState === "approved" ? "approve" : data.reviewState === "rejected" ? "reject" : "revision",
      actorUserId: context.userId,
      previousState: { reviewState: existing.review_state },
      newState: { reviewState: data.reviewState },
      detail: data.comment ? { comment: data.comment } : null,
    });
    return { ok: true as const };
  });

// ---- Usage / publication history ------------------------------------------

export const getMediaUsageHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ organizationId: uuid, assetId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase
      .from("content_media_assets")
      .select("organization_id, venture_id")
      .eq("id", data.assetId).eq("organization_id", data.organizationId).maybeSingle();
    if (!existing) throw new ContentOpsError("not_found", "asset not found");
    await requireMembership(context.supabase, context.userId, existing.organization_id, existing.venture_id, "member");

    const [{ data: attachments }, { data: audit }] = await Promise.all([
      context.supabase
        .from("content_media_attachments")
        .select("*, social_content_items!inner(id, platform, status, external_post_id, published_at, campaign_id)")
        .eq("media_asset_id", data.assetId)
        .eq("organization_id", data.organizationId),
      context.supabase
        .from("content_media_audit")
        .select("*")
        .eq("media_asset_id", data.assetId)
        .eq("organization_id", data.organizationId)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    return { attachments: attachments ?? [], audit: audit ?? [] };
  });

// ---- Signed download URL (for library previews) ---------------------------

export const createMediaPreviewUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ organizationId: uuid, assetId: uuid, expiresInSeconds: z.number().int().min(30).max(3600).optional().default(600) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase
      .from("content_media_assets")
      .select("organization_id, venture_id, storage_bucket, storage_path, status")
      .eq("id", data.assetId).eq("organization_id", data.organizationId).is("deleted_at", null).maybeSingle();
    if (!existing) throw new ContentOpsError("not_found", "asset not found");
    await requireMembership(context.supabase, context.userId, existing.organization_id, existing.venture_id, "member");
    if (existing.status !== "uploaded" || !existing.storage_path) {
      throw new ContentOpsError("invalid_transition", "asset is not uploaded");
    }
    const { data: signed, error } = await context.supabase.storage
      .from(existing.storage_bucket)
      .createSignedUrl(existing.storage_path, data.expiresInSeconds);
    if (error || !signed) throw new ContentOpsError("unknown", error?.message ?? "sign failed");
    return { url: signed.signedUrl, expiresIn: data.expiresInSeconds };
  });