// Editorial workspace server functions: autosave, restore-to-version,
// duplicate, archive/unarchive, and evergreen-topic vocabulary CRUD.
// Every mutation goes through requireSupabaseAuth + requireMembership.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireMembership } from "./membership.server";
import { ContentOpsError } from "./errors";
import { CONTENT_OPS_POLICY_VERSION } from "./constants";
import { buildDuplicateFingerprint } from "@/lib/social/deduplication.server";

const uuid = z.string().uuid();
const orgVenture = { organizationId: uuid, ventureId: uuid };

// ---- Restore a variant to a prior version ---------------------------------

const RestoreInput = z.object({
  ...orgVenture,
  contentItemId: uuid,
  version: z.number().int().min(1),
  changeReason: z.string().max(500).optional(),
});

/**
 * Restore a variant to a previous version by cloning its snapshot into a new
 * version. Never mutates prior versions - the timeline stays append-only.
 * Approval on the target row is revoked because the copy has effectively
 * changed relative to whatever was last approved.
 */
export const restoreVariantVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RestoreInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId, "member");

    const { data: current, error: cErr } = await context.supabase
      .from("social_content_items")
      .select("id, organization_id, venture_id, approval_status, status, content_version, social_account_id, campaign_id, platform, brand_profile_version, metadata")
      .eq("id", data.contentItemId)
      .eq("organization_id", data.organizationId)
      .eq("venture_id", data.ventureId)
      .is("deleted_at", null)
      .maybeSingle();
    if (cErr) throw new ContentOpsError("unknown", cErr.message);
    if (!current) throw new ContentOpsError("not_found", "variant not found");
    if (current.status === "published" || current.status === "publishing") {
      throw new ContentOpsError("invalid_transition", "Cannot restore a variant that has already published.");
    }

    const { data: snap, error: sErr } = await context.supabase
      .from("social_content_versions")
      .select("*")
      .eq("organization_id", data.organizationId)
      .eq("content_item_id", data.contentItemId)
      .eq("version", data.version)
      .maybeSingle();
    if (sErr) throw new ContentOpsError("unknown", sErr.message);
    if (!snap) throw new ContentOpsError("not_found", "version snapshot not found");

    const nextVersion = current.content_version + 1;
    const wasApproved = current.approval_status === "approved";

    const fingerprint = buildDuplicateFingerprint({
      organizationId: data.organizationId,
      ventureId: data.ventureId,
      socialAccountId: current.social_account_id ?? null,
      campaignId: current.campaign_id ?? null,
      platform: current.platform,
      title: (snap.title as string | null) ?? null,
      body: snap.body as string,
      firstComment: (snap.first_comment as string | null) ?? null,
      hashtags: (snap.hashtags as string[] | null) ?? [],
      linkUrl: (snap.link_url as string | null) ?? null,
      mediaHashes: ((snap.media_requirements as Array<{ storageRef: string }> | null) ?? []).map((m) => m.storageRef),
    });

    const { error: uErr } = await context.supabase
      .from("social_content_items")
      .update({
        title: snap.title ?? null,
        body: snap.body,
        hook: snap.hook ?? null,
        cta: snap.cta ?? null,
        first_comment: snap.first_comment ?? null,
        hashtags: snap.hashtags ?? [],
        link_url: snap.link_url ?? null,
        alt_text: snap.alt_text ?? null,
        newsletter_subject: snap.newsletter_subject ?? null,
        newsletter_preview: snap.newsletter_preview ?? null,
        media_requirements: snap.media_requirements ?? [],
        editorial: snap.editorial ?? {},
        working_title: snap.working_title ?? null,
        final_title: snap.final_title ?? null,
        evergreen_topic: snap.evergreen_topic ?? null,
        evergreen_tags: snap.evergreen_tags ?? [],
        target_audience: snap.target_audience ?? null,
        content_version: nextVersion,
        approval_status: wasApproved ? "changes_requested" : current.approval_status,
        status: current.status === "approved" ? "changes_requested" : current.status,
        duplicate_fingerprint: fingerprint,
        human_reviewed: true,
      } as never)
      .eq("id", current.id);
    if (uErr) throw new ContentOpsError("unknown", uErr.message);

    const { error: verErr } = await context.supabase
      .from("social_content_versions")
      .insert({
        organization_id: data.organizationId,
        content_item_id: current.id,
        version: nextVersion,
        title: snap.title ?? null,
        body: snap.body,
        first_comment: snap.first_comment ?? null,
        hashtags: snap.hashtags ?? [],
        link_url: snap.link_url ?? null,
        media_requirements: snap.media_requirements ?? [],
        change_reason: data.changeReason ?? `Restored from v${data.version}`,
        generated_by: "user",
        generated_by_actor_id: context.userId,
        policy_version: CONTENT_OPS_POLICY_VERSION,
        source_lineage: [],
        content_hash: (snap.content_hash as string) + `:restore:${nextVersion}`,
        editorial: snap.editorial ?? {},
        working_title: snap.working_title ?? null,
        final_title: snap.final_title ?? null,
        evergreen_topic: snap.evergreen_topic ?? null,
        evergreen_tags: snap.evergreen_tags ?? [],
        target_audience: snap.target_audience ?? null,
        hook: snap.hook ?? null,
        cta: snap.cta ?? null,
        alt_text: snap.alt_text ?? null,
        newsletter_subject: snap.newsletter_subject ?? null,
        newsletter_preview: snap.newsletter_preview ?? null,
        restored_from_version: data.version,
      } as never);
    if (verErr) throw new ContentOpsError("unknown", verErr.message);

    if (wasApproved) {
      await context.supabase.from("content_ops_approvals").insert({
        organization_id: data.organizationId,
        venture_id: data.ventureId,
        content_item_id: current.id,
        content_version: nextVersion,
        action: "revoked",
        notes: `Approval removed because content changed (restored from v${data.version}).`,
        approved_by: context.userId,
        approved_at: new Date().toISOString(),
        brand_profile_version: (current.brand_profile_version as number | null) ?? null,
      } as never);
    }

    return { ok: true, contentVersion: nextVersion, restoredFromVersion: data.version, revokedApproval: wasApproved };
  });

