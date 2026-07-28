// Unified Integrations dashboard aggregator.
//
// Server-only. Returns one truthful row per integration used by SAM.
// Never fabricates status; every field is sourced from real config,
// real Supabase rows, or a live provider probe.
//
// Categories: publishing, sam, workspace, knowledge, roadmap.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Supa = SupabaseClient<Database>;

export type IntegrationStatus =
  | "connected"          // live, reachable, publishing-ready
  | "action_needed"      // configured but blocked (armed=false, missing scope, etc.)
  | "not_connected"      // adapter exists, no credentials
  | "not_built"          // adapter not implemented yet
  | "unknown";           // probe failed

export type IntegrationAction =
  | { kind: "none" }
  | { kind: "test"; supported: true }
  | { kind: "manage_link"; href: string; label: string }
  | { kind: "start_meta_oauth" }
  | { kind: "ask_lovable"; message: string };

export interface IntegrationRow {
  key: string;
  label: string;
  category: "publishing" | "sam" | "workspace" | "knowledge" | "roadmap";
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
}

const Input = z.object({ organizationId: z.string().uuid() });

async function lastPublicationFor(
  supabase: Supa,
  organizationId: string,
  platform: string,
): Promise<{ lastActivityAt: string | null; lastErrorAt: string | null; lastErrorMessage: string | null }> {
  // Most recent successful attempt.
  const { data: ok } = await supabase
    .from("social_publication_attempts")
    .select("completed_at, status")
    .eq("organization_id", organizationId)
    .eq("platform", platform)
    .in("status", ["published", "scheduled", "verified"])
    .order("completed_at", { ascending: false })
    .limit(1);
  const { data: err } = await supabase
    .from("social_publication_attempts")
    .select("completed_at, error_code, response_summary, status")
    .eq("organization_id", organizationId)
    .eq("platform", platform)
    .eq("status", "failed")
    .order("completed_at", { ascending: false })
    .limit(1);
  const errRow = err?.[0];
  let errorMsg: string | null = null;
  if (errRow) {
    const summary = errRow.response_summary as { message?: string } | null;
    errorMsg = summary?.message ?? errRow.error_code ?? "Publication failed";
  }
  return {
    lastActivityAt: ok?.[0]?.completed_at ?? null,
    lastErrorAt: errRow?.completed_at ?? null,
    lastErrorMessage: errorMsg,
  };
}

