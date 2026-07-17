// Client-callable server functions for content ingestion + change detection
// (Phase 3D.2b). Fetches a single source URL, normalizes it, hashes it,
// runs deterministic change detection against the current version,
// classifies it, and writes a new version row when the content changed.
// No scheduling, event bus, notifications, or auto-promotion here.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { IntegrationError, isIntegrationError, toIntegrationErrorCode } from "./errors";

const IngestInput = z.object({
  organizationId: z.string().uuid(),
  sourceId: z.string().uuid(),
});

export const ingestSourceContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => IngestInput.parse(input))
  .handler(async ({ data, context }) => {
    try {
      const { resolveScope, requireRole, requireSourceAccess } = await import("./auth.server");
      const { safeFetchText } = await import("./connectors/website/fetch.server");
      const { extractHtml } = await import("./connectors/website/html.server");
      const { scorePath } = await import("./connectors/website/scoring");
      const { validatePublicUrl } = await import("./connectors/website/url-safety.server");
      const { normalizeContent, contentFingerprint } = await import("./normalization.server");
      const { detectChange, summarizeDiff } = await import("./change-detection");
      const { classifyContent } = await import("./classification");
      const { recordContentVersion } = await import("./versions.server");
      const { classifyFreshness } = await import("./freshness.server");

      const scope = await resolveScope(context.supabase, context.userId, data.organizationId, null);
      requireRole(scope, "member");
      const source = await requireSourceAccess(context.supabase, data.sourceId, scope);
      if (!source.source_url) throw new IntegrationError("invalid_input", "Source has no URL");

      const safe = validatePublicUrl(source.source_url);
      const page = await safeFetchText(safe.href, { acceptContentTypes: ["text/html", "application/xhtml+xml"] });
      const parsed = extractHtml(page.text);
      const urlScore = scorePath(page.finalUrl.pathname, parsed.title);
      const normalized = normalizeContent({
        canonicalUrl: page.finalUrl.href,
        title: parsed.title || safe.pathname,
        rawText: parsed.text,
      });
      const classification = classifyContent({
        urlScore,
        title: normalized.title,
        text: normalized.contentText,
      });
      const nextHash = contentFingerprint(normalized);

      // Look up existing content item by canonical URL within org scope.
      const { data: existing } = await context.supabase
        .from("ingested_content_items")
        .select("id, content_hash, current_version_number, title, content_text")
        .eq("organization_id", scope.organizationId)
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

      const now = new Date();
      const freshness = classifyFreshness(now.toISOString(), now);

      if (!existing) {
        const { data: inserted, error } = await context.supabase
          .from("ingested_content_items")
          .insert({
            organization_id: scope.organizationId,
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
            metadata: normalized.metadata,
            freshness_status: freshness,
            current_version_number: 1,
            last_change_at: now.toISOString(),
            last_change_significance: change.significance,
            classification_confidence: classification.confidence,
            classification_signals: classification.signals,
          })
          .select("id")
          .single();
        if (error || !inserted) throw new IntegrationError("persistence_failed", error?.message);
        await recordContentVersion(context.supabase, {
          organizationId: scope.organizationId,
          contentItemId: inserted.id,
          nextVersionNumber: 1,
          contentHash: nextHash,
          title: normalized.title,
          text: normalized.contentText,
          change,
          metadata: { classification: classification.signals },
        });
        return {
          contentItemId: inserted.id,
          created: true,
          changed: true,
          significance: change.significance,
          diff: summarizeDiff(change),
          classification,
        };
      }

      if (!change.changed) {
        // Just refresh last_ingested_at + freshness; no version row.
        await context.supabase
          .from("ingested_content_items")
          .update({ last_ingested_at: now.toISOString(), freshness_status: freshness })
          .eq("id", existing.id);
        return {
          contentItemId: existing.id,
          created: false,
          changed: false,
          significance: "none" as const,
          diff: summarizeDiff(change),
          classification,
        };
      }

      const nextVersion = (existing.current_version_number as number) + 1;
      await recordContentVersion(context.supabase, {
        organizationId: scope.organizationId,
        contentItemId: existing.id,
        nextVersionNumber: nextVersion,
        contentHash: nextHash,
        title: normalized.title,
        text: normalized.contentText,
        change,
        metadata: { classification: classification.signals },
      });
      await context.supabase
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
          classification_signals: classification.signals,
          category: classification.category,
        })
        .eq("id", existing.id);

      return {
        contentItemId: existing.id,
        created: false,
        changed: true,
        significance: change.significance,
        diff: summarizeDiff(change),
        classification,
      };
    } catch (err) {
      if (isIntegrationError(err)) throw err;
      throw new IntegrationError(toIntegrationErrorCode(err));
    }
  });

const RecomputeFreshnessInput = z.object({ organizationId: z.string().uuid() });
export const recomputeFreshness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RecomputeFreshnessInput.parse(input))
  .handler(async ({ data, context }) => {
    const { resolveScope, requireRole } = await import("./auth.server");
    const { recomputeOrgFreshness } = await import("./versions.server");
    const scope = await resolveScope(context.supabase, context.userId, data.organizationId, null);
    requireRole(scope, "member");
    return recomputeOrgFreshness(context.supabase, scope.organizationId);
  });

const ListVersionsInput = z.object({
  organizationId: z.string().uuid(),
  contentItemId: z.string().uuid(),
});
export const listContentVersions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ListVersionsInput.parse(input))
  .handler(async ({ data, context }) => {
    const { resolveScope } = await import("./auth.server");
    const scope = await resolveScope(context.supabase, context.userId, data.organizationId, null);
    const { data: item, error: itemErr } = await context.supabase
      .from("ingested_content_items")
      .select("id, organization_id")
      .eq("id", data.contentItemId)
      .maybeSingle();
    if (itemErr) throw new IntegrationError("internal_error", itemErr.message);
    if (!item || item.organization_id !== scope.organizationId) {
      throw new IntegrationError("forbidden");
    }
    const { data: rows, error } = await context.supabase
      .from("ingested_content_versions")
      .select("id, version_number, content_hash, title, change_significance, diff_summary, captured_at")
      .eq("content_item_id", data.contentItemId)
      .order("version_number", { ascending: false })
      .limit(25);
    if (error) throw new IntegrationError("internal_error", error.message);
    return rows ?? [];
  });