// ---- Duplicate a variant (in-place, new draft) ----------------------------

const DuplicateInput = z.object({ ...orgVenture, contentItemId: uuid });

export const duplicateVariant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DuplicateInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId, "member");
    const { data: src, error: sErr } = await context.supabase
      .from("social_content_items")
      .select("*")
      .eq("id", data.contentItemId)
      .eq("organization_id", data.organizationId)
      .eq("venture_id", data.ventureId)
      .is("deleted_at", null)
      .maybeSingle();
    if (sErr) throw new ContentOpsError("unknown", sErr.message);
    if (!src) throw new ContentOpsError("not_found", "variant not found");

    const nextMeta = {
      ...((src.metadata as Record<string, unknown> | null) ?? {}),
      duplicated_from: src.id,
      autosave_token: null,
    };

    const fingerprint = buildDuplicateFingerprint({
      organizationId: data.organizationId,
      ventureId: data.ventureId,
      socialAccountId: src.social_account_id ?? null,
      campaignId: src.campaign_id ?? null,
      platform: src.platform,
      title: (src.title as string | null) ?? null,
      body: src.body as string,
      firstComment: (src.first_comment as string | null) ?? null,
      hashtags: (src.hashtags as string[] | null) ?? [],
      linkUrl: (src.link_url as string | null) ?? null,
      mediaHashes: ((src.media_requirements as Array<{ storageRef: string }> | null) ?? []).map((m) => m.storageRef),
    }) + `:dup:${Date.now()}`;

    const { data: row, error } = await context.supabase
      .from("social_content_items")
      .insert({
        organization_id: data.organizationId,
        venture_id: data.ventureId,
        campaign_id: src.campaign_id,
        content_plan_id: src.content_plan_id,
        parent_content_item_id: src.parent_content_item_id ?? src.id,
        platform: src.platform,
        content_type: src.content_type,
        title: src.title,
        body: src.body,
        hook: src.hook,
        cta: src.cta,
        first_comment: src.first_comment,
        hashtags: src.hashtags,
        link_url: src.link_url,
        alt_text: src.alt_text,
        newsletter_subject: src.newsletter_subject,
        newsletter_preview: src.newsletter_preview,
        media_requirements: src.media_requirements,
        media_status: src.media_status,
        status: "draft",
        risk_band: "unknown",
        risk_reasons: [],
        automation_generated: false,
        human_reviewed: true,
        approval_status: "pending",
        content_version: 1,
        source_lineage: [],
        policy_version: CONTENT_OPS_POLICY_VERSION,
        duplicate_fingerprint: fingerprint,
        metadata: nextMeta,
        editorial: src.editorial ?? {},
        working_title: src.working_title,
        final_title: null,
        evergreen_topic: src.evergreen_topic,
        evergreen_tags: src.evergreen_tags ?? [],
        target_audience: src.target_audience,
        learning_refs: [],
        created_by: context.userId,
      } as never)
      .select("id")
      .single();
    if (error) throw new ContentOpsError("unknown", error.message);
    return { id: row.id };
  });