export const listIntegrationsDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => Input.parse(v))
  .handler(async ({ data, context }): Promise<IntegrationRow[]> => {
    const rows: IntegrationRow[] = [];
    const orgId = data.organizationId;

    // ---- Beehiiv ------------------------------------------------------
    try {
      const { validateBeehiivCredentials } = await import("@/lib/social/providers/beehiiv");
      const b = await validateBeehiivCredentials();
      const activity = await lastPublicationFor(context.supabase as Supa, orgId, "beehiiv");
      let status: IntegrationStatus = "not_connected";
      if (!b.configured) status = "not_connected";
      else if (!b.reachable) status = "action_needed";
      else if (!b.armed) status = "action_needed";
      else status = "connected";
      rows.push({
        key: "beehiiv",
        label: "Beehiiv",
        category: "publishing",
        status,
        headline: !b.configured
          ? "Credentials not configured"
          : !b.reachable
            ? "Credentials configured but not responding"
            : !b.armed
              ? "Reachable. Publishing disarmed."
              : "Live and armed",
        detail: b.message,
        identity: b.publicationName,
        armed: b.configured ? b.armed : null,
        lastActivityAt: activity.lastActivityAt,
        lastActivityLabel: activity.lastActivityAt ? "Last publish" : null,
        lastErrorAt: activity.lastErrorAt,
        lastErrorMessage: activity.lastErrorMessage,
        capabilities: { granted: b.grantedCapabilities, missing: b.missingCapabilities },
        adapterVersion: "beehiiv.v0.2.0",
        action: b.configured ? { kind: "test", supported: true } : { kind: "ask_lovable", message: "Ask Lovable to add BEEHIIV_API_KEY and BEEHIIV_PUBLICATION_ID." },
        testable: b.configured,
      });
    } catch (err) {
      rows.push(unknownRow("beehiiv", "Beehiiv", "publishing", (err as Error).message));
    }

    // ---- LinkedIn -----------------------------------------------------
    try {
      const { validateLinkedInCredentials } = await import("@/lib/social/providers/linkedin");
      const l = await validateLinkedInCredentials();
      const activity = await lastPublicationFor(context.supabase as Supa, orgId, "linkedin");
      let status: IntegrationStatus = "not_connected";
      if (!l.configured) status = "not_connected";
      else if (!l.reachable) status = "action_needed";
      else if (!l.armed) status = "action_needed";
      else status = "connected";
      rows.push({
        key: "linkedin",
        label: "LinkedIn",
        category: "publishing",
        status,
        headline: !l.configured
          ? "Not connected"
          : !l.reachable
            ? "Connected but not responding"
            : !l.armed
              ? "Connected. Publishing disarmed."
              : "Live and armed",
        detail: l.message,
        identity: l.displayName ?? l.email,
        armed: l.configured ? l.armed : null,
        lastActivityAt: activity.lastActivityAt,
        lastActivityLabel: activity.lastActivityAt ? "Last publish" : null,
        lastErrorAt: activity.lastErrorAt,
        lastErrorMessage: activity.lastErrorMessage,
        capabilities: { granted: l.grantedCapabilities, missing: l.missingCapabilities },
        adapterVersion: "linkedin.v0.1.0",
        action: l.configured
          ? { kind: "test", supported: true }
          : { kind: "ask_lovable", message: "Ask Lovable to connect the LinkedIn connector for this project." },
        testable: l.configured,
      });
    } catch (err) {
      rows.push(unknownRow("linkedin", "LinkedIn", "publishing", (err as Error).message));
    }

    // ---- Meta (Facebook / Instagram) ---------------------------------
    try {
      const { readMetaConfigStatus } = await import("@/lib/social/providers/meta/config.server");
      const cfg = readMetaConfigStatus();
      const { data: dests } = await context.supabase
        .from("meta_destinations")
        .select("kind, display_name, publish_available, last_capability_reason")
        .eq("organization_id", orgId);
      const fb = (dests ?? []).filter((d) => d.kind === "facebook_page");
      const ig = (dests ?? []).filter((d) => d.kind === "instagram_business");
      for (const [key, label, list] of [
        ["facebook", "Facebook Page", fb] as const,
        ["instagram", "Instagram Business", ig] as const,
      ]) {
        const anyPubReady = list.some((d) => d.publish_available);
        const activity = await lastPublicationFor(context.supabase as Supa, orgId, key);
        const status: IntegrationStatus = !cfg.configured
          ? "action_needed"
          : list.length === 0
            ? "not_connected"
            : anyPubReady
              ? "connected"
              : "action_needed";
        rows.push({
          key,
          label,
          category: "publishing",
          status,
          headline: !cfg.configured
            ? "Meta app credentials required"
            : list.length === 0
              ? "Awaiting account connection"
              : anyPubReady
                ? `Connected: ${list.map((d) => d.display_name).join(", ")}`
                : "Connected but missing publish permission",
          detail: !cfg.configured
            ? `Missing: ${cfg.missing.join(", ")}`
            : list.length === 0
              ? "Start Meta OAuth to connect a Page or IG Business account."
              : list.map((d) => d.last_capability_reason).filter(Boolean).join(" - ") || "Ready.",
          identity: list.map((d) => d.display_name).join(", ") || null,
          armed: cfg.configured && anyPubReady,
          lastActivityAt: activity.lastActivityAt,
          lastActivityLabel: activity.lastActivityAt ? "Last publish" : null,
          lastErrorAt: activity.lastErrorAt,
          lastErrorMessage: activity.lastErrorMessage,
          capabilities: { granted: [], missing: !cfg.configured ? cfg.missing : [] },
          adapterVersion: `${key}.v0.1.0-framework`,
          action: cfg.configured
            ? { kind: "start_meta_oauth" }
            : { kind: "ask_lovable", message: "Ask Lovable to add Meta app credentials (App ID and Secret)." },
          testable: false,
        });
      }
    } catch (err) {
      rows.push(unknownRow("facebook", "Facebook Page", "publishing", (err as Error).message));
      rows.push(unknownRow("instagram", "Instagram Business", "publishing", (err as Error).message));
    }

    // ---- Not-yet-built social ----------------------------------------
    for (const p of [
      { key: "x", label: "X" },
      { key: "reddit", label: "Reddit" },
    ] as const) {
      rows.push({
        key: p.key,
        label: p.label,
        category: "roadmap",
        status: "not_built",
        headline: "Not implemented yet",
        detail: `${p.label} publishing is on the roadmap. No credentials collected, no publish path armed.`,
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
      });
    }

    // ---- SAM MCP ------------------------------------------------------
    try {
      const { data: mcp } = await context.supabase
        .from("sam_mcp_connections")
        .select("status, server_url, last_connected_at, last_error, last_error_at")
        .eq("organization_id", orgId)
        .order("updated_at", { ascending: false })
        .limit(1);
      const m = mcp?.[0] as
        | { status?: string; server_url?: string; last_connected_at?: string | null; last_error?: string | null; last_error_at?: string | null }
        | undefined;
      const status: IntegrationStatus = !m
        ? "not_connected"
        : m.status === "connected"
          ? "connected"
          : m.status === "error"
            ? "action_needed"
            : "not_connected";
      rows.push({
        key: "sam_mcp",
        label: "SAM MCP Server",
        category: "sam",
        status,
        headline: !m ? "Not connected" : m.status === "connected" ? "Connected" : m.status === "error" ? "Error" : "Configured",
        detail: m?.server_url ?? "Connect a SAM MCP server URL and API key.",
        identity: m?.server_url ?? null,
        armed: null,
        lastActivityAt: m?.last_connected_at ?? null,
        lastActivityLabel: m?.last_connected_at ? "Last connected" : null,
        lastErrorAt: m?.last_error_at ?? null,
        lastErrorMessage: m?.last_error ?? null,
        capabilities: { granted: [], missing: [] },
        adapterVersion: "sam-mcp.v1",
        action: { kind: "manage_link", href: "/sam/integrations#sam-mcp", label: "Manage" },
        testable: false,
      });
    } catch {
      // ignore; table may be empty
    }

    // ---- Website / knowledge ingestion -------------------------------
    try {
      const { count: siteCount } = await context.supabase
        .from("integration_connections")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("status", "active");
      rows.push({
        key: "website",
        label: "Website & Knowledge Sources",
        category: "knowledge",
        status: (siteCount ?? 0) > 0 ? "connected" : "not_connected",
        headline: (siteCount ?? 0) > 0 ? `${siteCount} active source${siteCount === 1 ? "" : "s"}` : "No sources configured",
        detail: "Websites, sitemaps, APIs, and files SAM ingests as knowledge.",
        identity: null,
        armed: null,
        lastActivityAt: null,
        lastActivityLabel: null,
        lastErrorAt: null,
        lastErrorMessage: null,
        capabilities: { granted: [], missing: [] },
        adapterVersion: "ingest.v1",
        action: { kind: "manage_link", href: "/settings/integrations", label: "Manage sources" },
        testable: false,
      });
    } catch {
      // ignore
    }

    return rows;
  });

function unknownRow(
  key: string,
  label: string,
  category: IntegrationRow["category"],
  msg: string,
): IntegrationRow {
  return {
    key,
    label,
    category,
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
  };
}

// -----------------------------------------------------------------------
// Test Connection
// -----------------------------------------------------------------------

const TestInput = z.object({
  organizationId: z.string().uuid(),
  key: z.enum(["beehiiv", "linkedin"]),
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
  .handler(async ({ data }): Promise<TestConnectionResult> => {
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
  });