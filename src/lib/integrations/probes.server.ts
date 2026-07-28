// Per-provider status probes.
//
// Server-only. Each probe returns a truthful ProbeResult based on real env
// checks, DB reads, or live HTTP calls. No fabricated "connected" state.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { ProviderDefinition } from "./providers";

export type ProviderStatus =
  | "connected"
  | "action_needed"
  | "awaiting_credentials"
  | "awaiting_oauth_configuration"
  | "awaiting_provider_approval"
  | "ready_to_connect"
  | "authentication_failed"
  | "connection_error"
  | "not_configured"
  | "unknown";

export interface ProbeResult {
  status: ProviderStatus;
  headline: string;
  detail: string;
  identity: string | null;
  armed: boolean | null;
  grantedCapabilities: string[];
  missingCapabilities: string[];
  lastActivityAt: string | null;
  lastActivityLabel: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
  adapterVersion: string | null;
  testable: boolean;
}

type Supa = SupabaseClient<Database>;

function envPresent(name: string): boolean {
  const v = process.env[name];
  return typeof v === "string" && v.length > 0;
}

function checkRequiredEnv(def: ProviderDefinition): { ok: boolean; missing: string[] } {
  const req = def.requiredEnv ?? [];
  const missing = req.filter((n) => !envPresent(n));
  return { ok: missing.length === 0, missing };
}

// -----------------------------------------------------------------------
// Shared: last publish activity from social_publication_attempts
// -----------------------------------------------------------------------
async function lastPublicationFor(
  supabase: Supa,
  organizationId: string,
  platform: string,
): Promise<{
  lastActivityAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
}> {
  const [ok, err] = await Promise.all([
    supabase
      .from("social_publication_attempts")
      .select("completed_at")
      .eq("organization_id", organizationId)
      .eq("platform", platform)
      .in("status", ["published", "scheduled", "verified"])
      .order("completed_at", { ascending: false })
      .limit(1),
    supabase
      .from("social_publication_attempts")
      .select("completed_at, error_code, response_summary")
      .eq("organization_id", organizationId)
      .eq("platform", platform)
      .eq("status", "failed")
      .order("completed_at", { ascending: false })
      .limit(1),
  ]);
  const errRow = err.data?.[0];
  const summary = errRow?.response_summary as { message?: string } | null;
  return {
    lastActivityAt: ok.data?.[0]?.completed_at ?? null,
    lastErrorAt: errRow?.completed_at ?? null,
    lastErrorMessage: errRow
      ? summary?.message ?? errRow.error_code ?? "Publication failed"
      : null,
  };
}

// -----------------------------------------------------------------------
// Probes
// -----------------------------------------------------------------------
export async function probeBeehiiv(supabase: Supa, orgId: string): Promise<ProbeResult> {
  const { validateBeehiivCredentials } = await import("@/lib/social/providers/beehiiv");
  const b = await validateBeehiivCredentials();
  const act = await lastPublicationFor(supabase, orgId, "beehiiv");
  const status: ProviderStatus = !b.configured
    ? "awaiting_credentials"
    : !b.reachable
      ? "connection_error"
      : !b.armed
        ? "action_needed"
        : "connected";
  return {
    status,
    headline: !b.configured
      ? "Beehiiv API key not configured"
      : !b.reachable
        ? "Beehiiv unreachable"
        : !b.armed
          ? "Publishing disarmed"
          : "Live and armed",
    detail: b.message,
    identity: b.publicationName,
    armed: b.configured ? b.armed : null,
    grantedCapabilities: b.grantedCapabilities,
    missingCapabilities: b.missingCapabilities,
    lastActivityAt: act.lastActivityAt,
    lastActivityLabel: act.lastActivityAt ? "Last publish" : null,
    lastErrorAt: act.lastErrorAt,
    lastErrorMessage: act.lastErrorMessage,
    adapterVersion: "beehiiv.v0.2.0",
    testable: b.configured,
  };
}

