// Content Operations - Editor server functions. Every mutation goes through
// requireMembership + policy checks; every write snapshots a row into
// social_content_versions so the editor has a real revision history to
// render. No provider calls happen here - publishing is a separate stage
// gated by publish-gates.server.ts.

import { createServerFn } from "@tanstack/react-start";
import { createHash } from "crypto";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireMembership } from "./membership.server";
import { ContentOpsError } from "./errors";
import { CONTENT_OPS_LIMITS, CONTENT_OPS_POLICY_VERSION } from "./constants";
import { buildDuplicateFingerprint } from "@/lib/social/deduplication.server";
import { getPlatformConfig, PROMOTION_CLASSIFICATIONS, type EditorPlatform } from "./platform-registry";
import { validateVariant, type ValidationInput, type ValidationResult } from "./editor-validation";
import { SOCIAL_PLATFORMS, SOCIAL_CONTENT_TYPES } from "@/lib/constants";
import {
  editorialChangeRevokesApproval,
  normalizeEditorial,
  normalizeEvergreenTags,
} from "./editorial";

// ---- Shared shapes ---------------------------------------------------------

const uuid = z.string().uuid();
const orgVenture = { organizationId: uuid, ventureId: uuid };

// The editor accepts our canonical SocialPlatform values plus "beehiiv"
// and "email". Only SocialPlatform values are DB-writable today; non-social
// platforms are treated as staged (metadata.editor_platform) until we add a
// non-social destination table. This keeps forward-compat without a schema
// change.
const EditorPlatformSchema = z.enum([...SOCIAL_PLATFORMS, "beehiiv", "email"] as [string, ...string[]]);

const MediaAttachmentSchema = z.object({
  storageRef: z.string().min(1).max(1024),
  mimeType: z.string().min(1).max(120),
  altText: z.string().max(CONTENT_OPS_LIMITS.maxAltTextBytes).nullable().optional(),
  assetId: uuid.nullable().optional(),
  width: z.number().int().min(1).nullable().optional(),
  height: z.number().int().min(1).nullable().optional(),
});

// Editorial blob schema. All members optional; server normalizes with
// normalizeEditorial() so unknown fields drop and shapes are enforced.
const EditorialLinkSchema = z.object({
  url: z.string().min(1).max(2048),
  label: z.string().max(240).nullable().optional(),
});
const EditorialSourceSchema = z.object({
  title: z.string().min(1).max(240),
  url: z.string().max(2048).nullable().optional(),
  documentId: z.string().max(240).nullable().optional(),
});
const EditorialBlobSchema = z.object({
  workingTitle: z.string().max(500).nullable().optional(),
  finalTitle: z.string().max(500).nullable().optional(),
  creativeBrief: z.string().max(8000).nullable().optional(),
  designerNotes: z.string().max(8000).nullable().optional(),
  samNotes: z.string().max(8000).nullable().optional(),
  internalNotes: z.string().max(8000).nullable().optional(),
  platformNotes: z.string().max(8000).nullable().optional(),
  externalLinks: z.array(EditorialLinkSchema).max(50).optional(),
  sourceDocuments: z.array(EditorialSourceSchema).max(50).optional(),
  referenceUrls: z.array(z.string().max(2048)).max(50).optional(),
  mentionedPeople: z.array(z.string().max(240)).max(50).optional(),
  mentionedCompanies: z.array(z.string().max(240)).max(50).optional(),
  mentionedBrands: z.array(z.string().max(240)).max(50).optional(),
  targetAudience: z.string().max(2000).nullable().optional(),
  evergreenTopic: z.string().max(240).nullable().optional(),
  evergreenTags: z.array(z.string().max(64)).max(40).optional(),
});

// ---- Load ------------------------------------------------------------------

