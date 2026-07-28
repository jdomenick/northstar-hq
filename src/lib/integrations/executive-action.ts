// Executive Action derivation.
//
// Pure, deterministic mapping from a truthful ProbeResult to the single
// "what should I do next?" question. Never fabricates recommendations:
// every branch is derived from an explicit diagnostic or connection field.

import type { ProbeResult, ProviderStatus, IntegrationDiagnostics } from "./probes.server";
import type { ProviderDefinition } from "./providers";

export type ExecutiveHealth = "healthy" | "warning" | "error";
export type ExecutiveImpact = "low" | "medium" | "high";

export interface ExecutiveAction {
  health: ExecutiveHealth;
  actionRequired: boolean;
  // Short imperative label, e.g. "Reconnect account". Null when no action required.
  title: string | null;
  // One-sentence explanation of the highest priority issue.
  issue: string | null;
  // Concrete next step the operator should take. Null when none required.
  nextStep: string | null;
  impact: ExecutiveImpact | null;
  // Optional in-app path to jump directly to the fix.
  href: string | null;
}

const OK: ExecutiveAction = {
  health: "healthy",
  actionRequired: false,
  title: null,
  issue: null,
  nextStep: null,
  impact: null,
  href: null,
};

function isRecent(iso: string | null, days = 7): boolean {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() < days * 86400_000;
}

function errorMoreRecentThanSuccess(p: ProbeResult): boolean {
  if (!p.lastErrorAt) return false;
  if (!p.lastActivityAt) return isRecent(p.lastErrorAt);
  return new Date(p.lastErrorAt).getTime() > new Date(p.lastActivityAt).getTime();
}

function healthFromStatus(status: ProviderStatus, recentFailure: boolean): ExecutiveHealth {
  if (status === "authentication_failed" || status === "connection_error" || status === "unknown") {
    return "error";
  }
  if (
    status === "action_needed" ||
    status === "awaiting_credentials" ||
    status === "awaiting_oauth_configuration" ||
    status === "awaiting_provider_approval" ||
    status === "ready_to_connect" ||
    status === "not_configured"
  ) {
    return "warning";
  }
  // connected
  return recentFailure ? "warning" : "healthy";
}

export function deriveExecutiveAction(
  def: ProviderDefinition,
  probe: ProbeResult,
): ExecutiveAction {
  const recentFailure = errorMoreRecentThanSuccess(probe);
  const health = healthFromStatus(probe.status, recentFailure);
  const d = probe.diagnostics ?? null;

  // Provider-specific rules. Every branch derives from real fields.
  const specific = specificAction(def, probe, d);
  if (specific) return { ...specific, health };

  // Generic fallback for env-shell providers already handled above; catch
  // any lingering recent failure on an otherwise-connected integration.
  if (probe.status === "connected" && recentFailure && probe.lastErrorMessage) {
    return {
      health: "warning",
      actionRequired: true,
      title: "Investigate recent failure",
      issue: probe.lastErrorMessage,
      nextStep: "Open Details and review the recent activity log.",
      impact: "medium",
      href: null,
    };
  }

  if (probe.status === "connected") return { ...OK, health };
  return { ...OK, health };
}

