// Social platform registry. All platforms remain not_implemented /
// unavailable until real connectors are built and verified. Provider
// output must NEVER change these values.

import { SOCIAL_REGISTRY_VERSION, type SocialPlatform } from "@/lib/constants";
import type { SocialPlatformDescriptor } from "./types";
import { SocialError } from "./errors";

function unverified(
  key: SocialPlatform,
  displayName: string,
  overrides: Partial<SocialPlatformDescriptor> = {},
): SocialPlatformDescriptor {
  return {
    key,
    displayName,
    implementationStatus: "not_implemented",
    connectorStatus: "unavailable",
    connectorVersion: "v0",
    supportedContentTypes: ["text"],
    supportsText: true,
    supportsImages: false,
    supportsVideo: false,
    supportsCarousels: false,
    supportsLinks: true,
    supportsFirstComment: false,
    supportsHashtags: false,
    supportsScheduling: false,
    supportsMetrics: false,
    supportsCommentMonitoring: false,
    supportsDeletion: false,
    maximumTextLength: 1000,
    maximumHashtagCount: 0,
    supportedMediaFormats: [],
    maximumMediaCount: 0,
    aspectRatioGuidance: [],
    requiredScopes: [],
    createsExternalSideEffects: true,
    constraintsVersion: SOCIAL_REGISTRY_VERSION,
    limitsVerified: false,
    ...overrides,
  };
}

const REGISTRY = new Map<SocialPlatform, SocialPlatformDescriptor>();
function reg(d: SocialPlatformDescriptor) { REGISTRY.set(d.key, d); }

// Placeholder limits are illustrative only. limitsVerified=false ensures the
// eligibility engine treats them as unverified and never authorizes a real
// publication using these numbers.
reg(unverified("facebook", "Facebook", {
  supportedContentTypes: ["text","image","carousel","short_video","long_video","link"],
  supportsImages: true, supportsVideo: true, supportsCarousels: true,
  supportsHashtags: true, supportsScheduling: true, supportsMetrics: true,
  supportsCommentMonitoring: true, supportsDeletion: true,
  maximumTextLength: 63206, maximumHashtagCount: 30,
  supportedMediaFormats: ["jpg","png","mp4"], maximumMediaCount: 10,
  aspectRatioGuidance: ["1:1","4:5","16:9"], requiredScopes: ["pages_manage_posts","pages_read_engagement"],
}));
reg(unverified("instagram", "Instagram", {
  supportedContentTypes: ["image","carousel","short_video","reel","story"],
  supportsImages: true, supportsVideo: true, supportsCarousels: true,
  supportsFirstComment: true, supportsHashtags: true, supportsScheduling: true,
  supportsMetrics: true, supportsCommentMonitoring: true, supportsDeletion: true,
  maximumTextLength: 2200, maximumHashtagCount: 30,
  supportedMediaFormats: ["jpg","png","mp4"], maximumMediaCount: 10,
  aspectRatioGuidance: ["1:1","4:5","9:16"], requiredScopes: ["instagram_content_publish"],
}));
reg(unverified("linkedin", "LinkedIn", {
  supportedContentTypes: ["text","image","carousel","article","short_video","link"],
  supportsImages: true, supportsVideo: true, supportsCarousels: true,
  supportsHashtags: true, supportsScheduling: true, supportsMetrics: true,
  supportsCommentMonitoring: true, supportsDeletion: true,
  maximumTextLength: 3000, maximumHashtagCount: 10,
  supportedMediaFormats: ["jpg","png","mp4"], maximumMediaCount: 9,
  aspectRatioGuidance: ["1.91:1","1:1","4:5"], requiredScopes: ["w_member_social"],
}));
reg(unverified("x", "X", {
  supportedContentTypes: ["text","image","short_video","thread","link"],
  supportsImages: true, supportsVideo: true, supportsHashtags: true,
  supportsScheduling: true, supportsMetrics: true, supportsDeletion: true,
  maximumTextLength: 280, maximumHashtagCount: 5,
  supportedMediaFormats: ["jpg","png","mp4"], maximumMediaCount: 4,
  aspectRatioGuidance: ["16:9","1:1"], requiredScopes: ["tweet.write","tweet.read"],
}));
reg(unverified("threads", "Threads", {
  supportedContentTypes: ["text","image","short_video","thread"],
  supportsImages: true, supportsVideo: true, supportsHashtags: true,
  maximumTextLength: 500, maximumHashtagCount: 5,
}));
reg(unverified("tiktok", "TikTok", {
  supportedContentTypes: ["short_video"], supportsVideo: true, supportsHashtags: true,
  supportsScheduling: true, supportsMetrics: true, supportsDeletion: true,
  maximumTextLength: 2200, maximumHashtagCount: 30,
  supportedMediaFormats: ["mp4"], maximumMediaCount: 1,
  aspectRatioGuidance: ["9:16"], requiredScopes: ["video.publish"],
}));
reg(unverified("youtube", "YouTube", {
  supportedContentTypes: ["long_video","short_video","community_post"],
  supportsVideo: true, supportsScheduling: true, supportsMetrics: true,
  supportsCommentMonitoring: true, supportsDeletion: true,
  maximumTextLength: 5000, maximumHashtagCount: 15,
  supportedMediaFormats: ["mp4","mov"], maximumMediaCount: 1,
  aspectRatioGuidance: ["16:9","9:16"], requiredScopes: ["youtube.upload"],
}));
reg(unverified("pinterest", "Pinterest", {
  supportedContentTypes: ["image","short_video","link"],
  supportsImages: true, supportsVideo: true, supportsScheduling: true,
  supportsMetrics: true, supportsDeletion: true,
  maximumTextLength: 500, maximumHashtagCount: 20,
  supportedMediaFormats: ["jpg","png","mp4"], maximumMediaCount: 1,
  aspectRatioGuidance: ["2:3","1:1"], requiredScopes: ["pins:write"],
}));
reg(unverified("reddit", "Reddit", {
  supportedContentTypes: ["text","image","short_video","link","poll"],
  supportsImages: true, supportsVideo: true, supportsLinks: true,
  supportsScheduling: false, supportsMetrics: true, supportsDeletion: true,
  maximumTextLength: 40000, maximumHashtagCount: 0,
  requiredScopes: ["submit"],
}));
reg(unverified("bluesky", "Bluesky", {
  supportedContentTypes: ["text","image","link"],
  supportsImages: true, supportsHashtags: true,
  maximumTextLength: 300, maximumHashtagCount: 10,
  supportedMediaFormats: ["jpg","png"], maximumMediaCount: 4,
}));
reg(unverified("other", "Other Platform", {}));

export function getSocialPlatform(key: string): SocialPlatformDescriptor {
  const d = REGISTRY.get(key as SocialPlatform);
  if (!d) throw new SocialError("invalid_platform", `Unknown platform: ${key}`);
  return d;
}

export function tryGetSocialPlatform(key: string): SocialPlatformDescriptor | null {
  return REGISTRY.get(key as SocialPlatform) ?? null;
}

export function listSocialPlatforms(): SocialPlatformDescriptor[] {
  return Array.from(REGISTRY.values());
}

export function isConnectorAvailable(key: string): boolean {
  const d = tryGetSocialPlatform(key);
  return !!d && d.implementationStatus === "implemented" && d.connectorStatus === "available";
}