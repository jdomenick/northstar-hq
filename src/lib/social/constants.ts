// Re-export centralized social constants so social modules never reach for
// magic numbers directly.

export {
  SOCIAL_LIMITS,
  SOCIAL_PLATFORMS,
  SOCIAL_CONTENT_TYPES,
  SOCIAL_AUTOMATION_MODES,
  SOCIAL_APPROVAL_POLICIES,
  SOCIAL_APPROVAL_STATUSES,
  SOCIAL_CONTENT_STATUSES,
  SOCIAL_MEDIA_STATUSES,
  SOCIAL_RISK_BANDS,
  SOCIAL_ACCOUNT_CONNECTION_STATUSES,
  SOCIAL_BRAND_PROFILE_STATUSES,
  SOCIAL_CAMPAIGN_STATUSES,
  SOCIAL_PLAN_STATUSES,
  SOCIAL_PUBLICATION_STATUSES,
  SOCIAL_DOMAIN_VERSION,
  SOCIAL_POLICY_VERSION,
  SOCIAL_REGISTRY_VERSION,
  SOCIAL_ELIGIBILITY_VERSION,
  SOCIAL_VALIDATION_VERSION,
  SOCIAL_RISK_VERSION,
  SOCIAL_DEDUP_VERSION,
  SOCIAL_AUDIT_VERSION,
} from "@/lib/constants";

export type {
  SocialPlatform,
  SocialContentType,
  SocialAutomationMode,
  SocialApprovalPolicy,
  SocialApprovalStatus,
  SocialContentStatus,
  SocialMediaStatus,
  SocialRiskBand,
  SocialAccountConnectionStatus,
  SocialBrandProfileStatus,
  SocialCampaignStatus,
  SocialPlanStatus,
  SocialPublicationStatus,
} from "@/lib/constants";