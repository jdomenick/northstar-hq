// Truthful connector-status resolver. Only reads static registry values -
// never invents provider readiness. A connector is "ready" only if the
// registry explicitly says implementationStatus=implemented AND
// connectorStatus=available. Everything else surfaces as a blocked result
// with the exact reason so SAM cannot claim a publication succeeded on a
// platform where no real adapter exists yet.

import { getSocialPlatform, tryGetSocialPlatform } from "@/lib/social/registry.server";
import type { BlockedReasonCode } from "./types";

export interface ConnectorStatus {
  platform: string;
  displayName: string;
  ready: boolean;
  reasonCode: BlockedReasonCode | null;
  detail: Record<string, string | number | boolean | null>;
  requiredScopes: string[];
  settingsRoute: string;
}

/**
 * Return a truthful connector status for a platform key. Every field is
 * derived from the static social registry - never from provider output.
 */
export function resolveConnectorStatus(platformKey: string): ConnectorStatus {
  const d = tryGetSocialPlatform(platformKey);
  if (!d) {
    return {
      platform: platformKey,
      displayName: platformKey,
      ready: false,
      reasonCode: "connector_not_implemented",
      detail: { platform: platformKey, known: false },
      requiredScopes: [],
      settingsRoute: "/settings/integrations",
    };
  }
  const ready = d.implementationStatus === "implemented" && d.connectorStatus === "available";
  if (ready) {
    return {
      platform: d.key,
      displayName: d.displayName,
      ready: true,
      reasonCode: null,
      detail: {},
      requiredScopes: [...d.requiredScopes],
      settingsRoute: "/settings/integrations",
    };
  }
  const reason: BlockedReasonCode =
    d.implementationStatus !== "implemented"
      ? "connector_not_implemented"
      : "connector_credentials_missing";
  return {
    platform: d.key,
    displayName: d.displayName,
    ready: false,
    reasonCode: reason,
    detail: {
      platform: d.key,
      implementation_status: d.implementationStatus,
      connector_status: d.connectorStatus,
      required_scopes: d.requiredScopes.join(","),
    },
    requiredScopes: [...d.requiredScopes],
    settingsRoute: "/settings/integrations",
  };
}

/** Look up display name safely without throwing for unknown keys. */
export function platformDisplayName(platformKey: string): string {
  try {
    return getSocialPlatform(platformKey).displayName;
  } catch {
    return platformKey;
  }
}