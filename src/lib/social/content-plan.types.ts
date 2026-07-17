import type { SocialAutomationMode, SocialApprovalPolicy, SocialPlanStatus, SocialPlatform } from "@/lib/constants";
import type { SocialLineageRef } from "./lineage.types";

export interface SocialContentPlanDescriptor {
  id: string;
  organizationId: string;
  ventureId: string;
  campaignId: string | null;
  name: string;
  objective: string | null;
  audience: Record<string, unknown>;
  startDate: string | null;
  endDate: string | null;
  platforms: SocialPlatform[];
  contentFrequency: Record<string, unknown>;
  themes: string[];
  contentMix: Record<string, unknown>;
  callsToAction: string[];
  automationMode: SocialAutomationMode;
  approvalPolicy: SocialApprovalPolicy;
  status: SocialPlanStatus;
  sourceLineage: SocialLineageRef[];
  createdBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}