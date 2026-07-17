import { z } from "zod";
import {
  CONTENT_OPS_APPROVAL_ACTIONS,
  CONTENT_OPS_AUTONOMY_MODES,
  CONTENT_OPS_KILL_SWITCH_SCOPES,
  CONTENT_OPS_LIMITS,
  CONTENT_OPS_VERIFICATION_STATUSES,
} from "./constants";
import { SOCIAL_PLATFORMS, SOCIAL_CONTENT_TYPES } from "@/lib/constants";

const uuid = z.string().uuid();
const orgVenture = { organizationId: uuid, ventureId: uuid };

/* Autonomy ------------------------------------------------------------- */

export const AutonomyModeSchema = z.enum(CONTENT_OPS_AUTONOMY_MODES);

export const SetAutonomyInput = z.object({
  ...orgVenture,
  mode: AutonomyModeSchema,
  platformPauses: z.record(z.string(), z.boolean()).default({}),
  campaignPauses: z.record(z.string().uuid(), z.boolean()).default({}),
});
export type SetAutonomyInput = z.infer<typeof SetAutonomyInput>;

export const EmergencyPauseInput = z.object({
  ...orgVenture,
  reason: z.string().min(3).max(500),
});
export type EmergencyPauseInput = z.infer<typeof EmergencyPauseInput>;

/* Kill switches -------------------------------------------------------- */

export const KillSwitchScopeSchema = z.enum(CONTENT_OPS_KILL_SWITCH_SCOPES);

export const SetKillSwitchInput = z.object({
  organizationId: uuid,
  scope: KillSwitchScopeSchema,
  scopeRef: z.string().max(120).nullable().optional(),
  ventureId: uuid.nullable().optional(),
  reason: z.string().min(3).max(500),
});
export type SetKillSwitchInput = z.infer<typeof SetKillSwitchInput>;

/* Brand profile extensions -------------------------------------------- */

export const ContentPillarSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  ratio: z.number().min(0).max(1).optional(),
});
export type ContentPillar = z.infer<typeof ContentPillarSchema>;

export const AudienceSegmentSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
});

export const PostingWindowSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startMinute: z.number().int().min(0).max(1439),
  endMinute: z.number().int().min(0).max(1439),
  platform: z.enum(SOCIAL_PLATFORMS).optional(),
});

