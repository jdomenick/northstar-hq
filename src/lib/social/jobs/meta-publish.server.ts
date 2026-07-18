// social_publish handler for Facebook + Instagram (framework).
//
// Truthful posture until Meta OAuth completes:
//   - reads content item + provider capabilities
//   - derives idempotency key
//   - short-circuits any existing publication history row
//   - stops at a "blocked_terminal" state with structured blocked_reason
//     when the provider adapter reports publish is not available
//   - NEVER attempts a Graph API call while adapter reports blocked
//   - persists an attempt row to content_publication_history so the UI
//     shows the blocked history the same way a live attempt would
//
// When real credentials + OAuth are wired in and the adapter capability
// flips to publishAvailable, this handler will call adapter.publish()
// and record the real provider response. That path is present but gated.

import { z } from "zod";
import { AutomationError } from "@/lib/automation/errors";
import type { HandlerFn } from "@/lib/automation/executor.server";
import { deriveIdempotencyKey } from "@/lib/social/providers/meta/idempotency";
import { facebookAdapter } from "@/lib/social/providers/facebook";
import { instagramAdapter } from "@/lib/social/providers/instagram";
import { readMetaConfigStatus } from "@/lib/social/providers/meta/config.server";

export const META_PUBLISH_HANDLER_VERSION = "meta.publish.v1-framework";

export const MetaPublishInputSchema = z.object({
  contentItemId: z.string().uuid(),
  destinationExternalId: z.string().min(1).optional(),
  publishGeneration: z.number().int().min(1).default(1),
  trigger: z.enum(["scheduled", "manual"]).default("scheduled"),
});

