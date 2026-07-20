// website_sync handler. Reuses existing deterministic ingestion primitives:
// URL safety, safe fetch, HTML extraction, path scoring, normalization,
// hashing, change detection, classification, version recording, freshness.
// Handler is idempotent per (source, content_hash): same content = no new
// version. External side-effect only in that NorthStar Labs persists a version.

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { AutomationError } from "../errors";
import { registerHandler, type HandlerFn } from "../executor.server";

type SB = SupabaseClient<Database>;

export const WebsiteSyncInputSchema = z.object({
  sourceId: z.string().uuid().optional(),
  connectionId: z.string().uuid().optional(),
});

function mapIntegrationErrorToAutomation(code: string): AutomationError {
  switch (code) {
    case "blocked_private_network":
      return new AutomationError("private_network_blocked");
    case "unsupported_scheme":
      return new AutomationError("unsupported_scheme");
    case "invalid_url":
    case "blocked_by_policy":
      return new AutomationError("unsafe_url");
    case "request_timeout":
      return new AutomationError("timeout");
    case "dns_resolution_failed":
      return new AutomationError("temporary_network_failure");
    case "http_server_error":
    case "network_error":
      return new AutomationError("temporary_provider_failure");
    case "http_client_error":
    case "response_too_large":
    case "unsupported_content_type":
    case "parse_failed":
      return new AutomationError("malformed_input");
    case "connection_archived":
    case "connection_disabled":
      return new AutomationError("connection_revoked");
    case "source_not_found":
    case "connection_not_found":
      return new AutomationError("source_deleted");
    default:
      return new AutomationError("internal_automation_error", code);
  }
}

