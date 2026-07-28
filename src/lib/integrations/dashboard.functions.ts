// Unified Integrations dashboard aggregator.
//
// Server-only. Iterates INTEGRATION_PROVIDERS and dispatches to a truthful
// probe. Never fabricates status; every field is sourced from real config,
// live provider calls, or real database rows.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  INTEGRATION_PROVIDERS,
  getProvider,
  type IntegrationCategory,
  type ProviderDefinition,
} from "./providers";
import { deriveExecutiveAction, type ExecutiveAction } from "./executive-action";
import {
  probeBeehiiv,
  probeLinkedIn,
  probeMeta,
  probeEnvOnly,
  probeStripe,
  probeSupabaseSelf,
  probeSamMcp,
  probeWebsiteSources,
  probeWebhooks,
  probeRestEndpoints,
  type ProbeResult,
  type ProviderStatus,
  type IntegrationDiagnostics,
} from "./probes.server";

type Supa = SupabaseClient<Database>;

export type IntegrationStatus = ProviderStatus;

export type IntegrationAction =
  | { kind: "none" }
  | { kind: "test"; supported: true }
  | { kind: "manage_link"; href: string; label: string }
  | { kind: "start_meta_oauth" }
  | { kind: "ask_lovable"; message: string };

export interface IntegrationRow {
  key: string;
  label: string;
  category: IntegrationCategory;
  status: IntegrationStatus;
  headline: string;
  detail: string;
  identity: string | null;
  armed: boolean | null;
  lastActivityAt: string | null;
  lastActivityLabel: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
  capabilities: { granted: string[]; missing: string[] };
  adapterVersion: string | null;
  action: IntegrationAction;
  testable: boolean;
  description: string;
  docsUrl: string | null;
  externalStep: string | null;
  approvalRequired: boolean;
  declaredCapabilities: string[];
  diagnostics: IntegrationDiagnostics | null;
  executiveAction: ExecutiveAction;
}

const Input = z.object({ organizationId: z.string().uuid() });

function actionFor(def: ProviderDefinition, probe: ProbeResult): IntegrationAction {
  if (def.key === "facebook" || def.key === "instagram") {
    return { kind: "start_meta_oauth" };
  }
  if (def.managePath) {
    return { kind: "manage_link", href: def.managePath, label: "Manage" };
  }
  if (probe.testable) return { kind: "test", supported: true };
  if (probe.status === "awaiting_credentials" || probe.status === "awaiting_oauth_configuration") {
    return {
      kind: "ask_lovable",
      message: def.externalStep ?? "Ask Lovable to configure this integration.",
    };
  }
  return { kind: "none" };
}

async function probeFor(def: ProviderDefinition, supabase: Supa, orgId: string): Promise<ProbeResult> {
  switch (def.key) {
    case "beehiiv": return probeBeehiiv(supabase, orgId);
    case "linkedin": return probeLinkedIn(supabase, orgId);
    case "facebook": return probeMeta(supabase, orgId, "facebook_page");
    case "instagram": return probeMeta(supabase, orgId, "instagram_business");
    case "stripe": return probeStripe();
    case "supabase_self": return probeSupabaseSelf();
    case "sam_mcp": return probeSamMcp(supabase, orgId);
    case "website_sync": return probeWebsiteSources(supabase, orgId);
    case "webhooks": return probeWebhooks(supabase, orgId);
    case "rest_endpoints": return probeRestEndpoints(supabase, orgId);
    default: return probeEnvOnly(def);
  }
}

function unknownRow(def: ProviderDefinition, msg: string): IntegrationRow {
  return {
    key: def.key,
    label: def.label,
    category: def.category,
    status: "unknown",
    headline: "Status check failed",
    detail: msg,
    identity: null,
    armed: null,
    lastActivityAt: null,
    lastActivityLabel: null,
    lastErrorAt: null,
    lastErrorMessage: null,
    capabilities: { granted: [], missing: [] },
    adapterVersion: null,
    action: { kind: "none" },
    testable: false,
    description: def.description,
    docsUrl: def.docsUrl ?? null,
    externalStep: def.externalStep ?? null,
    approvalRequired: def.approvalRequired ?? false,
    declaredCapabilities: def.capabilities,
    diagnostics: null,
    executiveAction: {
      health: "error",
      actionRequired: true,
      title: "Status check failed",
      issue: msg,
      nextStep: "Retry from the Integrations dashboard. If it persists, open Details for logs.",
      impact: "medium",
      href: null,
    },
  };
}

