// Append-only audit writes for media pipeline actions.
// Callers must be trusted server code; RLS forbids member writes.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";

export type MediaAuditAction =
  | "upload_started" | "upload_completed" | "upload_failed"
  | "replace" | "delete" | "archive" | "restore"
  | "attach" | "detach" | "reorder"
  | "approve" | "reject" | "revision"
  | "publication_recorded" | "metadata_updated"
  | "rename" | "move" | "copy" | "duplicate"
  | "favorite" | "unfavorite" | "tag_added" | "tag_removed"
  | "folder_created" | "folder_renamed" | "folder_moved"
  | "folder_archived" | "folder_restored" | "folder_deleted"
  | "collection_created" | "collection_updated" | "collection_deleted"
  | "added_to_collection" | "removed_from_collection"
  | "bulk_move" | "bulk_archive" | "bulk_delete" | "bulk_tag";

export interface MediaAuditEntry {
  organizationId: string;
  ventureId?: string | null;
  mediaAssetId?: string | null;
  contentVersionId?: string | null;
  contentItemId?: string | null;
  action: MediaAuditAction;
  actorUserId?: string | null;
  previousState?: Record<string, unknown> | null;
  newState?: Record<string, unknown> | null;
  detail?: Record<string, unknown> | null;
}

export async function recordMediaAudit(entry: MediaAuditEntry): Promise<void> {
  const { error } = await supabaseAdmin
    .from("content_media_audit")
    .insert({
      organization_id: entry.organizationId,
      venture_id: entry.ventureId ?? null,
      media_asset_id: entry.mediaAssetId ?? null,
      content_version_id: entry.contentVersionId ?? null,
      content_item_id: entry.contentItemId ?? null,
      action: entry.action,
      actor_user_id: entry.actorUserId ?? null,
      previous_state: (entry.previousState ?? null) as Json,
      new_state: (entry.newState ?? null) as Json,
      detail: (entry.detail ?? null) as Json,
    });
  if (error) {
    // Audit failures are logged but never block the primary operation. This
    // matches the schedule-audit contract; the primary action already succeeded.
    console.error("[media-audit] insert failed", { action: entry.action, error: error.message });
  }
}