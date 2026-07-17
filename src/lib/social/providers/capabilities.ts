// Provider capability model. Distinct from `SocialPlatformDescriptor`
// (which describes the abstract platform) - this describes what THIS
// adapter implementation, running against THIS connection, can actually
// do right now. Callers must check capabilities before invoking optional
// adapter methods so unsupported operations fail as `unsupported_operation`
// (normalized) rather than a runtime TypeError.

import type { SocialPlatform } from "@/lib/constants";

export interface ProviderCapabilities {
  platform: SocialPlatform | "beehiiv";
  adapterVersion: string;

  // Auth surface
  supportsOAuth: boolean;
  supportsApiKey: boolean;
  supportsCredentialRefresh: boolean;
  requiredScopes: string[];

  // Destination discovery (Pages, subreddits, publications, IG accounts)
  requiresDestinationSelection: boolean;
  supportsListDestinations: boolean;

  // Content surface
  supportsPublish: boolean;
  supportsScheduledPublish: boolean; // provider-native scheduling, not our queue
  supportsDelete: boolean;
  supportsMediaUpload: boolean;
  supportsMultipleMedia: boolean;
  supportsAltText: boolean;
  supportsFirstComment: boolean;
  supportsLink: boolean;
  supportsMentions: boolean;
  supportsHashtags: boolean;

  // Content limits (mirror descriptor when known; adapter may narrow)
  maxTextLength: number;
  maxHashtagCount: number;
  maxMediaCount: number;
  supportedMediaFormats: string[];

  // Read surface
  supportsFetchMetrics: boolean;
  supportsVerifyPublication: boolean;

  // Approval surface (Reddit-style: some destinations require manual review)
  destinationsMayRequireManualApproval: boolean;
}

export function assertCapability(
  caps: ProviderCapabilities,
  flag: keyof ProviderCapabilities,
): void {
  const v = caps[flag];
  if (v !== true) {
    throw new Error(`provider capability not supported: ${String(flag)}`);
  }
}