export const listIntegrationsDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => Input.parse(v))
  .handler(async ({ data, context }): Promise<IntegrationRow[]> => {
    const supabase = context.supabase as Supa;
    const orgId = data.organizationId;
    const rows = await Promise.all(
      INTEGRATION_PROVIDERS.map(async (def) => {
        try {
          const p = await probeFor(def, supabase, orgId);
          return {
            key: def.key,
            label: def.label,
            category: def.category,
            status: p.status,
            headline: p.headline,
            detail: p.detail,
            identity: p.identity,
            armed: p.armed,
            lastActivityAt: p.lastActivityAt,
            lastActivityLabel: p.lastActivityLabel,
            lastErrorAt: p.lastErrorAt,
            lastErrorMessage: p.lastErrorMessage,
            capabilities: { granted: p.grantedCapabilities, missing: p.missingCapabilities },
            adapterVersion: p.adapterVersion,
            action: actionFor(def, p),
            testable: p.testable,
            description: def.description,
            docsUrl: def.docsUrl ?? null,
            externalStep: def.externalStep ?? null,
            approvalRequired: def.approvalRequired ?? false,
            declaredCapabilities: def.capabilities,
            diagnostics: p.diagnostics ?? null,
            executiveAction: deriveExecutiveAction(def, p),
          } satisfies IntegrationRow;
        } catch (err) {
          return unknownRow(def, (err as Error).message);
        }
      }),
    );
    return rows;
  });

// -----------------------------------------------------------------------
// Detail: same as row + activity log (last 20 events across the platform)
// -----------------------------------------------------------------------
const DetailInput = z.object({ organizationId: z.string().uuid(), key: z.string().min(1) });

export interface ActivityEvent {
  at: string;
  kind: string;
  outcome: "success" | "error" | "info";
  message: string;
}

export interface IntegrationDetail {
  row: IntegrationRow;
  activity: ActivityEvent[];
  requiredEnv: string[];
  optionalEnv: string[];
  requiredScopes: string[];
  approvalStatus: string | null;
}

export const getIntegrationDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => DetailInput.parse(v))
  .handler(async ({ data, context }): Promise<IntegrationDetail | null> => {
    const def = getProvider(data.key);
    if (!def) return null;
    const supabase = context.supabase as Supa;
    const orgId = data.organizationId;
    let probe: ProbeResult;
    try {
      probe = await probeFor(def, supabase, orgId);
    } catch (err) {
      return { row: unknownRow(def, (err as Error).message), activity: [], requiredEnv: def.requiredEnv ?? [], optionalEnv: def.optionalEnv ?? [], requiredScopes: def.requiredScopes ?? [], approvalStatus: def.approvalStatus ?? null };
    }
    const row: IntegrationRow = {
      key: def.key,
      label: def.label,
      category: def.category,
      status: probe.status,
      headline: probe.headline,
      detail: probe.detail,
      identity: probe.identity,
      armed: probe.armed,
      lastActivityAt: probe.lastActivityAt,
      lastActivityLabel: probe.lastActivityLabel,
      lastErrorAt: probe.lastErrorAt,
      lastErrorMessage: probe.lastErrorMessage,
      capabilities: { granted: probe.grantedCapabilities, missing: probe.missingCapabilities },
      adapterVersion: probe.adapterVersion,
      action: actionFor(def, probe),
      testable: probe.testable,
      description: def.description,
      docsUrl: def.docsUrl ?? null,
      externalStep: def.externalStep ?? null,
      approvalRequired: def.approvalRequired ?? false,
      declaredCapabilities: def.capabilities,
      diagnostics: probe.diagnostics ?? null,
      executiveAction: deriveExecutiveAction(def, probe),
    };
    const activity = await loadActivity(supabase, orgId, def);
    return {
      row,
      activity,
      requiredEnv: def.requiredEnv ?? [],
      optionalEnv: def.optionalEnv ?? [],
      requiredScopes: def.requiredScopes ?? [],
      approvalStatus: def.approvalStatus ?? null,
    };
  });

