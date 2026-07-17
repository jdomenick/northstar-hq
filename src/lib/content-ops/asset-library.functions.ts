// Files & Assets Foundation - server functions.
//
// Universal asset organization: folders, favorites, collections, tag/rename/
// move/copy/archive/delete on top of content_media_assets. RLS enforces
// org-membership; every handler additionally calls requireMembership so
// venture-scoped operations verify the venture belongs to the org.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireMembership } from "./membership.server";
import { ContentOpsError } from "./errors";
import {
  ASSET_LIBRARY_LIMITS,
  buildFolderTree,
  canMoveFolder,
  normalizeTags,
  validateFolderName,
  type FolderNodeInput,
} from "./asset-library";
import { recordMediaAudit } from "./media-audit.server";

const uuid = z.string().uuid();
const ScopeEnum = z.enum(["organization", "venture"]);

// ---------------------------------------------------------------------------
// FOLDERS
// ---------------------------------------------------------------------------

export const listAssetFolders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    organizationId: uuid,
    ventureId: uuid.nullable().optional(),
    includeArchived: z.boolean().optional().default(false),
  }).parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId ?? null, "viewer");
    let q = context.supabase
      .from("asset_folders")
      .select("id, parent_folder_id, scope, venture_id, name, description, notes, color, icon, sort_order, archived, owner_user_id, created_at, updated_at")
      .eq("organization_id", data.organizationId)
      .is("deleted_at", null);
    if (data.ventureId) q = q.eq("venture_id", data.ventureId);
    else q = q.is("venture_id", null);
    if (!data.includeArchived) q = q.eq("archived", false);
    const { data: rows, error } = await q.order("sort_order", { ascending: true });
    if (error) throw new ContentOpsError("server_error", error.message);
    const nodes: FolderNodeInput[] = (rows ?? []).map((r) => ({
      id: r.id, parent_folder_id: r.parent_folder_id, name: r.name,
      archived: r.archived, sort_order: r.sort_order,
    }));
    return { folders: rows ?? [], tree: buildFolderTree(nodes) };
  });

export const createAssetFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    organizationId: uuid,
    ventureId: uuid.nullable().optional(),
    parentFolderId: uuid.nullable().optional(),
    name: z.string().min(1).max(ASSET_LIBRARY_LIMITS.maxNameLength),
    scope: ScopeEnum.optional(),
    description: z.string().max(1000).nullable().optional(),
    notes: z.string().max(4000).nullable().optional(),
    color: z.string().max(24).nullable().optional(),
    icon: z.string().max(48).nullable().optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const scope = data.scope ?? (data.ventureId ? "venture" : "organization");
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId ?? null, "member");
    const name = validateFolderName(data.name);
    const { data: row, error } = await context.supabase
      .from("asset_folders")
      .insert({
        organization_id: data.organizationId,
        venture_id: data.ventureId ?? null,
        parent_folder_id: data.parentFolderId ?? null,
        scope,
        name,
        description: data.description ?? null,
        notes: data.notes ?? null,
        color: data.color ?? null,
        icon: data.icon ?? null,
        owner_user_id: context.userId,
        created_by: context.userId,
      })
      .select("id, parent_folder_id, name")
      .single();
    if (error) throw new ContentOpsError("server_error", error.message);
    await recordMediaAudit({
      organizationId: data.organizationId, ventureId: data.ventureId ?? null,
      actorUserId: context.userId, action: "folder_created",
      detail: { folderId: row.id, name, parentFolderId: row.parent_folder_id },
    });
    return row;
  });

export const renameAssetFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    organizationId: uuid, folderId: uuid,
    name: z.string().min(1).max(ASSET_LIBRARY_LIMITS.maxNameLength),
  }).parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, null, "member");
    const name = validateFolderName(data.name);
    const { data: prev } = await context.supabase.from("asset_folders")
      .select("name, venture_id").eq("id", data.folderId).eq("organization_id", data.organizationId).maybeSingle();
    if (!prev) throw new ContentOpsError("not_found", "folder not found");
    const { error } = await context.supabase.from("asset_folders")
      .update({ name }).eq("id", data.folderId).eq("organization_id", data.organizationId);
    if (error) throw new ContentOpsError("server_error", error.message);
    await recordMediaAudit({
      organizationId: data.organizationId, ventureId: prev.venture_id, actorUserId: context.userId,
      action: "folder_renamed", previousState: { name: prev.name }, newState: { name },
      detail: { folderId: data.folderId },
    });
    return { ok: true };
  });

