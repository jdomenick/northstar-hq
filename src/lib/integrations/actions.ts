// Integration action derivation.
//
// Pure and client-safe: maps a provider definition plus a truthful probe
// result to the concrete controls the Integrations page renders. Every row
// resolves to at least one real action. There is no inert "ask Lovable"
// state: when an external prerequisite is genuinely missing we return a
// `setup_required` action carrying the exact env names and external step,
// which flips to a live Connect/Configure action the moment the secret exists.

import type { ProviderDefinition } from "./providers";

export type OAuthProviderKey = "facebook" | "instagram" | "x" | "reddit";

export type IntegrationAction =
  | { kind: "none" }
  | { kind: "test"; supported: true }
  | { kind: "manage_link"; href: string; label: string }
  | { kind: "start_meta_oauth"; label: string }
  | { kind: "oauth_connect"; provider: OAuthProviderKey; label: string }
  | { kind: "oauth_disconnect"; provider: OAuthProviderKey; label: string }
  | { kind: "connector_connect"; connectorId: string; label: string }
  | { kind: "connector_disconnect"; connectorId: string; label: string }
  | { kind: "setup_required"; missingEnv: string[]; externalStep: string };

/**
 * Minimal probe shape this module depends on. Keeping it structural means the
 * derivation stays pure and unit-testable without importing server code.
 */
export interface ActionProbeView {
  status: string;
  testable: boolean;
  connected?: boolean;
  missingEnv?: string[];
}

function setupRequired(def: ProviderDefinition, missingEnv: string[]): IntegrationAction {
  return {
    kind: "setup_required",
    missingEnv,
    externalStep: def.externalStep ?? "External credentials are required before connecting.",
  };
}

/**
 * Ordered action list for a provider row. The first entry is the primary
 * control; the rest render as secondary controls.
 */
export function deriveIntegrationActions(
  def: ProviderDefinition,
  probe: ActionProbeView,
): IntegrationAction[] {
  const missingEnv = probe.missingEnv ?? [];
  const actions: IntegrationAction[] = [];

  switch (def.auth) {
    case "oauth_meta_managed": {
      if (missingEnv.length > 0) {
        actions.push(setupRequired(def, missingEnv));
      } else {
        const connected = probe.connected === true;
        actions.push({
          kind: "start_meta_oauth",
          label: connected ? "Manage connection" : "Connect",
        });
      }
      break;
    }
    case "oauth_app": {
      // X and Reddit run this project's own per-venture OAuth. LinkedIn is
      // provisioned through the workspace connector and has no user OAuth.
      const provider =
        def.key === "x" ? "x" : def.key === "reddit" ? "reddit" : null;
      if (missingEnv.length > 0) {
        actions.push(setupRequired(def, missingEnv));
        break;
      }
      if (!provider) {
        // LinkedIn: connector-backed, credentials present.
        if (probe.testable) actions.push({ kind: "test", supported: true });
        break;
      }
      if (probe.connected === true) {
        actions.push({ kind: "oauth_connect", provider, label: "Reconnect" });
        actions.push({ kind: "oauth_disconnect", provider, label: "Disconnect" });
      } else {
        actions.push({ kind: "oauth_connect", provider, label: "Connect" });
      }
      break;
    }
    case "oauth_user": {
      if (missingEnv.length > 0 || !def.connectorId) {
        actions.push(setupRequired(def, missingEnv.length > 0 ? missingEnv : (def.requiredEnv ?? [])));
        break;
      }
      if (probe.connected === true) {
        actions.push({
          kind: "connector_connect",
          connectorId: def.connectorId,
          label: "Reconnect",
        });
        actions.push({
          kind: "connector_disconnect",
          connectorId: def.connectorId,
          label: "Disconnect",
        });
      } else {
        actions.push({ kind: "connector_connect", connectorId: def.connectorId, label: "Connect" });
      }
      break;
    }
    case "api_key": {
      if (missingEnv.length > 0) actions.push(setupRequired(def, missingEnv));
      break;
    }
    case "user_config": {
      if (def.managePath) {
        actions.push({ kind: "manage_link", href: def.managePath, label: "Manage" });
      }
      break;
    }
    case "self":
    case "unmanaged":
    default:
      break;
  }

  if (probe.testable && !actions.some((a) => a.kind === "test")) {
    actions.push({ kind: "test", supported: true });
  }
  if (def.managePath && !actions.some((a) => a.kind === "manage_link")) {
    actions.push({ kind: "manage_link", href: def.managePath, label: "Manage" });
  }
  if (actions.length === 0) actions.push({ kind: "none" });
  return actions;
}

export function primaryIntegrationAction(
  def: ProviderDefinition,
  probe: ActionProbeView,
): IntegrationAction {
  return deriveIntegrationActions(def, probe)[0]!;
}