export const loadEditor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    organizationId: uuid,
    parentContentItemId: uuid,
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: parent, error: pErr } = await context.supabase
      .from("social_content_items")
      .select("*")
      .eq("id", data.parentContentItemId)
      .eq("organization_id", data.organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (pErr) throw new ContentOpsError("unknown", pErr.message);
    if (!parent) throw new ContentOpsError("not_found", "content item not found");
    await requireMembership(context.supabase, context.userId, parent.organization_id, parent.venture_id, "member");

    // A "parent" for editor purposes is any item without a parent_content_item_id.
    // If the caller landed on a variant, resolve up to the true parent.
    let rootId = parent.id;
    let rootRow = parent;
    if (parent.parent_content_item_id) {
      rootId = parent.parent_content_item_id;
      const { data: rp, error: rpErr } = await context.supabase
        .from("social_content_items")
        .select("*")
        .eq("id", rootId)
        .eq("organization_id", data.organizationId)
        .is("deleted_at", null)
        .maybeSingle();
      if (rpErr) throw new ContentOpsError("unknown", rpErr.message);
      if (!rp) throw new ContentOpsError("not_found", "parent content item not found");
      rootRow = rp;
    }

    const { data: variantRows, error: vErr } = await context.supabase
      .from("social_content_items")
      .select("*")
      .eq("organization_id", data.organizationId)
      .eq("parent_content_item_id", rootId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });
    if (vErr) throw new ContentOpsError("unknown", vErr.message);

    const variants = [rootRow, ...(variantRows ?? [])];

    // Recent versions across the whole group (parent + variants), for the
    // revision drawer. Bounded page.
    const variantIds = variants.map((v) => v.id);
    const { data: versionRows, error: verErr } = await context.supabase
      .from("social_content_versions")
      .select("id, content_item_id, version, generated_by, generated_by_actor_id, change_reason, created_at, content_hash")
      .eq("organization_id", data.organizationId)
      .in("content_item_id", variantIds)
      .order("created_at", { ascending: false })
      .limit(200);
    if (verErr) throw new ContentOpsError("unknown", verErr.message);

    const { data: approvalRows, error: aErr } = await context.supabase
      .from("content_ops_approvals")
      .select("id, content_item_id, content_version, action, notes, approved_by, approved_at")
      .eq("organization_id", data.organizationId)
      .in("content_item_id", variantIds)
      .order("approved_at", { ascending: false })
      .limit(200);
    if (aErr) throw new ContentOpsError("unknown", aErr.message);

    // Duplicate hints: another item with the same fingerprint (venture-wide).
    const fingerprints = variants.map((v) => v.duplicate_fingerprint).filter(Boolean) as string[];
    let duplicates: Array<{ fingerprint: string; contentItemId: string }> = [];
    if (fingerprints.length) {
      const { data: dupRows, error: dErr } = await context.supabase
        .from("social_content_items")
        .select("id, duplicate_fingerprint")
        .eq("organization_id", data.organizationId)
        .eq("venture_id", rootRow.venture_id)
        .in("duplicate_fingerprint", fingerprints)
        .is("deleted_at", null)
        .not("id", "in", `(${variantIds.map((id) => `"${id}"`).join(",")})`);
      if (dErr) throw new ContentOpsError("unknown", dErr.message);
      duplicates = (dupRows ?? []).map((r) => ({
        fingerprint: r.duplicate_fingerprint,
        contentItemId: r.id,
      }));
    }

    return {
      parent: rootRow,
      variants,
      versions: versionRows ?? [],
      approvals: approvalRows ?? [],
      duplicates,
      registryVersion: CONTENT_OPS_POLICY_VERSION,
    };
  });

// ---- Save (variant or parent) ---------------------------------------------