async function syncOneSource(supabase: SB, organizationId: string, sourceId: string) {
  const { safeFetchText } = await import("@/lib/integrations/connectors/website/fetch.server");
  const { extractHtml } = await import("@/lib/integrations/connectors/website/html.server");
  const { scorePath } = await import("@/lib/integrations/connectors/website/scoring");
  const { validatePublicUrl } = await import("@/lib/integrations/connectors/website/url-safety.server");
  const { normalizeContent, contentFingerprint } = await import("@/lib/integrations/normalization.server");
  const { detectChange, summarizeDiff } = await import("@/lib/integrations/change-detection");
  const { classifyContent } = await import("@/lib/integrations/classification");
  const { recordContentVersion } = await import("@/lib/integrations/versions.server");
  const { classifyFreshness } = await import("@/lib/integrations/freshness.server");
  const { isIntegrationError } = await import("@/lib/integrations/errors");

  const { data: source, error } = await supabase
    .from("integration_sources")
    .select("*")
    .eq("id", sourceId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new AutomationError("internal_automation_error", error.message);
  if (!source) throw new AutomationError("source_deleted");
  if (source.organization_id !== organizationId) throw new AutomationError("cross_org_denied");
  if (!source.source_url) throw new AutomationError("malformed_input", "source has no url");

  if (!source.connection_id) throw new AutomationError("source_deleted");
  const { data: conn } = await supabase
    .from("integration_connections")
    .select("id, organization_id, status, deleted_at")
    .eq("id", source.connection_id)
    .maybeSingle();
  if (!conn || conn.deleted_at) throw new AutomationError("source_deleted");
  if (conn.status === "disabled" || conn.status === "archived") throw new AutomationError("connection_revoked");

  const now = new Date();
  let page: Awaited<ReturnType<typeof safeFetchText>>;
  try {
    const safe = validatePublicUrl(source.source_url);
    page = await safeFetchText(safe.href, { acceptContentTypes: ["text/html", "application/xhtml+xml"] });
  } catch (err) {
    if (isIntegrationError(err)) throw mapIntegrationErrorToAutomation(err.code);
    throw new AutomationError("temporary_network_failure");
  }

  const parsed = extractHtml(page.text);
  const urlScore = scorePath(page.finalUrl.pathname, parsed.title);
  const normalized = normalizeContent({
    canonicalUrl: page.finalUrl.href,
    title: parsed.title || source.source_url,
    rawText: parsed.text,
  });
  const classification = classifyContent({
    urlScore,
    title: normalized.title,
    text: normalized.contentText,
  });
  const nextHash = contentFingerprint(normalized);
  const freshness = classifyFreshness(now.toISOString(), now);

  const { data: existing } = await supabase
    .from("ingested_content_items")
    .select("id, content_hash, current_version_number, title, content_text")
    .eq("organization_id", organizationId)
    .eq("canonical_url", page.finalUrl.href)
    .is("deleted_at", null)
    .maybeSingle();

  const change = detectChange({
    previousHash: existing?.content_hash ?? null,
    previousText: (existing?.content_text as string | null) ?? null,
    previousTitle: (existing?.title as string | null) ?? null,
    nextHash,
    nextText: normalized.contentText,
    nextTitle: normalized.title,
  });

  const classificationSignalsJson = classification.signals as unknown as Json;
  const normalizedMetadataJson = normalized.metadata as unknown as Json;
  const startedMs = Date.now();

  if (!existing) {
    const { data: inserted, error: insertErr } = await supabase
      .from("ingested_content_items")
      .insert({
        organization_id: organizationId,
        venture_id: source.venture_id,
        source_id: source.id,
        connection_id: source.connection_id,
        source_type: source.source_type,
        canonical_url: page.finalUrl.href,
        title: normalized.title,
        content_text: normalized.contentText,
        content_summary: normalized.contentSummary,
        content_hash: nextHash,
        category: classification.category,
        tags: normalized.tags,
        metadata: normalizedMetadataJson,
        freshness_status: freshness,
        current_version_number: 1,
        last_change_at: now.toISOString(),
        last_change_significance: change.significance,
        classification_confidence: classification.confidence,
        classification_signals: classificationSignalsJson,
      })
      .select("id")
      .single();
    if (insertErr || !inserted) throw new AutomationError("internal_automation_error", insertErr?.message);
    await recordContentVersion(supabase, {
      organizationId,
      contentItemId: inserted.id,
      nextVersionNumber: 1,
      contentHash: nextHash,
      title: normalized.title,
      text: normalized.contentText,
      change,
      metadata: { classification: classification.signals },
    });
    return {
      sourceId: source.id,
      contentItemId: inserted.id,
      created: true,
      changed: true,
      versionNumber: 1,
      significance: change.significance,
      classification: classification.category,
      freshnessStatus: freshness,
      fetchedAt: now.toISOString(),
      httpStatus: page.status,
      durationMs: Date.now() - startedMs,
      diff: summarizeDiff(change),
    };
  }

  if (!change.changed) {
    await supabase
      .from("ingested_content_items")
      .update({ last_ingested_at: now.toISOString(), freshness_status: freshness })
      .eq("id", existing.id);
    return {
      sourceId: source.id,
      contentItemId: existing.id,
      created: false,
      changed: false,
      versionNumber: existing.current_version_number as number,
      significance: "none" as const,
      classification: classification.category,
      freshnessStatus: freshness,
      fetchedAt: now.toISOString(),
      httpStatus: page.status,
      durationMs: Date.now() - startedMs,
    };
  }

  const nextVersion = (existing.current_version_number as number) + 1;
  await recordContentVersion(supabase, {
    organizationId,
    contentItemId: existing.id,
    nextVersionNumber: nextVersion,
    contentHash: nextHash,
    title: normalized.title,
    text: normalized.contentText,
    change,
    metadata: { classification: classification.signals },
  });
  await supabase
    .from("ingested_content_items")
    .update({
      content_text: normalized.contentText,
      content_summary: normalized.contentSummary,
      content_hash: nextHash,
      title: normalized.title,
      last_ingested_at: now.toISOString(),
      freshness_status: freshness,
      current_version_number: nextVersion,
      last_change_at: now.toISOString(),
      last_change_significance: change.significance,
      classification_confidence: classification.confidence,
      classification_signals: classificationSignalsJson,
      category: classification.category,
    })
    .eq("id", existing.id);

  return {
    sourceId: source.id,
    contentItemId: existing.id,
    created: false,
    changed: true,
    versionNumber: nextVersion,
    significance: change.significance,
    classification: classification.category,
    freshnessStatus: freshness,
    fetchedAt: now.toISOString(),
    httpStatus: page.status,
    durationMs: Date.now() - startedMs,
  };
}

const handler: HandlerFn = async ({ supabase, job }) => {
  const payload = WebsiteSyncInputSchema.parse(job.input_payload ?? {});
  const sourceId = payload.sourceId ?? job.integration_source_id;
  if (!sourceId) throw new AutomationError("malformed_input", "missing sourceId");

  const result = await syncOneSource(supabase, job.organization_id, sourceId);

  const signals: HandlerResult["signals"] = [];
  if (result.changed && (result.significance === "moderate" || result.significance === "major")) {
    signals.push({
      signalType: "website_change_detected",
      assetId: job.asset_id,
      title: `Website change detected: ${result.significance}`,
      description: `${result.classification} · v${result.versionNumber}`,
      significance: result.significance,
      metadata: {
        contentItemId: result.contentItemId,
        sourceId: result.sourceId,
        versionNumber: result.versionNumber,
      },
    });
  }

  return {
    outputSummary: {
      sourceId: result.sourceId,
      contentItemId: result.contentItemId,
      changed: result.changed,
      created: result.created,
      versionNumber: result.versionNumber,
      significance: result.significance,
      classification: result.classification,
      freshnessStatus: result.freshnessStatus,
      fetchedAt: result.fetchedAt,
      httpStatus: result.httpStatus,
      durationMs: result.durationMs,
    },
    signals,
    changedContentItemId: result.changed ? result.contentItemId : null,
    significance: result.significance as HandlerResult["significance"],
  };
};

// Type reference to avoid tree-shaking the handler-result signals
type HandlerResult = Awaited<ReturnType<HandlerFn>>;

registerHandler("website_sync", handler);