// ---- Archive / Unarchive ---------------------------------------------------

const ArchiveInput = z.object({ ...orgVenture, contentItemId: uuid });

export const archiveContentItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ArchiveInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId, "member");
    const { data: row, error: rErr } = await context.supabase
      .from("social_content_items")
      .select("id, status")
      .eq("id", data.contentItemId)
      .eq("organization_id", data.organizationId)
      .eq("venture_id", data.ventureId)
      .is("deleted_at", null)
      .maybeSingle();
    if (rErr) throw new ContentOpsError("unknown", rErr.message);
    if (!row) throw new ContentOpsError("not_found", "content item not found");
    if (row.status === "publishing") {
      throw new ContentOpsError("invalid_transition", "Cannot archive an item mid-publish.");
    }
    const { error } = await context.supabase
      .from("social_content_items")
      .update({ status: "archived", archived_at: new Date().toISOString() } as never)
      .eq("id", row.id);
    if (error) throw new ContentOpsError("unknown", error.message);
    return { ok: true };
  });

export const unarchiveContentItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ArchiveInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId, "member");
    const { data: row, error: rErr } = await context.supabase
      .from("social_content_items")
      .select("id, status")
      .eq("id", data.contentItemId)
      .eq("organization_id", data.organizationId)
      .eq("venture_id", data.ventureId)
      .is("deleted_at", null)
      .maybeSingle();
    if (rErr) throw new ContentOpsError("unknown", rErr.message);
    if (!row) throw new ContentOpsError("not_found", "content item not found");
    if (row.status !== "archived") {
      return { ok: true, alreadyActive: true };
    }
    const { error } = await context.supabase
      .from("social_content_items")
      .update({ status: "draft", archived_at: null } as never)
      .eq("id", row.id);
    if (error) throw new ContentOpsError("unknown", error.message);
    return { ok: true, alreadyActive: false };
  });

// ---- Evergreen topic vocabulary -------------------------------------------

const ListTopicsInput = z.object({ ...orgVenture });

export const listEvergreenTopics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ListTopicsInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId, "member");
    const { data: rows, error } = await context.supabase
      .from("content_evergreen_topics")
      .select("id, slug, label, category, sort_order")
      .eq("organization_id", data.organizationId)
      .or(`venture_id.eq.${data.ventureId},venture_id.is.null`)
      .is("archived_at", null)
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true })
      .limit(500);
    if (error) throw new ContentOpsError("unknown", error.message);
    return rows ?? [];
  });

const CreateTopicInput = z.object({
  ...orgVenture,
  label: z.string().min(1).max(120),
  category: z.string().max(120).nullable().optional(),
});

export const createEvergreenTopic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateTopicInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId, "member");
    const slug = data.label
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 64);
    if (!slug) throw new ContentOpsError("invalid_input", "Label must include at least one letter or number.");

    const { data: existing } = await context.supabase
      .from("content_evergreen_topics")
      .select("id")
      .eq("organization_id", data.organizationId)
      .eq("venture_id", data.ventureId)
      .eq("slug", slug)
      .maybeSingle();
    if (existing) return { id: existing.id, slug, alreadyExists: true };

    const { data: row, error } = await context.supabase
      .from("content_evergreen_topics")
      .insert({
        organization_id: data.organizationId,
        venture_id: data.ventureId,
        slug,
        label: data.label.trim(),
        category: data.category ?? null,
        created_by: context.userId,
      } as never)
      .select("id")
      .single();
    if (error) throw new ContentOpsError("unknown", error.message);
    return { id: row.id, slug, alreadyExists: false };
  });

// ---- Version-snapshot diff helper (server-side) ---------------------------

const DiffInput = z.object({
  ...orgVenture,
  contentItemId: uuid,
  versionA: z.number().int().min(1),
  versionB: z.number().int().min(1),
});

export const loadVersionSnapshotsForDiff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DiffInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId, "member");
    const { data: rows, error } = await context.supabase
      .from("social_content_versions")
      .select("version, title, body, hook, cta, first_comment, working_title, final_title, evergreen_topic, evergreen_tags, target_audience, editorial, created_at, generated_by, change_reason")
      .eq("organization_id", data.organizationId)
      .eq("content_item_id", data.contentItemId)
      .in("version", [data.versionA, data.versionB]);
    if (error) throw new ContentOpsError("unknown", error.message);
    const a = (rows ?? []).find((r) => r.version === data.versionA) ?? null;
    const b = (rows ?? []).find((r) => r.version === data.versionB) ?? null;
    if (!a || !b) throw new ContentOpsError("not_found", "one or both versions not found");
    return { a, b };
  });