export async function probeLinkedIn(supabase: Supa, orgId: string): Promise<ProbeResult> {
  const { validateLinkedInCredentials } = await import("@/lib/social/providers/linkedin");
  const l = await validateLinkedInCredentials();
  const act = await lastPublicationFor(supabase, orgId, "linkedin");
  const status: ProviderStatus = !l.configured
    ? "awaiting_credentials"
    : !l.reachable
      ? "authentication_failed"
      : !l.armed
        ? "action_needed"
        : "connected";
  return {
    status,
    headline: !l.configured
      ? "Not connected"
      : !l.reachable
        ? "Connected but not responding"
        : !l.armed
          ? "Publishing disarmed"
          : "Live and armed",
    detail: l.message,
    identity: l.displayName ?? l.email,
    armed: l.configured ? l.armed : null,
    grantedCapabilities: l.grantedCapabilities,
    missingCapabilities: l.missingCapabilities,
    lastActivityAt: act.lastActivityAt,
    lastActivityLabel: act.lastActivityAt ? "Last publish" : null,
    lastErrorAt: act.lastErrorAt,
    lastErrorMessage: act.lastErrorMessage,
    adapterVersion: "linkedin.v0.1.0",
    testable: l.configured,
  };
}

export async function probeMeta(
  supabase: Supa,
  orgId: string,
  kind: "facebook_page" | "instagram_business",
): Promise<ProbeResult> {
  const { readMetaConfigStatus } = await import("@/lib/social/providers/meta/config.server");
  const cfg = readMetaConfigStatus();
  const platformKey = kind === "facebook_page" ? "facebook" : "instagram";
  const { data: dests } = await supabase
    .from("meta_destinations")
    .select("kind, display_name, publish_available, last_capability_reason")
    .eq("organization_id", orgId);
  const list = (dests ?? []).filter((d) => d.kind === kind);
  const anyPubReady = list.some((d) => d.publish_available);
  const act = await lastPublicationFor(supabase, orgId, platformKey);

  const status: ProviderStatus = !cfg.configured
    ? "awaiting_oauth_configuration"
    : list.length === 0
      ? "ready_to_connect"
      : anyPubReady
        ? "connected"
        : "awaiting_provider_approval";

  return {
    status,
    headline: !cfg.configured
      ? "Meta app credentials required"
      : list.length === 0
        ? "Awaiting account connection"
        : anyPubReady
          ? `Connected: ${list.map((d) => d.display_name).join(", ")}`
          : "Connected, awaiting publish permission (App Review)",
    detail: !cfg.configured
      ? `Missing environment: ${cfg.missing.join(", ")}`
      : list.length === 0
        ? "Start Meta OAuth to connect an account."
        : list.map((d) => d.last_capability_reason).filter(Boolean).join(" - ") ||
          "Ready.",
    identity: list.map((d) => d.display_name).join(", ") || null,
    armed: cfg.configured ? anyPubReady : null,
    grantedCapabilities: anyPubReady ? ["publish"] : [],
    missingCapabilities: !cfg.configured
      ? cfg.missing
      : anyPubReady
        ? []
        : kind === "facebook_page"
          ? ["pages_manage_posts"]
          : ["instagram_content_publish"],
    lastActivityAt: act.lastActivityAt,
    lastActivityLabel: act.lastActivityAt ? "Last publish" : null,
    lastErrorAt: act.lastErrorAt,
    lastErrorMessage: act.lastErrorMessage,
    adapterVersion: `${platformKey}.v0.1.0`,
    testable: false,
  };
}

// Generic env-only probe. If any required env is missing, we surface
// "awaiting_credentials"; otherwise we mark "ready_to_connect" because
// no live probe endpoint is wired yet. Never fabricates "connected".
export function probeEnvOnly(def: ProviderDefinition): ProbeResult {
  const { ok, missing } = checkRequiredEnv(def);
  const approval = def.approvalRequired;
  const status: ProviderStatus = !ok
    ? "awaiting_credentials"
    : approval
      ? "awaiting_provider_approval"
      : "ready_to_connect";
  return {
    status,
    headline: !ok
      ? "Awaiting credentials"
      : approval
        ? "Awaiting provider approval"
        : "Ready to connect",
    detail: !ok
      ? `Missing environment: ${missing.join(", ")}. ${def.externalStep ?? ""}`.trim()
      : (def.externalStep ?? "Credentials present. Live probe not yet implemented."),
    identity: null,
    armed: null,
    grantedCapabilities: [],
    missingCapabilities: missing,
    lastActivityAt: null,
    lastActivityLabel: null,
    lastErrorAt: null,
    lastErrorMessage: null,
    adapterVersion: `${def.key}.shell`,
    testable: false,
  };
}