function specificAction(
  def: ProviderDefinition,
  probe: ProbeResult,
  d: IntegrationDiagnostics | null,
): ExecutiveAction | null {
  switch (def.key) {
    case "beehiiv":
      if (d?.kind === "beehiiv") {
        if (probe.status === "awaiting_credentials") {
          return act("Add Beehiiv credentials", "Beehiiv API key and Publication ID are not configured.", "Provide BEEHIIV_API_KEY and BEEHIIV_PUBLICATION_ID.", "high");
        }
        if (probe.status === "connection_error") {
          return act("Verify Beehiiv API key", "Beehiiv rejected the current API key or is unreachable.", "Confirm the API key is valid and the publication ID matches.", "high");
        }
        if (probe.status === "action_needed" && !d.publishArmed) {
          return act("Arm Beehiiv publishing", "Publishing is intentionally disarmed (safe mode).", "Set BEEHIIV_PUBLISH_ARMED=true once you are ready to publish live.", "medium");
        }
      }
      return null;

    case "linkedin":
      if (probe.status === "awaiting_credentials") {
        return act("Connect LinkedIn account", "LinkedIn is not connected.", "Complete the LinkedIn connector authorization from Integrations.", "high");
      }
      if (probe.status === "authentication_failed") {
        return act("Reconnect account", "LinkedIn stopped accepting the stored credentials.", "Re-authorize the LinkedIn connector.", "high");
      }
      if (probe.status === "action_needed" && d?.kind === "linkedin" && !d.publishArmed) {
        return act("Arm LinkedIn publishing", "Connected but publishing is disarmed (safe mode).", "Set LINKEDIN_PUBLISH_ARMED=true when ready to publish live.", "medium");
      }
      return null;

    case "facebook":
    case "instagram": {
      const label = def.key === "facebook" ? "Facebook Page" : "Instagram account";
      if (probe.status === "awaiting_oauth_configuration") {
        return act("Configure Meta app credentials", "Meta app credentials are missing.", "Provide the Meta app ID and secret in project environment.", "high");
      }
      if (probe.status === "ready_to_connect") {
        return act(`Connect ${label}`, `No ${label} is connected yet.`, "Start Meta OAuth from the integration card.", "high");
      }
      if (probe.status === "awaiting_provider_approval") {
        const reason = d?.kind === "meta" ? d.destinations.map((x) => x.lastCapabilityReason).filter(Boolean).join(" - ") : "";
        return act("Complete Meta App Review", reason || "Publishing scope has not been approved by Meta yet.", "Submit for App Review with the required publish permission.", "high");
      }
      return null;
    }

    case "stripe":
      if (d?.kind === "stripe") {
        if (probe.status === "awaiting_credentials") {
          return act("Add Stripe secret key", "STRIPE_SECRET_KEY is not configured.", "Provide STRIPE_SECRET_KEY (sk_live_ or sk_test_).", "high");
        }
        if (probe.status === "authentication_failed") {
          return act("Replace invalid Stripe key", "Stripe rejected the current secret key.", "Rotate STRIPE_SECRET_KEY with a valid key from the Stripe dashboard.", "high");
        }
        if (d.account && d.account.chargesEnabled === false) {
          return act("Complete Stripe onboarding", "Charges are disabled on the connected Stripe account.", "Finish Stripe account verification to enable charges.", "high");
        }
        if (d.account && d.account.payoutsEnabled === false) {
          return act("Enable payouts", "Payouts are disabled on the connected Stripe account.", "Add a payout method and complete verification in Stripe.", "high");
        }
        if (!d.webhookSecretPresent) {
          return act("Configure webhook secret", "STRIPE_WEBHOOK_SECRET is not set, so Stripe events cannot be verified.", "Provide STRIPE_WEBHOOK_SECRET to enable signed webhook processing.", "medium");
        }
      }
      return null;

    case "supabase_self":
      if (probe.status !== "connected") {
        return act("Restore backend environment", "SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY is missing.", "Restore the Supabase environment variables so the app can reach the database.", "high");
      }
      return null;

    case "sam_mcp":
      if (probe.status === "not_configured") {
        return act("Configure additional servers", "No SAM MCP server is configured.", "Add a SAM MCP server URL and API key from the MCP panel below.", "medium", "/sam/integrations");
      }
      if (probe.status === "connection_error") {
        return act("Reconnect MCP server", probe.lastErrorMessage ?? "MCP server is not responding.", "Verify the server URL and API key, then re-test the connection.", "high", "/sam/integrations");
      }
      if (probe.status === "action_needed") {
        return act("Test MCP server", "MCP server is configured but has not connected successfully.", "Run Test connection to complete the handshake.", "medium", "/sam/integrations");
      }
      return null;

    case "website_sync":
      if (d?.kind === "website_sync") {
        if (d.sources.length === 0) {
          return act("Add a website source", "No websites, sitemaps, or files have been added for SAM to ingest.", "Add a source from the Knowledge module to enable ingestion.", "medium", "/sam/knowledge");
        }
        const enabled = d.sources.filter((s) => s.enabled).length;
        const anyRun = d.recentRuns.length > 0;
        if (enabled === 0) {
          return act("Enable at least one source", "All sources are disabled, so nothing will sync.", "Enable a source in the Knowledge module.", "medium", "/sam/knowledge");
        }
        if (!anyRun) {
          return act("Run initial crawl", "Sources are configured but no sync has run yet.", "Trigger the first sync from the Knowledge module.", "medium", "/sam/knowledge");
        }
        const lastRun = d.recentRuns[0];
        if (lastRun && lastRun.status === "failed") {
          return act("Investigate failed sync", lastRun.failureMessage ?? "The most recent sync run failed.", "Open Knowledge and re-run the sync, or fix the source URL.", "medium", "/sam/knowledge");
        }
      }
      return null;

    case "webhooks":
      if (d?.kind === "webhooks_summary") {
        if (d.total === 0) return null; // optional feature
        if (d.enabled === 0) {
          return act("Enable at least one webhook", "Webhooks are configured but all are disabled.", "Enable a webhook so SAM events are delivered.", "low", "/sam/integrations/webhooks");
        }
        if (probe.lastErrorMessage && errorMoreRecentThanSuccess(probe)) {
          return act("Investigate failed delivery", probe.lastErrorMessage, "Open Webhooks and retry the failed delivery.", "medium", "/sam/integrations/webhooks");
        }
      }
      return null;

    case "rest_endpoints":
      if (d?.kind === "rest_summary") {
        if (d.total === 0) return null;
        if (d.enabled === 0) {
          return act("Enable at least one endpoint", "REST endpoints exist but all are disabled.", "Enable an endpoint so SAM can call it.", "low", "/sam/integrations/rest-endpoints");
        }
        if (probe.lastErrorMessage && errorMoreRecentThanSuccess(probe)) {
          return act("Fix failing REST endpoint", probe.lastErrorMessage, "Open REST endpoints and re-test the failing endpoint.", "medium", "/sam/integrations/rest-endpoints");
        }
      }
      return null;

    default:
      // Env-only shell providers.
      if (d?.kind === "env_shell") {
        if (d.missingEnv.length > 0) {
          return act(
            "Provide required credentials",
            `Missing environment: ${d.missingEnv.join(", ")}.`,
            def.externalStep ?? `Add ${d.missingEnv.join(", ")} to project environment.`,
            "high",
          );
        }
        if (d.approvalRequired) {
          return act(
            "Complete provider approval",
            "Credentials are present but the provider requires manual approval.",
            def.externalStep ?? "Follow the provider's approval process, then re-check status.",
            "medium",
          );
        }
        if (probe.status === "ready_to_connect") {
          return act(
            "Finish connecting",
            "Credentials are present but the connection has not been activated.",
            def.externalStep ?? "Complete the provider-side connection to activate.",
            "medium",
          );
        }
      }
      return null;
  }
}

function act(
  title: string,
  issue: string,
  nextStep: string,
  impact: ExecutiveImpact,
  href: string | null = null,
): ExecutiveAction {
  return { health: "warning", actionRequired: true, title, issue, nextStep, impact, href };
}