export const moveAssetFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    organizationId: uuid, folderId: uuid,
    targetParentId: uuid.nullable(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, null, "member");
    const { data: siblings, error } = await context.supabase
      .from("asset_folders")
      .select("id, parent_folder_id, name, archived, sort_order, venture_id")
      .eq("organization_id", data.organizationId).is("deleted_at", null);
    if (error) throw new ContentOpsError("server_error", error.message);
    const guard = canMoveFolder(siblings ?? [], data.folderId, data.targetParentId);
    if (!guard.ok) throw new ContentOpsError("invalid_input", guard.reason ?? "invalid move");
    const current = (siblings ?? []).find((s) => s.id === data.folderId);
    if (!current) throw new ContentOpsError("not_found", "folder not found");
    if (data.targetParentId) {
      const target = (siblings ?? []).find((s) => s.id === data.targetParentId);
      if (!target) throw new ContentOpsError("not_found", "target parent not found");
      if (target.venture_id !== current.venture_id) {
        throw new ContentOpsError("invalid_input", "target parent has different venture scope");
      }
    }
    const { error: upErr } = await context.supabase.from("asset_folders")
      .update({ parent_folder_id: data.targetParentId }).eq("id", data.folderId)
      .eq("organization_id", data.organizationId);
    if (upErr) throw new ContentOpsError("server_error", upErr.message);
    await recordMediaAudit({
      organizationId: data.organizationId, ventureId: current.venture_id, actorUserId: context.userId,
      action: "folder_moved",
      previousState: { parentFolderId: current.parent_folder_id },
      newState: { parentFolderId: data.targetParentId },
      detail: { folderId: data.folderId },
    });
    return { ok: true };
  });

export const archiveAssetFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    organizationId: uuid, folderId: uuid, archived: z.boolean(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, null, "member");
    const { data: prev } = await context.supabase.from("asset_folders")
      .select("venture_id, archived").eq("id", data.folderId)
      .eq("organization_id", data.organizationId).maybeSingle();
    if (!prev) throw new ContentOpsError("not_found", "folder not found");
    const { error } = await context.supabase.from("asset_folders")
      .update({ archived: data.archived }).eq("id", data.folderId)
      .eq("organization_id", data.organizationId);
    if (error) throw new ContentOpsError("server_error", error.message);
    await recordMediaAudit({
      organizationId: data.organizationId, ventureId: prev.venture_id, actorUserId: context.userId,
      action: data.archived ? "folder_archived" : "folder_restored",
      detail: { folderId: data.folderId },
    });
    return { ok: true };
  });

export const deleteAssetFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    organizationId: uuid, folderId: uuid,
  }).parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, null, "executive");
    const { data: prev } = await context.supabase.from("asset_folders")
      .select("venture_id").eq("id", data.folderId)
      .eq("organization_id", data.organizationId).maybeSingle();
    if (!prev) throw new ContentOpsError("not_found", "folder not found");
    // Soft delete; RLS-visible operations detach child folders/assets on ON DELETE SET NULL.
    const { error } = await context.supabase.from("asset_folders")
      .update({ deleted_at: new Date().toISOString(), archived: true })
      .eq("id", data.folderId).eq("organization_id", data.organizationId);
    if (error) throw new ContentOpsError("server_error", error.message);
    await recordMediaAudit({
      organizationId: data.organizationId, ventureId: prev.venture_id, actorUserId: context.userId,
      action: "folder_deleted", detail: { folderId: data.folderId },
    });
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// ASSET OPERATIONS (rename, move, tag, archive, delete, bulk)
// ---------------------------------------------------------------------------

const AssetIds = z.array(uuid).min(1).max(ASSET_LIBRARY_LIMITS.bulkActionMax);

