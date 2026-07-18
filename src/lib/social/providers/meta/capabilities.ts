// Meta capability derivation. Pure function - inputs describe the current
// live state, output tells the caller what's actually possible right now.

import type { ProviderCapabilities } from "../capabilities";

export interface MetaCapabilityInputs {
  configured: boolean;                     // env vars present
  connected: boolean;                       // OAuth completed, token stored
  grantedPermissions: string[];             // from /me/permissions
  destinationCount: number;                 // Pages + IG accounts discovered
  publishableDestinationCount: number;
  provider: "facebook" | "instagram";
}

export interface MetaCapabilitySummary {
  configured: boolean;
  connected: boolean;
  publishAvailable: boolean;
  verificationAvailable: boolean;
  metricsAvailable: boolean;
  destinationDiscoveryAvailable: boolean;
  mediaUploadAvailable: boolean;
  reason: string;
  missingRequirements: string[];
}

export function summarizeMetaCapabilities(input: MetaCapabilityInputs): MetaCapabilitySummary {
  const missing: string[] = [];
  if (!input.configured) missing.push("Meta credentials");
  if (input.configured && !input.connected) missing.push("Meta OAuth connection");
  const requiredPerms = input.provider === "facebook"
    ? ["pages_manage_posts", "pages_read_engagement"]
    : ["instagram_content_publish", "instagram_basic"];
  if (input.connected) {
    for (const p of requiredPerms) {
      if (!input.grantedPermissions.includes(p)) missing.push(`permission:${p}`);
    }
    if (input.publishableDestinationCount === 0) missing.push("publishable destination");
  }
  const publishAvailable = missing.length === 0;
  const reason = publishAvailable
    ? "Ready"
    : !input.configured
      ? "Meta credentials required"
      : !input.connected
        ? "Meta account not connected"
        : `Cannot publish: ${missing.join(", ")}`;
  return {
    configured: input.configured,
    connected: input.connected,
    publishAvailable,
    verificationAvailable: publishAvailable,
    metricsAvailable: publishAvailable,
    destinationDiscoveryAvailable: input.connected,
    mediaUploadAvailable: publishAvailable,
    reason,
    missingRequirements: missing,
  };
}

export function toProviderCapabilities(
  provider: "facebook" | "instagram",
  summary: MetaCapabilitySummary,
  adapterVersion: string,
): ProviderCapabilities {
  const isIG = provider === "instagram";
  return {
    platform: provider,
    adapterVersion,
    supportsOAuth: true,
    supportsApiKey: false,
    supportsCredentialRefresh: false,
    requiredScopes: isIG
      ? ["instagram_content_publish", "instagram_basic", "pages_show_list"]
      : ["pages_manage_posts", "pages_read_engagement", "pages_show_list"],
    requiresDestinationSelection: true,
    supportsListDestinations: summary.destinationDiscoveryAvailable,
    supportsPublish: summary.publishAvailable,
    supportsScheduledPublish: false, // we schedule via our own queue
    supportsDelete: summary.publishAvailable,
    supportsMediaUpload: summary.mediaUploadAvailable,
    supportsMultipleMedia: true,
    supportsAltText: isIG,
    supportsFirstComment: isIG,
    supportsLink: !isIG,
    supportsMentions: true,
    supportsHashtags: true,
    maxTextLength: isIG ? 2200 : 63206,
    maxHashtagCount: 30,
    maxMediaCount: 10,
    supportedMediaFormats: ["image/jpeg", "image/png", ...(isIG ? [] : ["video/mp4"])],
    supportsFetchMetrics: summary.metricsAvailable,
    supportsVerifyPublication: summary.verificationAvailable,
    destinationsMayRequireManualApproval: false,
  };
}