async function loadActivity(
  supabase: Supa,
  orgId: string,
  def: ProviderDefinition,
): Promise<ActivityEvent[]> {
  // Publishing providers: read from social_publication_attempts.
  if (["beehiiv", "linkedin", "facebook", "instagram", "x", "reddit"].includes(def.key)) {
    const platform = def.key;
    const { data } = await supabase
      .from("social_publication_attempts")
      .select("completed_at, status, error_code, response_summary, external_post_id")
      .eq("organization_id", orgId)
      .eq("platform", platform)
      .order("completed_at", { ascending: false })
      .limit(20);
    return (data ?? []).map((r) => {
      const summary = r.response_summary as { message?: string } | null;
      const outcome: ActivityEvent["outcome"] =
        r.status === "published" || r.status === "verified" || r.status === "scheduled"
          ? "success"
          : r.status === "failed"
            ? "error"
            : "info";
      return {
        at: r.completed_at ?? new Date().toISOString(),
        kind: r.status ?? "attempt",
        outcome,
        message: summary?.message ?? r.error_code ?? (r.external_post_id ? `Post ${r.external_post_id}` : "publish attempt"),
      };
    });
  }
  if (def.key === "webhooks") {
    const { data } = await supabase
      .from("integration_webhook_deliveries")
      .select("delivered_at, event_type, status_code, error")
      .eq("organization_id", orgId)
      .order("delivered_at", { ascending: false })
      .limit(20);
    return (data ?? []).map((r) => ({
      at: r.delivered_at ?? new Date().toISOString(),
      kind: r.event_type ?? "delivery",
      outcome: r.error || (r.status_code && r.status_code >= 400) ? "error" : "success",
      message: r.error ?? `HTTP ${r.status_code ?? "?"}`,
    }));
  }
  if (def.key === "website_sync") {
    const { data } = await supabase
      .from("integration_sync_runs")
      .select("started_at, completed_at, status, trigger_type, records_discovered, records_created, records_failed, failure_message")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(20);
    return (data ?? []).map((r) => {
      const outcome: ActivityEvent["outcome"] =
        r.status === "succeeded" ? "success"
        : r.status === "failed" ? "error"
        : "info";
      const parts = [
        r.trigger_type ? `${r.trigger_type} sync` : "sync",
        `${r.records_created ?? 0}/${r.records_discovered ?? 0} indexed`,
      ];
      if ((r.records_failed ?? 0) > 0) parts.push(`${r.records_failed} failed`);
      if (r.failure_message) parts.push(r.failure_message);
      return {
        at: r.completed_at ?? r.started_at ?? new Date().toISOString(),
        kind: r.status ?? "sync",
        outcome,
        message: parts.join(" - "),
      };
    });
  }
  if (def.key === "sam_mcp") {
    const { data } = await supabase
      .from("sam_mcp_connections")
      .select("last_success_at, last_tested_at, last_error_message, last_error_code, status")
      .eq("organization_id", orgId)
      .limit(1);
    const m = data?.[0];
    if (!m) return [];
    const events: ActivityEvent[] = [];
    if (m.last_success_at) events.push({ at: m.last_success_at, kind: "connected", outcome: "success", message: `Status: ${m.status}` });
    if (m.last_tested_at && m.last_error_message) events.push({ at: m.last_tested_at, kind: m.last_error_code ?? "error", outcome: "error", message: m.last_error_message });
    return events;
  }
  return [];
}

// -----------------------------------------------------------------------
// Test Connection
// -----------------------------------------------------------------------

const TestInput = z.object({
  organizationId: z.string().uuid(),
  key: z.enum(["beehiiv", "linkedin", "stripe", "supabase_self", "sam_mcp", "website_sync"]),
});

export interface TestConnectionResult {
  key: string;
  ok: boolean;
  reachable: boolean;
  headline: string;
  detail: string;
  identity: string | null;
  latencyMs: number;
}

export const testIntegrationConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => TestInput.parse(v))
  .handler(async ({ data, context }): Promise<TestConnectionResult> => {
    const t0 = Date.now();
    if (data.key === "beehiiv") {
      const { validateBeehiivCredentials } = await import("@/lib/social/providers/beehiiv");
      const b = await validateBeehiivCredentials();
      return {
        key: "beehiiv",
        ok: b.configured && b.reachable,
        reachable: b.reachable,
        headline: b.reachable ? "Beehiiv reachable" : "Beehiiv not reachable",
        detail: b.message,
        identity: b.publicationName,
        latencyMs: Date.now() - t0,
      };
    }
    if (data.key === "linkedin") {
      const { validateLinkedInCredentials } = await import("@/lib/social/providers/linkedin");
      const l = await validateLinkedInCredentials();
      return {
        key: "linkedin",
        ok: l.configured && l.reachable,
        reachable: l.reachable,
        headline: l.reachable ? "LinkedIn reachable" : "LinkedIn not reachable",
        detail: l.message,
        identity: l.displayName ?? l.email,
        latencyMs: Date.now() - t0,
      };
    }
    if (data.key === "stripe") {
      const p = await probeStripe();
      return {
        key: "stripe",
        ok: p.status === "connected",
        reachable: p.status !== "awaiting_credentials",
        headline: p.headline,
        detail: p.detail,
        identity: p.identity,
        latencyMs: Date.now() - t0,
      };
    }
    if (data.key === "sam_mcp") {
      const p = await probeSamMcp(context.supabase as Supa, data.organizationId);
      return {
        key: "sam_mcp",
        ok: p.status === "connected",
        reachable: p.status === "connected" || p.status === "action_needed",
        headline: p.headline,
        detail: p.detail,
        identity: p.identity,
        latencyMs: Date.now() - t0,
      };
    }
    if (data.key === "website_sync") {
      const p = await probeWebsiteSources(context.supabase as Supa, data.organizationId);
      return {
        key: "website_sync",
        ok: p.status === "connected",
        reachable: p.status !== "not_configured",
        headline: p.headline,
        detail: p.detail,
        identity: p.identity,
        latencyMs: Date.now() - t0,
      };
    }
    const p = probeSupabaseSelf();
    return {
      key: "supabase_self",
      ok: p.status === "connected",
      reachable: p.status === "connected",
      headline: p.headline,
      detail: p.detail,
      identity: p.identity,
      latencyMs: Date.now() - t0,
    };
  });