export const renameMediaAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    organizationId: uuid, mediaAssetId: uuid,
    displayName: z.string().min(1).max(300),
  }).parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, null, "member");
    const { data: prev } = await context.supabase.from("content_media_assets")
      .select("display_name, venture_id").eq("id", data.mediaAssetId)
      .eq("organization_id", data.organizationId).maybeSingle();
    if (!prev) throw new ContentOpsError("not_found", "asset not found");
    const { error } = await context.supabase.from("content_media_assets")
      .update({ display_name: data.displayName.trim() })
      .eq("id", data.mediaAssetId).eq("organization_id", data.organizationId);
    if (error) throw new ContentOpsError("server_error", error.message);
    await recordMediaAudit({
      organizationId: data.organizationId, ventureId: prev.venture_id, mediaAssetId: data.mediaAssetId,
      actorUserId: context.userId, action: "rename",
      previousState: { display_name: prev.display_name }, newState: { display_name: data.displayName.trim() },
    });
    return { ok: true };
  });

export const moveMediaAssets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    organizationId: uuid, mediaAssetIds: AssetIds,
    targetFolderId: uuid.nullable(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, null, "member");
    if (data.targetFolderId) {
      const { data: folder } = await context.supabase.from("asset_folders")
        .select("id, venture_id").eq("id", data.targetFolderId)
        .eq("organization_id", data.organizationId).is("deleted_at", null).maybeSingle();
      if (!folder) throw new ContentOpsError("not_found", "target folder not found");
    }
    const { error } = await context.supabase.from("content_media_assets")
      .update({ folder_id: data.targetFolderId })
      .in("id", data.mediaAssetIds).eq("organization_id", data.organizationId);
    if (error) throw new ContentOpsError("server_error", error.message);
    await recordMediaAudit({
      organizationId: data.organizationId, actorUserId: context.userId,
      action: data.mediaAssetIds.length > 1 ? "bulk_move" : "move",
      detail: { count: data.mediaAssetIds.length, targetFolderId: data.targetFolderId },
    });
    return { ok: true, count: data.mediaAssetIds.length };
  });

export const setMediaAssetTags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    organizationId: uuid, mediaAssetId: uuid,
    tags: z.array(z.string().max(80)).max(64),
  }).parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, null, "member");
    const clean = normalizeTags(data.tags);
    const { data: prev } = await context.supabase.from("content_media_assets")
      .select("tags, venture_id").eq("id", data.mediaAssetId)
      .eq("organization_id", data.organizationId).maybeSingle();
    if (!prev) throw new ContentOpsError("not_found", "asset not found");
    const { error } = await context.supabase.from("content_media_assets")
      .update({ tags: clean }).eq("id", data.mediaAssetId)
      .eq("organization_id", data.organizationId);
    if (error) throw new ContentOpsError("server_error", error.message);
    await recordMediaAudit({
      organizationId: data.organizationId, ventureId: prev.venture_id, mediaAssetId: data.mediaAssetId,
      actorUserId: context.userId, action: "tag_added",
      previousState: { tags: prev.tags }, newState: { tags: clean },
    });
    return { tags: clean };
  });

export const archiveMediaAssets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    organizationId: uuid, mediaAssetIds: AssetIds, archived: z.boolean(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, null, "member");
    const { error } = await context.supabase.from("content_media_assets")
      .update({ archived: data.archived })
      .in("id", data.mediaAssetIds).eq("organization_id", data.organizationId);
    if (error) throw new ContentOpsError("server_error", error.message);
    await recordMediaAudit({
      organizationId: data.organizationId, actorUserId: context.userId,
      action: data.mediaAssetIds.length > 1
        ? "bulk_archive"
        : (data.archived ? "archive" : "restore"),
      detail: { count: data.mediaAssetIds.length, archived: data.archived },
    });
    return { ok: true, count: data.mediaAssetIds.length };
  });