const SaveVariantInput = z.object({
  ...orgVenture,
  contentItemId: uuid,
  platform: EditorPlatformSchema,
  contentType: z.enum(SOCIAL_CONTENT_TYPES),
  title: z.string().max(300).nullable().optional(),
  hook: z.string().max(CONTENT_OPS_LIMITS.maxHookBytes).nullable().optional(),
  body: z.string().min(1).max(CONTENT_OPS_LIMITS.maxBodyBytes),
  cta: z.string().max(CONTENT_OPS_LIMITS.maxCtaBytes).nullable().optional(),
  hashtags: z.array(z.string().max(120)).max(50).default([]),
  mentions: z.array(z.string().max(120)).max(50).default([]),
  linkUrl: z.string().max(2048).nullable().optional(),
  firstComment: z.string().max(10000).nullable().optional(),
  altText: z.string().max(CONTENT_OPS_LIMITS.maxAltTextBytes).nullable().optional(),
  newsletterSubject: z.string().max(CONTENT_OPS_LIMITS.maxNewsletterSubjectBytes).nullable().optional(),
  newsletterPreview: z.string().max(CONTENT_OPS_LIMITS.maxNewsletterPreviewBytes).nullable().optional(),
  media: z.array(MediaAttachmentSchema).max(50).default([]),
  changeReason: z.string().max(500).optional(),
  // Revoking approval requires a deliberate flag - a plain save can never
  // silently overwrite an approved variant.
  overrideApproved: z.boolean().default(false),
  // Editorial workspace fields. All optional so pre-S1f-2b callers keep
  // working; when omitted the row's existing editorial blob is preserved.
  workingTitle: z.string().max(500).nullable().optional(),
  finalTitle: z.string().max(500).nullable().optional(),
  editorial: EditorialBlobSchema.optional(),
  evergreenTopic: z.string().max(240).nullable().optional(),
  evergreenTags: z.array(z.string().max(64)).max(40).optional(),
  targetAudience: z.string().max(2000).nullable().optional(),
  // Autosave idempotency token. When present, the server dedupes against
  // the current row's autosave_token in metadata and no-ops on match.
  clientEditToken: z.string().min(1).max(120).optional(),
});

