// Content item and version DTOs (framework shapes; DB rows are snake_case).

import type {
  SocialApprovalStatus, SocialContentStatus, SocialContentType,
  SocialMediaStatus, SocialPlatform, SocialRiskBand,
} from "@/lib/constants";
import type { SocialLineageRef } from "./lineage.types";

export interface SocialContentItemDescriptor {
  id: string;
  organizationId: string;
  ventureId: string;
  socialAccountId: string | null;
  campaignId: string | null;
  contentPlanId: string | null;
  platform: SocialPlatform;
  contentType: SocialContentType;
  title: string | null;
  body: string;
  firstComment: string | null;
  hashtags: string[];
  linkUrl: string | null;
  mediaRequirements: Array<Record<string, unknown>>;
  mediaStatus: SocialMediaStatus;
  status: SocialContentStatus;
  riskBand: SocialRiskBand;
  riskReasons: Array<Record<string, unknown>>;
  confidenceScore: number | null;
  automationGenerated: boolean;
  humanReviewed: boolean;
  approvalStatus: SocialApprovalStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  approvedContentVersion: number | null;
  contentVersion: number;
  scheduledFor: string | null;
  publishingWindowStart: string | null;
  publishingWindowEnd: string | null;
  publishedAt: string | null;
  externalPostId: string | null;
  externalPostUrl: string | null;
  sourceLineage: SocialLineageRef[];
  brandProfileVersion: number | null;
  policyVersion: string;
  duplicateFingerprint: string;
  metadata: Record<string, unknown>;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SocialContentVersionDescriptor {
  id: string;
  organizationId: string;
  contentItemId: string;
  version: number;
  title: string | null;
  body: string;
  firstComment: string | null;
  hashtags: string[];
  linkUrl: string | null;
  mediaRequirements: Array<Record<string, unknown>>;
  changeReason: string | null;
  generatedBy: "user" | "system" | "sam" | "automation";
  generatedByActorId: string | null;
  brandProfileVersion: number | null;
  policyVersion: string;
  sourceLineage: SocialLineageRef[];
  contentHash: string;
  createdAt: string;
}

// Material fields whose change invalidates any prior approval and requires a new content version.
export const SOCIAL_MATERIAL_FIELDS = [
  "title","body","firstComment","hashtags","linkUrl",
  "mediaRequirements","platform","scheduledFor",
] as const;
export type SocialMaterialField = (typeof SOCIAL_MATERIAL_FIELDS)[number];