export const deleteMediaAssets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    organizationId: uuid, mediaAssetIds: AssetIds,
  }).parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, null, "executive");
    const { error } = await context.supabase.from("content_media_assets")
      .update({ deleted_at: new Date().toISOString(), archived: true })
      .in("id", data.mediaAssetIds).eq("organization_id", data.organizationId);
    if (error) throw new ContentOpsError("server_error", error.message);
    await recordMediaAudit({
      organizationId: data.organizationId, actorUserId: context.userId,
      action: data.mediaAssetIds.length > 1 ? "bulk_delete" : "delete",
      detail: { count: data.mediaAssetIds.length },
    });
    return { ok: true, count: data.mediaAssetIds.length };
  });

// ---------------------------------------------------------------------------
// FAVORITES (per-user)
// ---------------------------------------------------------------------------

export const listAssetFavorites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ organizationId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, null, "viewer");
    const { data: rows, error } = await context.supabase.from("asset_favorites")
      .select("media_asset_id, created_at")
      .eq("organization_id", data.organizationId).eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new ContentOpsError("server_error", error.message);
    return { favorites: rows ?? [] };
  });

export const setAssetFavorite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    organizationId: uuid, mediaAssetId: uuid, favorite: z.boolean(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, null, "viewer");
    if (data.favorite) {
      const { error } = await context.supabase.from("asset_favorites").insert({
        organization_id: data.organizationId,
        media_asset_id: data.mediaAssetId,
        user_id: context.userId,
      });
      // Unique violation on re-favorite is a no-op.
      if (error && !/duplicate key|unique/i.test(error.message)) {
        throw new ContentOpsError("server_error", error.message);
      }
    } else {
      const { error } = await context.supabase.from("asset_favorites")
        .delete().eq("user_id", context.userId).eq("media_asset_id", data.mediaAssetId);
      if (error) throw new ContentOpsError("server_error", error.message);
    }
    await recordMediaAudit({
      organizationId: data.organizationId, mediaAssetId: data.mediaAssetId,
      actorUserId: context.userId, action: data.favorite ? "favorite" : "unfavorite",
    });
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// COLLECTIONS
// ---------------------------------------------------------------------------

export const listAssetCollections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    organizationId: uuid,
    ventureId: uuid.nullable().optional(),
    includeArchived: z.boolean().optional().default(false),
  }).parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId ?? null, "viewer");
    let q = context.supabase.from("asset_collections")
      .select("id, name, description, notes, color, scope, venture_id, archived, created_at, updated_at")
      .eq("organization_id", data.organizationId).is("deleted_at", null);
    if (data.ventureId) q = q.eq("venture_id", data.ventureId);
    if (!data.includeArchived) q = q.eq("archived", false);
    const { data: rows, error } = await q.order("updated_at", { ascending: false });
    if (error) throw new ContentOpsError("server_error", error.message);
    return { collections: rows ?? [] };
  });

export const createAssetCollection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    organizationId: uuid, ventureId: uuid.nullable().optional(),
    name: z.string().min(1).max(ASSET_LIBRARY_LIMITS.maxNameLength),
    description: z.string().max(1000).nullable().optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const scope = data.ventureId ? "venture" : "organization";
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId ?? null, "member");
    const { data: row, error } = await context.supabase.from("asset_collections")
      .insert({
        organization_id: data.organizationId,
        venture_id: data.ventureId ?? null,
        scope, name: data.name.trim(),
        description: data.description ?? null,
        created_by: context.userId,
      })
      .select("id, name").single();
    if (error) throw new ContentOpsError("server_error", error.message);
    await recordMediaAudit({
      organizationId: data.organizationId, ventureId: data.ventureId ?? null,
      actorUserId: context.userId, action: "collection_created",
      detail: { collectionId: row.id, name: row.name },
    });
    return row;
  });

export const addAssetsToCollection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    organizationId: uuid, collectionId: uuid, mediaAssetIds: AssetIds,
  }).parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, null, "member");
    const rows = data.mediaAssetIds.map((id) => ({
      organization_id: data.organizationId,
      collection_id: data.collectionId,
      media_asset_id: id,
      added_by: context.userId,
    }));
    const { error } = await context.supabase.from("asset_collection_items")
      .upsert(rows, { onConflict: "collection_id,media_asset_id", ignoreDuplicates: true });
    if (error) throw new ContentOpsError("server_error", error.message);
    await recordMediaAudit({
      organizationId: data.organizationId, actorUserId: context.userId,
      action: "added_to_collection",
      detail: { collectionId: data.collectionId, count: rows.length },
    });
    return { ok: true, count: rows.length };
  });