export const saveVariant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveVariantInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId, "member");

    const { data: current, error: cErr } = await context.supabase
      .from("social_content_items")
      .select("id, organization_id, venture_id, approval_status, status, content_version, social_account_id, campaign_id, metadata, editorial, evergreen_topic, evergreen_tags, target_audience, working_title, final_title, brand_profile_version")
      .eq("id", data.contentItemId)
      .eq("organization_id", data.organizationId)
      .eq("venture_id", data.ventureId)
      .is("deleted_at", null)
      .maybeSingle();
    if (cErr) throw new ContentOpsError("unknown", cErr.message);
    if (!current) throw new ContentOpsError("not_found", "variant not found");
    if (current.status === "published" || current.status === "publishing") {
      throw new ContentOpsError("invalid_transition", "Cannot edit a variant that has already published.");
    }

    // Autosave idempotency: if the client resends the same edit token that
    // last saved, no-op instead of writing a duplicate version.
    const currentMeta = (current.metadata as Record<string, unknown> | null) ?? {};
    if (data.clientEditToken && currentMeta.autosave_token === data.clientEditToken) {
      return {
        ok: true,
        contentVersion: current.content_version,
        validation: validateVariant(toValidationInput(data)),
        deduped: true,
        revokedApproval: false,
      };
    }

    // Compute editorial change so approval-revocation checks cover the blob
    // too, not only the body/title/hook/cta the existing code compared.
    const beforeEditorial = normalizeEditorial(current.editorial);
    const nextEditorial = data.editorial
      ? normalizeEditorial({ ...beforeEditorial, ...data.editorial })
      : beforeEditorial;
    const editorialMaterialChanged = editorialChangeRevokesApproval(beforeEditorial, nextEditorial);
    const evergreenTags = data.evergreenTags !== undefined
      ? normalizeEvergreenTags(data.evergreenTags)
      : (current.evergreen_tags as string[] | null) ?? [];

    if (current.approval_status === "approved" && !data.overrideApproved) {
      throw new ContentOpsError("invalid_transition",
        "This variant is approved. Saving would revoke approval. Confirm to override.");
    }

    // Deterministic validation before writing. Errors block save; warnings
    // pass through and surface in the UI.
    const validation = validateVariant(toValidationInput(data));
    if (validation.blocksSubmit) {
      throw new ContentOpsError("invalid_input",
        `Cannot save: ${validation.errorCount} validation error(s).`,
        { validation: validation.issues });
    }

    const nextVersion = current.content_version + 1;
    const media = data.media ?? [];
    const wasApproved = current.approval_status === "approved";
    const nextApprovalStatus = wasApproved ? "changes_requested" : current.approval_status;
    const nextStatus =
      current.status === "approved" ? "changes_requested"
      : current.status === "scheduled" ? "draft"
      : current.status;

    const platformIsSocial = (SOCIAL_PLATFORMS as readonly string[]).includes(data.platform);
    const platformForDb = platformIsSocial ? data.platform : "other";
    const metadata = {
      ...currentMeta,
      editor_platform: data.platform,
      media,
      mentions: data.mentions,
      autosave_token: data.clientEditToken ?? null,
    };

    const fingerprint = buildDuplicateFingerprint({
      organizationId: data.organizationId,
      ventureId: data.ventureId,
      socialAccountId: current.social_account_id ?? null,
      campaignId: current.campaign_id ?? null,
      platform: platformForDb,
      title: data.title ?? null,
      body: data.body,
      firstComment: data.firstComment ?? null,
      hashtags: data.hashtags,
      linkUrl: data.linkUrl ?? null,
      mediaHashes: media.map((m) => m.storageRef),
    });

    const { error: uErr } = await context.supabase
      .from("social_content_items")
      .update({
        platform: platformForDb,
        content_type: data.contentType,
        title: data.title ?? null,
        hook: data.hook ?? null,
        body: data.body,
        cta: data.cta ?? null,
        hashtags: data.hashtags,
        link_url: data.linkUrl ?? null,
        first_comment: data.firstComment ?? null,
        alt_text: data.altText ?? null,
        newsletter_subject: data.newsletterSubject ?? null,
        newsletter_preview: data.newsletterPreview ?? null,
        media_requirements: media,
        media_status: media.length ? "ready" : "not_required",
        content_version: nextVersion,
        approval_status: nextApprovalStatus,
        status: nextStatus,
        duplicate_fingerprint: fingerprint,
        metadata,
        editorial: nextEditorial as never,
        working_title: data.workingTitle !== undefined
          ? (data.workingTitle ?? null)
          : (current.working_title ?? null),
        final_title: data.finalTitle !== undefined
          ? (data.finalTitle ?? null)
          : (current.final_title ?? null),
        evergreen_topic: data.evergreenTopic !== undefined
          ? (data.evergreenTopic ?? null)
          : (current.evergreen_topic ?? null),
        evergreen_tags: evergreenTags,
        target_audience: data.targetAudience !== undefined
          ? (data.targetAudience ?? null)
          : (current.target_audience ?? null),
        risk_reasons: validation.issues
          .filter((i) => i.severity === "warning")
          .slice(0, 20)
          .map((i) => i.ruleId),
        human_reviewed: true,
      } as never)
      .eq("id", current.id);
    if (uErr) throw new ContentOpsError("unknown", uErr.message);

    const snapshotHash = createHash("sha256")
      .update(JSON.stringify({
        title: data.title, body: data.body, hook: data.hook, cta: data.cta,
        hashtags: data.hashtags, mentions: data.mentions, link: data.linkUrl,
        firstComment: data.firstComment, alt: data.altText,
        subject: data.newsletterSubject, preview: data.newsletterPreview,
        media: media.map((m) => m.storageRef),
      }))
      .digest("hex");

    const { error: verErr } = await context.supabase
      .from("social_content_versions")
      .insert({
        organization_id: data.organizationId,
        content_item_id: current.id,
        version: nextVersion,
        title: data.title ?? null,
        body: data.body,
        first_comment: data.firstComment ?? null,
        hashtags: data.hashtags,
        link_url: data.linkUrl ?? null,
        media_requirements: media,
        change_reason: data.changeReason ?? null,
        generated_by: "user",
        generated_by_actor_id: context.userId,
        policy_version: CONTENT_OPS_POLICY_VERSION,
        source_lineage: [],
        content_hash: snapshotHash,
        editorial: nextEditorial as never,
        working_title: data.workingTitle !== undefined ? (data.workingTitle ?? null) : (current.working_title ?? null),
        final_title: data.finalTitle !== undefined ? (data.finalTitle ?? null) : (current.final_title ?? null),
        evergreen_topic: data.evergreenTopic !== undefined ? (data.evergreenTopic ?? null) : (current.evergreen_topic ?? null),
        evergreen_tags: evergreenTags,
        target_audience: data.targetAudience !== undefined ? (data.targetAudience ?? null) : (current.target_audience ?? null),
        hook: data.hook ?? null,
        cta: data.cta ?? null,
        alt_text: data.altText ?? null,
        newsletter_subject: data.newsletterSubject ?? null,
        newsletter_preview: data.newsletterPreview ?? null,
      } as never);
    if (verErr) throw new ContentOpsError("unknown", verErr.message);

    // Record an explicit revocation entry when a save invalidates an
    // existing approval so the revision drawer can render
    // "Approval removed because content changed."
    if (wasApproved) {
      const revokeReason = editorialMaterialChanged
        ? "Approval removed because editorial content changed."
        : "Approval removed because content changed.";
      await context.supabase.from("content_ops_approvals").insert({
        organization_id: data.organizationId,
        venture_id: data.ventureId,
        content_item_id: current.id,
        content_version: nextVersion,
        action: "revoked",
        notes: revokeReason,
        approved_by: context.userId,
        approved_at: new Date().toISOString(),
        brand_profile_version: (current.brand_profile_version as number | null) ?? null,
      } as never);
    }

    return {
      ok: true,
      contentVersion: nextVersion,
      validation,
      deduped: false,
      revokedApproval: wasApproved,
    };
  });