export const UpdateBrandProfileExtensionsInput = z.object({
  ...orgVenture,
  brandProfileId: uuid,
  contentPillars: z.array(ContentPillarSchema).max(CONTENT_OPS_LIMITS.maxPillarsPerStrategy).optional(),
  audienceSegments: z.array(AudienceSegmentSchema).max(50).optional(),
  promotionRatioLimit: z.number().min(0).max(1).nullable().optional(),
  postingCadence: z.record(z.enum(SOCIAL_PLATFORMS), z.number().min(0).max(100)).optional(),
  preferredPostingWindows: z.array(PostingWindowSchema).max(200).optional(),
  faithLanguagePolicy: z.record(z.string(), z.unknown()).optional(),
  crisisLanguageRules: z.record(z.string(), z.unknown()).optional(),
  sensitiveTopicGuidance: z.record(z.string(), z.unknown()).optional(),
  competitorReferences: z.array(z.string().max(240)).max(100).optional(),
  visualIdentity: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateBrandProfileExtensionsInput = z.infer<typeof UpdateBrandProfileExtensionsInput>;

/* Strategy (social_campaigns extension) -------------------------------- */

export const CreateStrategyInput = z.object({
  ...orgVenture,
  name: z.string().min(1).max(200),
  objective: z.string().max(1000).optional(),
  strategyPeriodStart: z.string().date(),
  strategyPeriodEnd: z.string().date(),
  platformMix: z.record(z.enum(SOCIAL_PLATFORMS), z.number().min(0).max(1)).default({}),
  promotionRatioLimit: z.number().min(0).max(1).optional(),
  strategicRationale: z.string().max(4000).optional(),
  samRecommendation: z.record(z.string(), z.unknown()).optional(),
  platforms: z.array(z.enum(SOCIAL_PLATFORMS)).min(1).max(SOCIAL_PLATFORMS.length),
  themes: z.array(z.string().max(240)).max(50).default([]),
});
export type CreateStrategyInput = z.infer<typeof CreateStrategyInput>;

export const SupersedeStrategyInput = z.object({
  ...orgVenture,
  strategyId: uuid,
  replacementId: uuid,
});

/* Calendar (social_content_plans) ------------------------------------- */

export const CreateCalendarEntryInput = z.object({
  ...orgVenture,
  campaignId: uuid.nullable().optional(),
  platform: z.enum(SOCIAL_PLATFORMS),
  scheduledFor: z.string().datetime(),
  contentType: z.enum(SOCIAL_CONTENT_TYPES),
  pillarId: z.string().min(1).max(64).optional(),
  brief: z.string().max(4000).optional(),
});
export type CreateCalendarEntryInput = z.infer<typeof CreateCalendarEntryInput>;

/* Content ------------------------------------------------------------- */

export const CreateContentItemInput = z.object({
  ...orgVenture,
  campaignId: uuid.nullable().optional(),
  contentPlanId: uuid.nullable().optional(),
  socialAccountId: uuid.nullable().optional(),
  platform: z.enum(SOCIAL_PLATFORMS),
  contentType: z.enum(SOCIAL_CONTENT_TYPES),
  title: z.string().max(300).nullable().optional(),
  body: z.string().min(1).max(CONTENT_OPS_LIMITS.maxBodyBytes),
  hook: z.string().max(CONTENT_OPS_LIMITS.maxHookBytes).nullable().optional(),
  cta: z.string().max(CONTENT_OPS_LIMITS.maxCtaBytes).nullable().optional(),
  altText: z.string().max(CONTENT_OPS_LIMITS.maxAltTextBytes).nullable().optional(),
  imagePrompt: z.string().max(CONTENT_OPS_LIMITS.maxImagePromptBytes).nullable().optional(),
  newsletterSubject: z.string().max(CONTENT_OPS_LIMITS.maxNewsletterSubjectBytes).nullable().optional(),
  newsletterPreview: z.string().max(CONTENT_OPS_LIMITS.maxNewsletterPreviewBytes).nullable().optional(),
  hashtags: z.array(z.string().max(120)).max(30).default([]),
  linkUrl: z.string().url().nullable().optional(),
  parentContentItemId: uuid.nullable().optional(),
  learningRefs: z.array(uuid).max(CONTENT_OPS_LIMITS.maxEvidenceRefsPerLearning).default([]),
});
export type CreateContentItemInput = z.infer<typeof CreateContentItemInput>;

/* Approvals ----------------------------------------------------------- */

export const ApprovalActionSchema = z.enum(CONTENT_OPS_APPROVAL_ACTIONS);

export const ApproveContentInput = z.object({
  ...orgVenture,
  contentItemId: uuid,
  action: ApprovalActionSchema,
  notes: z.string().max(2000).optional(),
});
export type ApproveContentInput = z.infer<typeof ApproveContentInput>;

export const BatchApprovalInput = z.object({
  ...orgVenture,
  contentItemIds: z.array(uuid).min(1).max(CONTENT_OPS_LIMITS.maxBatchApprovalSize),
  notes: z.string().max(2000).optional(),
});
export type BatchApprovalInput = z.infer<typeof BatchApprovalInput>;

/* Scheduling ---------------------------------------------------------- */

export const ScheduleContentInput = z.object({
  ...orgVenture,
  contentItemId: uuid,
  scheduledFor: z.string().datetime(),
});
export type ScheduleContentInput = z.infer<typeof ScheduleContentInput>;

export const CancelScheduleInput = z.object({
  ...orgVenture,
  contentItemId: uuid,
  reason: z.string().max(500).optional(),
});

/* Verification -------------------------------------------------------- */

export const VerificationStatusSchema = z.enum(CONTENT_OPS_VERIFICATION_STATUSES);

/* Planning input ------------------------------------------------------ */

export const RunPlanningInput = z.object({
  ...orgVenture,
  strategyId: uuid,
  horizonDays: z.number().int().min(1).max(CONTENT_OPS_LIMITS.maxStrategyHorizonDays),
});
export type RunPlanningInput = z.infer<typeof RunPlanningInput>;

/* Structured generation (LLM output) ---------------------------------- */

const PlatformVariantSchema = z.object({
  platform: z.enum(SOCIAL_PLATFORMS),
  contentType: z.enum(SOCIAL_CONTENT_TYPES),
  title: z.string().max(300).nullable().optional(),
  body: z.string().min(1).max(CONTENT_OPS_LIMITS.maxBodyBytes),
  hook: z.string().max(CONTENT_OPS_LIMITS.maxHookBytes).nullable().optional(),
  cta: z.string().max(CONTENT_OPS_LIMITS.maxCtaBytes).nullable().optional(),
  altText: z.string().max(CONTENT_OPS_LIMITS.maxAltTextBytes).nullable().optional(),
  imagePrompt: z.string().max(CONTENT_OPS_LIMITS.maxImagePromptBytes).nullable().optional(),
  newsletterSubject: z.string().max(CONTENT_OPS_LIMITS.maxNewsletterSubjectBytes).nullable().optional(),
  newsletterPreview: z.string().max(CONTENT_OPS_LIMITS.maxNewsletterPreviewBytes).nullable().optional(),
  hashtags: z.array(z.string().max(120)).max(30).default([]),
  linkUrl: z.string().url().nullable().optional(),
});

export const GeneratedCoreIdeaSchema = z.object({
  ideaKey: z.string().min(1).max(120),
  pillarId: z.string().min(1).max(64),
  angle: z.string().max(2000),
  variants: z.array(PlatformVariantSchema).min(1).max(CONTENT_OPS_LIMITS.maxVariantsPerCoreIdea),
});
export type GeneratedCoreIdea = z.infer<typeof GeneratedCoreIdeaSchema>;

export const GenerationOutputSchema = z.object({
  engineVersion: z.string(),
  ideas: z.array(GeneratedCoreIdeaSchema).min(1).max(CONTENT_OPS_LIMITS.maxPlannedItemsPerRun),
});
export type GenerationOutput = z.infer<typeof GenerationOutputSchema>;