export const metaPublishHandler: HandlerFn = async ({ supabase, job }) => {
  const parsed = MetaPublishInputSchema.safeParse(job.input_payload ?? {});
  if (!parsed.success) throw new AutomationError("malformed_input", parsed.error.message);
  const { contentItemId, publishGeneration } = parsed.data;

  const { data: item, error } = await supabase
    .from("social_content_items")
    .select(
      "id, organization_id, venture_id, platform, status, approval_status, approved_content_version, content_version, external_post_id, social_account_id, body, publish_generation",
    )
    .eq("id", contentItemId)
    .eq("organization_id", job.organization_id)
    .maybeSingle();
  if (error) throw new AutomationError("internal_automation_error", error.message);
  if (!item) throw new AutomationError("source_deleted", "content item not found");
  const platform = item.platform;
  if (platform !== "facebook" && platform !== "instagram") {
    throw new AutomationError("job_not_implemented", `meta_publish_wrong_platform:${platform}`);
  }

  // Approval + version integrity checks (truthful; no HTTP if any fails).
  if (item.status === "approval_revoked") {
    return blockedResult(supabase, item, publishGeneration, job.id, "revoked_approval", "Approval was revoked");
  }
  if (item.status === "cancelled") {
    return blockedResult(supabase, item, publishGeneration, job.id, "canceled_publication", "Publication was canceled");
  }
  if (item.approval_status !== "approved") {
    return blockedResult(supabase, item, publishGeneration, job.id, "revoked_approval", "Content is not approved");
  }
  if ((item.approved_content_version ?? 0) !== (item.content_version ?? 0)) {
    return blockedResult(supabase, item, publishGeneration, job.id, "changed_approved_version", "Content changed after approval");
  }

  // Destination + idempotency.
  const destinationExternalId = parsed.data.destinationExternalId ?? item.social_account_id ?? "no_destination";
  const idempotencyKey = deriveIdempotencyKey({
    organizationId: item.organization_id,
    contentItemId: item.id,
    approvedVersionId: String(item.approved_content_version ?? "none"),
    destinationExternalId,
    provider: platform as "facebook" | "instagram",
    publishGeneration,
  });

  const { data: existing } = await supabase
    .from("content_publication_history")
    .select("id, status, provider_post_id, permalink")
    .eq("organization_id", item.organization_id)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (existing && (existing as { status: string }).status !== "blocked") {
    return {
      outputSummary: {
        handlerVersion: META_PUBLISH_HANDLER_VERSION,
        idempotencyKey,
        deduplicated: true,
        existingHistoryId: (existing as { id: string }).id,
        published: false,
        note: "duplicate_execution short-circuited by idempotency",
      },
      significance: "minor",
    };
  }

  // Capability check via adapter (no HTTP - reads env).
  const adapter = platform === "facebook" ? facebookAdapter : instagramAdapter;
  const caps = adapter.getCapabilities();
  const cfg = readMetaConfigStatus();
  if (!caps.supportsPublish) {
    const failureCode = !cfg.configured ? "connector_not_configured" : "authorization_revoked";
    return blockedResult(
      supabase,
      item,
      publishGeneration,
      job.id,
      failureCode,
      !cfg.configured
        ? `Meta credentials required (missing: ${cfg.missing.join(", ")})`
        : "Meta account not connected",
      idempotencyKey,
    );
  }

  // Real path (executed only when adapter is truly ready).
  const res = await adapter.publish!({
    organizationId: item.organization_id,
    ventureId: item.venture_id,
    contentItemId: item.id,
    socialAccountId: item.social_account_id,
    title: null,
    body: item.body,
    hashtags: [],
    linkUrl: null,
    scheduledFor: null,
    newsletterSubject: null,
    newsletterPreview: null,
  });

  await supabase.from("content_publication_history").insert({
    organization_id: item.organization_id,
    venture_id: item.venture_id,
    content_item_id: item.id,
    social_account_id: item.social_account_id,
    provider: platform,
    api_version: "v25.0",
    publish_generation: publishGeneration,
    idempotency_key: idempotencyKey,
    status: res.status === "blocked_missing_credentials" ? "blocked" : (res.status === "published" ? "provider_ok" : "failed"),
    provider_post_id: res.externalPostId,
    permalink: res.externalPostUrl,
    request_snapshot: { contentItemId: item.id },
    response_snapshot: { status: res.status, providerMessage: res.providerMessage },
    error_code: res.status === "failed" ? "provider_rejection" : null,
    automation_job_id: job.id,
  } as never);

  return {
    outputSummary: {
      handlerVersion: META_PUBLISH_HANDLER_VERSION,
      idempotencyKey,
      adapterStatus: res.status,
      externalPostId: res.externalPostId,
      published: res.status === "published",
    },
    significance: res.status === "published" ? "major" : "moderate",
    changedContentItemId: item.id,
  };
};

async function blockedResult(
  supabase: Parameters<HandlerFn>[0]["supabase"],
  item: { id: string; organization_id: string; venture_id: string; social_account_id: string | null; platform: string },
  publishGeneration: number,
  jobId: string,
  failureCode: string,
  reason: string,
  idempotencyKey?: string,
) {
  // Persist a truthful "blocked" attempt to publication history so the UI
  // surfaces it identically to a live attempt. Note status='blocked'.
  if (idempotencyKey) {
    await supabase.from("content_publication_history").upsert({
      organization_id: item.organization_id,
      venture_id: item.venture_id,
      content_item_id: item.id,
      social_account_id: item.social_account_id,
      provider: item.platform,
      api_version: "v25.0",
      publish_generation: publishGeneration,
      idempotency_key: idempotencyKey,
      status: "blocked",
      error_code: failureCode,
      error_message: reason,
      request_snapshot: {},
      response_snapshot: { blocked: true, reason },
      automation_job_id: jobId,
    } as never, { onConflict: "organization_id,idempotency_key" });
  }
  await supabase
    .from("social_content_items")
    .update({ blocked_reason: `${failureCode}: ${reason}` } as never)
    .eq("id", item.id);
  return {
    outputSummary: {
      handlerVersion: META_PUBLISH_HANDLER_VERSION,
      blockedTerminal: true,
      failureCode,
      reason,
      published: false,
      idempotencyKey: idempotencyKey ?? null,
    },
    significance: "minor" as const,
  };
}
