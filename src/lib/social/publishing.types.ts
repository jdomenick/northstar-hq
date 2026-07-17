import type { SocialPlatform, SocialPublicationStatus } from "@/lib/constants";

export interface SocialPublicationAttemptDescriptor {
  id: string;
  organizationId: string;
  ventureId: string;
  contentItemId: string;
  socialAccountId: string;
  automationJobId: string | null;
  platform: SocialPlatform | string;
  contentVersion: number;
  status: SocialPublicationStatus;
  attemptNumber: number;
  idempotencyKey: string;
  connectorVersion: string;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  externalPostId: string | null;
  externalPostUrl: string | null;
  externalReference: string | null;
  errorCode: string | null;
  responseSummary: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// Contract for future connector-driven publishing. NOT executed in this milestone.
export interface SocialPublishJobPayload {
  organizationId: string;
  ventureId: string;
  contentItemId: string;
  contentVersion: number;
  socialAccountId: string;
  approvedContentVersion: number;
  brandProfileVersion: number;
  policyVersion: string;
  idempotencyKey: string;
}

// Repost policy contract. Deterministic; defaults to disallow.
export interface SocialRepostPolicy {
  allowRepost: boolean;
  minimumSpacingHours: number;
  maxRepostsPerContent: number;
  requireExplicitApproval: boolean;
}

export const DEFAULT_REPOST_POLICY: SocialRepostPolicy = {
  allowRepost: false,
  minimumSpacingHours: 24 * 7,
  maxRepostsPerContent: 0,
  requireExplicitApproval: true,
};