function toValidationInput(v: z.infer<typeof SaveVariantInput>): ValidationInput {
  return {
    platform: v.platform as EditorPlatform,
    contentType: v.contentType,
    title: v.title ?? null,
    hook: v.hook ?? null,
    body: v.body,
    cta: v.cta ?? null,
    hashtags: v.hashtags,
    mentions: v.mentions,
    linkUrl: v.linkUrl ?? null,
    firstComment: v.firstComment ?? null,
    altText: v.altText ?? null,
    newsletterSubject: v.newsletterSubject ?? null,
    newsletterPreview: v.newsletterPreview ?? null,
    media: (v.media ?? []).map((m) => ({
      storageRef: m.storageRef, mimeType: m.mimeType, altText: m.altText ?? null,
    })),
  };
}

// ---- Create variant --------------------------------------------------------

const CreateVariantInput = z.object({
  ...orgVenture,
  parentContentItemId: uuid,
  platform: EditorPlatformSchema,
  contentType: z.enum(SOCIAL_CONTENT_TYPES),
});

export const createVariant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateVariantInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId, "member");
    const { data: parent, error: pErr } = await context.supabase
      .from("social_content_items")
      .select("id, organization_id, venture_id, campaign_id, content_plan_id, body, hook, cta, hashtags, link_url, metadata")
      .eq("id", data.parentContentItemId)
      .eq("organization_id", data.organizationId)
      .eq("venture_id", data.ventureId)
      .is("deleted_at", null)
      .maybeSingle();
    if (pErr) throw new ContentOpsError("unknown", pErr.message);
    if (!parent) throw new ContentOpsError("not_found", "parent not found");

    // Prevent duplicate empty variants for the same platform on the same parent.
    const { data: existing } = await context.supabase
      .from("social_content_items")
      .select("id, platform")
      .eq("parent_content_item_id", parent.id)
      .eq("organization_id", data.organizationId)
      .is("deleted_at", null);
    const platformIsSocial = (SOCIAL_PLATFORMS as readonly string[]).includes(data.platform);
    const dbPlatform = platformIsSocial ? data.platform : "other";
    if ((existing ?? []).some((e) => e.platform === dbPlatform)) {
      const cfg = getPlatformConfig(data.platform);
      throw new ContentOpsError("conflict", `A ${cfg.displayName} variant already exists on this content.`);
    }

    const fingerprint = buildDuplicateFingerprint({
      organizationId: data.organizationId,
      ventureId: data.ventureId,
      platform: dbPlatform,
      title: null,
      body: parent.body,
      hashtags: (parent.hashtags as string[] | null) ?? [],
      linkUrl: (parent.link_url as string | null) ?? null,
    });

    const { data: row, error } = await context.supabase
      .from("social_content_items")
      .insert({
        organization_id: data.organizationId,
        venture_id: data.ventureId,
        campaign_id: parent.campaign_id,
        content_plan_id: parent.content_plan_id,
        parent_content_item_id: parent.id,
        platform: dbPlatform,
        content_type: data.contentType,
        title: null,
        body: parent.body,
        hook: parent.hook,
        cta: parent.cta,
        hashtags: parent.hashtags,
        link_url: parent.link_url,
        media_requirements: [],
        media_status: "not_required",
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
        metadata: { editor_platform: data.platform, cloned_from: parent.id },
        learning_refs: [],
        created_by: context.userId,
      } as never)
      .select("id")
      .single();
    if (error) throw new ContentOpsError("unknown", error.message);
    return { id: row.id };
  });