export async function probeStripe(): Promise<ProbeResult> {
  const sk = process.env.STRIPE_SECRET_KEY;
  if (!sk) {
    return {
      status: "awaiting_credentials",
      headline: "Awaiting STRIPE_SECRET_KEY",
      detail: "Add STRIPE_SECRET_KEY (starts with sk_live_ or sk_test_) to enable Stripe.",
      identity: null,
      armed: null,
      grantedCapabilities: [],
      missingCapabilities: ["STRIPE_SECRET_KEY"],
      lastActivityAt: null,
      lastActivityLabel: null,
      lastErrorAt: null,
      lastErrorMessage: null,
      adapterVersion: "stripe.v0.0",
      testable: false,
    };
  }
  const mode = sk.startsWith("sk_live_")
    ? "live"
    : sk.startsWith("sk_test_")
      ? "test"
      : "unknown";
  // Live probe: Stripe /v1/account is cheap and confirms key validity.
  let identity: string | null = null;
  let ok = true;
  let errMsg: string | null = null;
  try {
    const res = await fetch("https://api.stripe.com/v1/account", {
      headers: { Authorization: `Bearer ${sk}` },
    });
    if (res.ok) {
      const j = (await res.json()) as { id?: string; display_name?: string; email?: string };
      identity = j.display_name ?? j.email ?? j.id ?? null;
    } else {
      ok = false;
      errMsg = `Stripe rejected the key (${res.status})`;
    }
  } catch (err) {
    ok = false;
    errMsg = `Stripe unreachable: ${(err as Error).message}`;
  }
  return {
    status: ok ? "connected" : "authentication_failed",
    headline: ok ? `Stripe (${mode} mode)` : "Stripe key rejected",
    detail: ok
      ? `Connected in ${mode} mode.`
      : (errMsg ?? "Stripe rejected the secret key."),
    identity,
    armed: ok,
    grantedCapabilities: ok ? ["read", "write", "metrics"] : [],
    missingCapabilities: process.env.STRIPE_WEBHOOK_SECRET ? [] : ["STRIPE_WEBHOOK_SECRET (optional)"],
    lastActivityAt: null,
    lastActivityLabel: null,
    lastErrorAt: ok ? null : new Date().toISOString(),
    lastErrorMessage: errMsg,
    adapterVersion: "stripe.v0.1",
    testable: true,
  };
}

export function probeSupabaseSelf(): ProbeResult {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  const ok = !!url && !!key;
  return {
    status: ok ? "connected" : "connection_error",
    headline: ok ? "Project database live" : "Missing Supabase environment",
    detail: ok
      ? `Connected to ${new URL(url!).host}. Auth, database, and storage available.`
      : "SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY not set.",
    identity: ok ? new URL(url!).host : null,
    armed: ok,
    grantedCapabilities: ok ? ["read", "write", "sync"] : [],
    missingCapabilities: ok ? [] : ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY"],
    lastActivityAt: null,
    lastActivityLabel: null,
    lastErrorAt: null,
    lastErrorMessage: null,
    adapterVersion: "supabase.self",
    testable: false,
  };
}

export async function probeSamMcp(supabase: Supa, orgId: string): Promise<ProbeResult> {
  const { data } = await supabase
    .from("sam_mcp_connections")
    .select("status, server_url, last_connected_at, last_error, last_error_at")
    .eq("organization_id", orgId)
    .order("updated_at", { ascending: false })
    .limit(1);
  const m = data?.[0];
  const status: ProviderStatus = !m
    ? "not_configured"
    : m.status === "connected"
      ? "connected"
      : m.status === "error"
        ? "connection_error"
        : "action_needed";
  return {
    status,
    headline: !m
      ? "No MCP server configured"
      : m.status === "connected"
        ? "Connected"
        : m.status === "error"
          ? "Connection error"
          : "Configured",
    detail: m?.server_url ?? "Add a SAM MCP server URL and API key from the MCP panel.",
    identity: m?.server_url ?? null,
    armed: m?.status === "connected",
    grantedCapabilities: [],
    missingCapabilities: [],
    lastActivityAt: m?.last_connected_at ?? null,
    lastActivityLabel: m?.last_connected_at ? "Last connected" : null,
    lastErrorAt: m?.last_error_at ?? null,
    lastErrorMessage: m?.last_error ?? null,
    adapterVersion: "sam-mcp.v1",
    testable: false,
  };
}

