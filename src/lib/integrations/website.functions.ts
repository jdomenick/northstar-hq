// Client-callable server functions for website integrations (Phase 3D.2a).
// All handlers run behind requireSupabaseAuth; the client cannot forge
// organization_id - the server derives scope from the caller's membership.
// No provider synthesis is used; scoring and classification are deterministic.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { INTEGRATION_LIMITS } from "@/lib/constants";
import { IntegrationError, isIntegrationError, toIntegrationErrorCode } from "./errors";

const AutomationMode = z.enum(["suggest", "auto_accept", "off"]);

const CreateWebsiteConnectionInput = z.object({
  organizationId: z.string().uuid(),
  ventureId: z.string().uuid().nullable().optional(),
  displayName: z.string().min(1).max(200),
  homepageUrl: z.string().url().max(2048),
  automationMode: AutomationMode.default("suggest"),
});

export const createWebsiteConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateWebsiteConnectionInput.parse(input))
  .handler(async ({ data, context }) => {
    try {
      const { validatePublicUrl } = await import("./connectors/website/url-safety.server");
      const { resolveScope, requireRole } = await import("./auth.server");
      const home = validatePublicUrl(data.homepageUrl);
      const scope = await resolveScope(
        context.supabase,
        context.userId,
        data.organizationId,
        data.ventureId ?? null,
      );
      requireRole(scope, "member");

      const { count } = await context.supabase
        .from("integration_connections")
        .select("id", { head: true, count: "exact" })
        .eq("organization_id", scope.organizationId)
        .eq("provider", "website")
        .is("deleted_at", null);
      if ((count ?? 0) >= INTEGRATION_LIMITS.maxConnectionsList) {
        throw new IntegrationError("blocked_by_policy", "Connection limit reached");
      }

      const { data: row, error } = await context.supabase
        .from("integration_connections")
        .insert({
          organization_id: scope.organizationId,
          venture_id: scope.ventureId,
          provider: "website",
          connection_type: "website",
          display_name: data.displayName.trim(),
          homepage_url: home.href,
          automation_mode: data.automationMode,
          status: "pending",
          discovery_status: "pending",
          settings: { origin: home.origin },
          created_by: context.userId,
        })
        .select("id")
        .single();
      if (error || !row) throw new IntegrationError("persistence_failed", error?.message);
      return { connectionId: row.id as string };
    } catch (err) {
      if (isIntegrationError(err)) throw err;
      throw new IntegrationError(toIntegrationErrorCode(err));
    }
  });

const ListInput = z.object({ organizationId: z.string().uuid() });
export const listWebsiteConnections = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ListInput.parse(input))
  .handler(async ({ data, context }) => {
    const { resolveScope } = await import("./auth.server");
    await resolveScope(context.supabase, context.userId, data.organizationId, null);
    const { data: rows, error } = await context.supabase
      .from("integration_connections")
      .select("id, display_name, homepage_url, status, discovery_status, discovery_completed_at, discovery_error_code, automation_mode, venture_id, last_successful_sync_at, created_at")
      .eq("organization_id", data.organizationId)
      .eq("provider", "website")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(INTEGRATION_LIMITS.maxConnectionsList);
    if (error) throw new IntegrationError("internal_error", error.message);
    return rows ?? [];
  });

const GetInput = z.object({ organizationId: z.string().uuid(), connectionId: z.string().uuid() });
export const getWebsiteConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => GetInput.parse(input))
  .handler(async ({ data, context }) => {
    const { resolveScope, requireConnectionAccess } = await import("./auth.server");
    const scope = await resolveScope(context.supabase, context.userId, data.organizationId, null);
    const connection = await requireConnectionAccess(context.supabase, data.connectionId, scope);
    const [{ data: sources }, { data: runs }] = await Promise.all([
      context.supabase
        .from("integration_sources")
        .select("id, source_url, title, page_type, category, relevance_score, http_status, discovered_at, sync_enabled")
        .eq("connection_id", data.connectionId)
        .is("deleted_at", null)
        .order("relevance_score", { ascending: false })
        .limit(INTEGRATION_LIMITS.maxSourcesList),
      context.supabase
        .from("integration_sync_runs")
        .select("id, status, trigger_type, started_at, completed_at, duration_ms, records_discovered, records_created, records_skipped, failure_code, failure_message")
        .eq("connection_id", data.connectionId)
        .order("created_at", { ascending: false })
        .limit(INTEGRATION_LIMITS.maxSyncRunsList),
    ]);
    return { connection, sources: sources ?? [], runs: runs ?? [] };
  });