// ---- Delete variant (soft) -------------------------------------------------

const DeleteVariantInput = z.object({ ...orgVenture, contentItemId: uuid });

export const deleteVariant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DeleteVariantInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId, "executive");
    const { data: row, error: rErr } = await context.supabase
      .from("social_content_items")
      .select("id, parent_content_item_id, status, approval_status")
      .eq("id", data.contentItemId)
      .eq("organization_id", data.organizationId)
      .eq("venture_id", data.ventureId)
      .maybeSingle();
    if (rErr) throw new ContentOpsError("unknown", rErr.message);
    if (!row) throw new ContentOpsError("not_found", "variant not found");
    if (!row.parent_content_item_id) {
      throw new ContentOpsError("invalid_transition", "Delete the whole content group instead of the parent.");
    }
    if (row.status === "published" || row.status === "publishing") {
      throw new ContentOpsError("invalid_transition", "Cannot delete a published variant. Retract via the connector first.");
    }
    const { error } = await context.supabase
      .from("social_content_items")
      .update({ deleted_at: new Date().toISOString() } as never)
      .eq("id", row.id);
    if (error) throw new ContentOpsError("unknown", error.message);
    return { ok: true };
  });

// ---- Approval lifecycle ----------------------------------------------------

const SubmitInput = z.object({ ...orgVenture, contentItemId: uuid });

export const submitForApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SubmitInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId, "member");
    const { data: row, error: rErr } = await context.supabase
      .from("social_content_items")
      .select("id, approval_status, status")
      .eq("id", data.contentItemId)
      .eq("organization_id", data.organizationId)
      .eq("venture_id", data.ventureId)
      .maybeSingle();
    if (rErr) throw new ContentOpsError("unknown", rErr.message);
    if (!row) throw new ContentOpsError("not_found", "variant not found");
    if (row.approval_status === "approved") return { ok: true, alreadyApproved: true };
    const { error } = await context.supabase
      .from("social_content_items")
      .update({
        approval_status: "pending",
        status: "needs_review",
      } as never)
      .eq("id", row.id);
    if (error) throw new ContentOpsError("unknown", error.message);
    return { ok: true, alreadyApproved: false };
  });

const RequestRevisionInput = z.object({
  ...orgVenture,
  contentItemId: uuid,
  notes: z.string().min(3).max(2000),
});

export const requestRevision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RequestRevisionInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId, "executive");
    const { data: row, error: rErr } = await context.supabase
      .from("social_content_items")
      .select("id, content_version, brand_profile_version")
      .eq("id", data.contentItemId)
      .eq("organization_id", data.organizationId)
      .eq("venture_id", data.ventureId)
      .maybeSingle();
    if (rErr) throw new ContentOpsError("unknown", rErr.message);
    if (!row) throw new ContentOpsError("not_found", "variant not found");
    const { error: uErr } = await context.supabase
      .from("social_content_items")
      .update({
        approval_status: "changes_requested",
        status: "changes_requested",
        human_reviewed: true,
      } as never)
      .eq("id", row.id);
    if (uErr) throw new ContentOpsError("unknown", uErr.message);
    const { error: aErr } = await context.supabase
      .from("content_ops_approvals")
      .insert({
        organization_id: data.organizationId,
        venture_id: data.ventureId,
        content_item_id: row.id,
        content_version: row.content_version,
        action: "requested_revision",
        notes: data.notes,
        approved_by: context.userId,
        approved_at: new Date().toISOString(),
        brand_profile_version: row.brand_profile_version ?? null,
      } as never);
    if (aErr) throw new ContentOpsError("unknown", aErr.message);
    return { ok: true };
  });