// ---------------------------------------------------------------------------
// LIBRARY LISTING (unified search / filter)
// ---------------------------------------------------------------------------

export const listLibraryAssets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    organizationId: uuid,
    ventureId: uuid.nullable().optional(),
    folderId: uuid.nullable().optional(),
    collectionId: uuid.nullable().optional(),
    view: z.enum(["all", "recent", "favorites", "unused", "archived"]).optional().default("all"),
    query: z.string().max(200).optional(),
    mediaTypes: z.array(z.string().max(40)).max(12).optional(),
    tags: z.array(z.string().max(80)).max(24).optional(),
    campaignId: uuid.nullable().optional(),
    sort: z.enum(["recent", "oldest", "name", "size"]).optional().default("recent"),
    limit: z.number().int().min(1).max(200).optional().default(60),
    offset: z.number().int().min(0).max(10000).optional().default(0),
  }).parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId ?? null, "viewer");
    const sel = (s: string): string => s;
    let q = context.supabase.from("content_media_assets").select(sel(
      "id, organization_id, venture_id, campaign_id, folder_id, media_type, source, status, review_state, archived, display_name, original_filename, mime_type, file_size_bytes, width_px, height_px, aspect_ratio, duration_seconds, tags, storage_bucket, storage_path, alt_text, caption, created_at, updated_at, last_used_at"
    ), { count: "exact" }).eq("organization_id", data.organizationId).is("deleted_at", null);
    if (data.ventureId) q = q.eq("venture_id", data.ventureId);
    if (data.folderId) q = q.eq("folder_id", data.folderId);
    if (data.campaignId) q = q.eq("campaign_id", data.campaignId);
    if (data.mediaTypes && data.mediaTypes.length) q = q.in("media_type", data.mediaTypes);
    if (data.tags && data.tags.length) q = q.contains("tags", data.tags);

    switch (data.view) {
      case "archived": q = q.eq("archived", true); break;
      case "unused":   q = q.eq("archived", false).is("last_used_at", null); break;
      case "favorites": {
        const { data: fav } = await context.supabase.from("asset_favorites")
          .select("media_asset_id").eq("organization_id", data.organizationId).eq("user_id", context.userId);
        const ids = (fav ?? []).map((f) => f.media_asset_id);
        if (ids.length === 0) return { assets: [], total: 0 };
        q = q.in("id", ids).eq("archived", false);
        break;
      }
      default: q = q.eq("archived", false);
    }

    if (data.collectionId) {
      const { data: items } = await context.supabase.from("asset_collection_items")
        .select("media_asset_id").eq("collection_id", data.collectionId);
      const ids = (items ?? []).map((i) => i.media_asset_id);
      if (ids.length === 0) return { assets: [], total: 0 };
      q = q.in("id", ids);
    }

    if (data.query && data.query.trim()) {
      const like = `%${data.query.trim().replace(/[%_]/g, "\\$&")}%`;
      q = q.or(`display_name.ilike.${like},original_filename.ilike.${like},caption.ilike.${like},alt_text.ilike.${like}`);
    }

    switch (data.sort) {
      case "oldest": q = q.order("created_at", { ascending: true }); break;
      case "name":   q = q.order("display_name", { ascending: true, nullsFirst: false }); break;
      case "size":   q = q.order("file_size_bytes", { ascending: false, nullsFirst: false }); break;
      case "recent":
      default:       q = q.order("updated_at", { ascending: false });
    }

    q = q.range(data.offset, data.offset + data.limit - 1);
    const { data: rows, count, error } = await q;
    if (error) throw new ContentOpsError("server_error", error.message);
    return { assets: rows ?? [], total: count ?? (rows?.length ?? 0) };
  });