const RunDiscoveryInput = z.object({ organizationId: z.string().uuid(), connectionId: z.string().uuid() });
export const runWebsiteDiscoveryNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RunDiscoveryInput.parse(input))
  .handler(async ({ data, context }) => {
    const { resolveScope, requireRole, requireConnectionAccess } = await import("./auth.server");
    const { openSyncRun, closeSyncRun, stampConnectionSync } = await import("./audit.server");
    const { runWebsiteDiscovery } = await import("./connectors/website/discovery.server");

    const scope = await resolveScope(context.supabase, context.userId, data.organizationId, null);
    requireRole(scope, "member");
    const connection = await requireConnectionAccess(context.supabase, data.connectionId, scope);

    if (connection.discovery_status === "running") {
      throw new IntegrationError("sync_in_progress", "Discovery already in progress");
    }
    if (!connection.homepage_url) {
      throw new IntegrationError("invalid_input", "Connection has no homepage URL");
    }

    // Manual rate limit: guard against rapid re-runs.
    if (connection.last_sync_at) {
      const since = Date.now() - new Date(connection.last_sync_at).getTime();
      if (since < INTEGRATION_LIMITS.manualSyncMinIntervalMs) {
        throw new IntegrationError("sync_rate_limited", "Please wait a moment before running discovery again");
      }
    }

    // Mark discovery running.
    await context.supabase
      .from("integration_connections")
      .update({ discovery_status: "running", discovery_error_code: null })
      .eq("id", connection.id);

    const run = await openSyncRun(context.supabase, {
      organizationId: scope.organizationId,
      connectionId: connection.id,
      sourceId: null,
      triggeredBy: context.userId,
      triggerType: "manual",
      metadata: { phase: "discovery" },
    });
    const startedAtMs = new Date(run.startedAt).getTime();

    try {
      const result = await runWebsiteDiscovery(context.supabase, {
        organizationId: scope.organizationId,
        ventureId: connection.venture_id ?? null,
        connectionId: connection.id,
        runId: run.id,
        homepageUrl: connection.homepage_url,
      });

      const durationMs = Date.now() - startedAtMs;
      await closeSyncRun(context.supabase, {
        runId: run.id,
        status: "succeeded",
        summary: {
          discovered: result.totalCandidates,
          created: result.totalCreated,
          updated: 0,
          skipped: result.totalSkipped,
          failed: 0,
          durationMs,
        },
        metadata: {
          sitemapsFetched: result.sitemapsFetched,
          crawlPagesFetched: result.crawlPagesFetched,
          totalKept: result.totalKept,
        },
      });
      await stampConnectionSync(context.supabase, connection.id, { successful: true });
      await context.supabase
        .from("integration_connections")
        .update({
          discovery_status: "completed",
          discovery_completed_at: new Date().toISOString(),
          discovery_last_run_id: run.id,
          discovery_error_code: null,
        })
        .eq("id", connection.id);
      return { ...result, runId: run.id };
    } catch (err) {
      const code = toIntegrationErrorCode(err);
      const durationMs = Date.now() - startedAtMs;
      await closeSyncRun(context.supabase, {
        runId: run.id,
        status: "failed",
        summary: { discovered: 0, created: 0, updated: 0, skipped: 0, failed: 1, durationMs },
        failureCode: code,
        failureMessage: null,
      });
      await stampConnectionSync(context.supabase, connection.id, { successful: false, errorCode: code });
      await context.supabase
        .from("integration_connections")
        .update({
          discovery_status: "failed",
          discovery_completed_at: new Date().toISOString(),
          discovery_last_run_id: run.id,
          discovery_error_code: code,
        })
        .eq("id", connection.id);
      throw new IntegrationError(code);
    }
  });

const UpdateAutomationInput = z.object({
  organizationId: z.string().uuid(),
  connectionId: z.string().uuid(),
  automationMode: AutomationMode,
});
export const updateConnectionAutomation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateAutomationInput.parse(input))
  .handler(async ({ data, context }) => {
    const { resolveScope, requireRole, requireConnectionAccess } = await import("./auth.server");
    const scope = await resolveScope(context.supabase, context.userId, data.organizationId, null);
    requireRole(scope, "member");
    const connection = await requireConnectionAccess(context.supabase, data.connectionId, scope);
    const { error } = await context.supabase
      .from("integration_connections")
      .update({ automation_mode: data.automationMode })
      .eq("id", connection.id);
    if (error) throw new IntegrationError("persistence_failed", error.message);
    return { ok: true };
  });

const ArchiveInput = z.object({ organizationId: z.string().uuid(), connectionId: z.string().uuid() });
export const archiveWebsiteConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ArchiveInput.parse(input))
  .handler(async ({ data, context }) => {
    const { resolveScope, requireRole, requireConnectionAccess } = await import("./auth.server");
    const scope = await resolveScope(context.supabase, context.userId, data.organizationId, null);
    requireRole(scope, "admin");
    const connection = await requireConnectionAccess(context.supabase, data.connectionId, scope);
    const { error } = await context.supabase
      .from("integration_connections")
      .update({ status: "archived", deleted_at: new Date().toISOString() })
      .eq("id", connection.id);
    if (error) throw new IntegrationError("persistence_failed", error.message);
    return { ok: true };
  });