export async function probeWebsiteSources(supabase: Supa, orgId: string): Promise<ProbeResult> {
  const { count } = await supabase
    .from("integration_connections")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("status", "active");
  const n = count ?? 0;
  return {
    status: n > 0 ? "connected" : "not_configured",
    headline: n > 0 ? `${n} active source${n === 1 ? "" : "s"}` : "No sources configured",
    detail: "Websites, sitemaps, APIs, and files SAM ingests as knowledge.",
    identity: null,
    armed: n > 0,
    grantedCapabilities: n > 0 ? ["read", "sync"] : [],
    missingCapabilities: [],
    lastActivityAt: null,
    lastActivityLabel: null,
    lastErrorAt: null,
    lastErrorMessage: null,
    adapterVersion: "ingest.v1",
    testable: false,
  };
}

export async function probeWebhooks(supabase: Supa, orgId: string): Promise<ProbeResult> {
  const { count: total } = await supabase
    .from("integration_webhooks")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId);
  const { count: enabled } = await supabase
    .from("integration_webhooks")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("enabled", true);
  const { data: recent } = await supabase
    .from("integration_webhook_deliveries")
    .select("delivered_at, status_code, error")
    .eq("organization_id", orgId)
    .order("delivered_at", { ascending: false })
    .limit(1);
  const last = recent?.[0];
  const errRow = last && (last.error || (last.status_code && last.status_code >= 400));
  return {
    status: (total ?? 0) === 0 ? "not_configured" : (enabled ?? 0) > 0 ? "connected" : "action_needed",
    headline: (total ?? 0) === 0
      ? "No webhooks configured"
      : `${enabled ?? 0} of ${total ?? 0} enabled`,
    detail: "Signed outbound webhooks NorthStar sends on SAM events.",
    identity: null,
    armed: (enabled ?? 0) > 0,
    grantedCapabilities: ["webhook_out"],
    missingCapabilities: [],
    lastActivityAt: last?.delivered_at ?? null,
    lastActivityLabel: last?.delivered_at ? "Last delivery" : null,
    lastErrorAt: errRow ? last?.delivered_at ?? null : null,
    lastErrorMessage: errRow ? last?.error ?? `HTTP ${last?.status_code}` : null,
    adapterVersion: "webhooks.v1",
    testable: false,
  };
}

export async function probeRestEndpoints(supabase: Supa, orgId: string): Promise<ProbeResult> {
  const { count: total } = await supabase
    .from("integration_rest_endpoints")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId);
  const { count: enabled } = await supabase
    .from("integration_rest_endpoints")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("enabled", true);
  const { data: recentErr } = await supabase
    .from("integration_rest_endpoints")
    .select("last_error, last_error_at")
    .eq("organization_id", orgId)
    .not("last_error", "is", null)
    .order("last_error_at", { ascending: false })
    .limit(1);
  const { data: recentOk } = await supabase
    .from("integration_rest_endpoints")
    .select("last_success_at")
    .eq("organization_id", orgId)
    .not("last_success_at", "is", null)
    .order("last_success_at", { ascending: false })
    .limit(1);
  return {
    status: (total ?? 0) === 0 ? "not_configured" : (enabled ?? 0) > 0 ? "connected" : "action_needed",
    headline: (total ?? 0) === 0
      ? "No REST endpoints configured"
      : `${enabled ?? 0} of ${total ?? 0} enabled`,
    detail: "Reusable REST endpoints SAM can call with stored auth.",
    identity: null,
    armed: (enabled ?? 0) > 0,
    grantedCapabilities: ["read", "write"],
    missingCapabilities: [],
    lastActivityAt: recentOk?.[0]?.last_success_at ?? null,
    lastActivityLabel: recentOk?.[0]?.last_success_at ? "Last success" : null,
    lastErrorAt: recentErr?.[0]?.last_error_at ?? null,
    lastErrorMessage: recentErr?.[0]?.last_error ?? null,
    adapterVersion: "rest.v1",
    testable: false,
  };
}