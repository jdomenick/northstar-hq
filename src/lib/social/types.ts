// Public framework types for the Social Automation domain. Provider-neutral,
// connector-neutral. No SDK imports allowed here.

import type {
  SocialAccountConnectionStatus, SocialApprovalPolicy, SocialAutomationMode,
  SocialBrandProfileStatus, SocialCampaignStatus, SocialPlatform,
  AutomationHealthBand,
} from "@/lib/constants";

export interface SocialAccountDescriptor {
  id: string;
  organizationId: string;
  ventureId: string;
  assetId: string | null;
  platform: SocialPlatform;
  displayName: string;
  username: string | null;
  externalAccountId: string | null;
  accountType: string | null;
  connectionStatus: SocialAccountConnectionStatus;
  credentialReference: string | null;
  grantedScopes: string[];
  publishingEnabled: boolean;
  automationMode: SocialAutomationMode;
  approvalPolicy: SocialApprovalPolicy;
  defaultTimezone: string;
  defaultSchedule: Record<string, unknown>;
  lastVerifiedAt: string | null;
  lastSuccessfulPublicationAt: string | null;
  lastFailedPublicationAt: string | null;
  lastMetricsSyncAt: string | null;
  healthScore: number | null;
  healthBand: AutomationHealthBand;
  consecutiveFailures: number;
  metadata: Record<string, unknown>;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationSocialSettingsDescriptor {
  organizationId: string;
  socialEnabled: boolean;
  publishingMasterSwitch: boolean;
  publishingEnabledBy: string | null;
  publishingEnabledAt: string | null;
  publishingConfirmationVersion: string | null;
  emergencyStop: boolean;
  emergencyStopReason: string | null;
  emergencyStoppedAt: string | null;
  emergencyStoppedBy: string | null;
  defaultAutomationMode: SocialAutomationMode;
  defaultApprovalPolicy: SocialApprovalPolicy;
  defaultTimezone: string;
  maximumPostsPerDay: number;
  maximumPostsPerPlatformPerDay: number;
  allowWeekendPublishing: boolean;
  allowHolidayPublishing: boolean;
  prohibitedTopics: string[];
  restrictedCategories: string[];
  globalRequiredDisclaimers: string[];
  policyVersion: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VentureSocialSettingsDescriptor {
  ventureId: string;
  organizationId: string;
  socialEnabled: boolean;
  publishingEnabled: boolean;
  paused: boolean;
  pauseReason: string | null;
  pausedAt: string | null;
  pausedBy: string | null;
  automationMode: SocialAutomationMode;
  approvalPolicy: SocialApprovalPolicy;
  defaultTimezone: string;
  maximumPostsPerDay: number;
  allowedPlatforms: SocialPlatform[];
  requiredReviewCategories: string[];
  prohibitedTopics: string[];
  restrictedTopics: string[];
  requiredDisclaimers: string[];
  policyVersion: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VentureBrandProfileDescriptor {
  id: string;
  organizationId: string;
  ventureId: string;
  version: number;
  status: SocialBrandProfileStatus;
  brandName: string;
  shortDescription: string | null;
  longDescription: string | null;
  mission: string | null;
  audience: Record<string, unknown>;
  voiceAttributes: string[];
  toneAttributes: string[];
  coreMessages: string[];
  products: Array<Record<string, unknown>>;
  services: Array<Record<string, unknown>>;
  approvedCallsToAction: string[];
  approvedLinks: string[];
  requiredDisclaimers: string[];
  prohibitedClaims: string[];
  prohibitedTopics: string[];
  restrictedTopics: string[];
  profanityPolicy: "strict" | "moderate" | "permissive";
  emojiPolicy: "none" | "sparingly" | "allowed" | "encouraged";
  hashtagPolicy: Record<string, unknown>;
  platformPreferences: Record<string, unknown>;
  visualGuidance: Record<string, unknown>;
  approvedExamples: Array<Record<string, unknown>>;
  rejectedExamples: Array<Record<string, unknown>>;
  crisisKeywords: string[];
  reviewRequirements: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  effectiveAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SocialCampaignDescriptor {
  id: string;
  organizationId: string;
  ventureId: string;
  name: string;
  objective: string | null;
  description: string | null;
  audience: Record<string, unknown>;
  startAt: string | null;
  endAt: string | null;
  status: SocialCampaignStatus;
  automationMode: SocialAutomationMode;
  approvalPolicy: SocialApprovalPolicy;
  platforms: SocialPlatform[];
  themes: string[];
  approvedTemplates: Array<Record<string, unknown>>;
  callsToAction: string[];
  links: string[];
  requiredDisclaimers: string[];
  prohibitedClaims: string[];
  postingFrequency: Record<string, unknown>;
  contentMix: Record<string, unknown>;
  budgetMetadata: Record<string, unknown> | null;
  paused: boolean;
  pauseReason: string | null;
  createdBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type SocialActor = "user" | "system" | "sam" | "scheduler" | "worker" | "integration";

export interface SocialPlatformDescriptor {
  key: SocialPlatform;
  displayName: string;
  implementationStatus: "not_implemented" | "implemented";
  connectorStatus: "unavailable" | "available";
  connectorVersion: string;
  supportedContentTypes: string[];
  supportsText: boolean;
  supportsImages: boolean;
  supportsVideo: boolean;
  supportsCarousels: boolean;
  supportsLinks: boolean;
  supportsFirstComment: boolean;
  supportsHashtags: boolean;
  supportsScheduling: boolean;
  supportsMetrics: boolean;
  supportsCommentMonitoring: boolean;
  supportsDeletion: boolean;
  maximumTextLength: number;
  maximumHashtagCount: number;
  supportedMediaFormats: string[];
  maximumMediaCount: number;
  aspectRatioGuidance: string[];
  requiredScopes: string[];
  createsExternalSideEffects: boolean;
  constraintsVersion: string;
  limitsVerified: boolean;
}