// ---- Parent metadata (campaign / pillar / objective / promotion / risk) ---

const UpdateParentInput = z.object({
  ...orgVenture,
  contentItemId: uuid,
  campaignId: uuid.nullable().optional(),
  pillarId: z.string().max(64).nullable().optional(),
  objective: z.string().max(1000).nullable().optional(),
  promotionClassification: z.enum(PROMOTION_CLASSIFICATIONS).nullable().optional(),
  riskScore: z.number().min(0).max(1).nullable().optional(),
  riskBand: z.enum(["low", "moderate", "high", "critical", "unknown"]).optional(),
  generationProvenance: z.record(z.string(), z.unknown()).optional(),
});

export const updateParentMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateParentInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId, "member");
    const { data: row, error: rErr } = await context.supabase
      .from("social_content_items")
      .select("id, metadata, risk_band")
      .eq("id", data.contentItemId)
      .eq("organization_id", data.organizationId)
      .eq("venture_id", data.ventureId)
      .maybeSingle();
    if (rErr) throw new ContentOpsError("unknown", rErr.message);
    if (!row) throw new ContentOpsError("not_found", "content item not found");
    if (data.campaignId !== undefined) {
      if (data.campaignId) {
        const { data: c, error: cErr } = await context.supabase
          .from("social_campaigns")
          .select("id")
          .eq("id", data.campaignId)
          .eq("organization_id", data.organizationId)
          .eq("venture_id", data.ventureId)
          .maybeSingle();
        if (cErr) throw new ContentOpsError("unknown", cErr.message);
        if (!c) throw new ContentOpsError("not_found", "campaign not in this venture");
      }
    }
    const nextMeta = {
      ...(row.metadata as Record<string, unknown> ?? {}),
      ...(data.pillarId !== undefined ? { pillar_id: data.pillarId } : {}),
      ...(data.objective !== undefined ? { objective: data.objective } : {}),
      ...(data.promotionClassification !== undefined
        ? { promotion_classification: data.promotionClassification } : {}),
      ...(data.riskScore !== undefined ? { risk_score: data.riskScore } : {}),
      ...(data.generationProvenance !== undefined
        ? { generation_provenance: data.generationProvenance } : {}),
    };
    const patch: Record<string, unknown> = { metadata: nextMeta };
    if (data.campaignId !== undefined) patch.campaign_id = data.campaignId;
    if (data.riskBand) patch.risk_band = data.riskBand;
    const { error } = await context.supabase
      .from("social_content_items")
      .update(patch as never)
      .eq("id", row.id);
    if (error) throw new ContentOpsError("unknown", error.message);
    return { ok: true };
  });

// ---- Read helpers used by the editor UI -----------------------------------

export const listVentureCampaigns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object(orgVenture).parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId, "member");
    const { data: rows, error } = await context.supabase
      .from("social_campaigns")
      .select("id, name, status, objective, strategy_period_start, strategy_period_end")
      .eq("organization_id", data.organizationId)
      .eq("venture_id", data.ventureId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new ContentOpsError("unknown", error.message);
    return rows ?? [];
  });

export const listVenturePillars = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object(orgVenture).parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId, "member");
    const { data: row, error } = await context.supabase
      .from("venture_brand_profiles")
      .select("id, content_pillars, status, version")
      .eq("organization_id", data.organizationId)
      .eq("venture_id", data.ventureId)
      .in("status", ["active", "draft"])
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new ContentOpsError("unknown", error.message);
    const pillars = (row?.content_pillars as Array<{ id: string; name: string }> | null) ?? [];
    return pillars;
  });

/**
 * Server-side validation for one variant. Used when the client wants an
 * authoritative check without saving (e.g., before submit-for-approval).
 */
export const validateVariantOnly = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveVariantInput.omit({ changeReason: true, overrideApproved: true }).parse(input))
  .handler(async ({ data, context }): Promise<ValidationResult> => {
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId, "member");
    return validateVariant(toValidationInput(data as z.infer<typeof SaveVariantInput>));
  });
