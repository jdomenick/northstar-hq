// Pure Zod input schemas for SAM Content Operations. Kept separate from
// ops.server.ts so tests can import them without dragging in server-only
// dependencies (Supabase client, aliased imports, etc.).

import { z } from "zod";

const uuid = z.string().uuid();

export const CreateSocialPlanInput = z.object({
  organizationId: uuid,
  ventureId: uuid,
  name: z.string().min(3).max(200),
  objective: z.string().max(2000).optional(),
  strategyPeriodStart: z.string().datetime(),
  strategyPeriodEnd: z.string().datetime(),
  platforms: z.array(z.string()).min(1).max(12),
  pillars: z.array(z.object({
    id: z.string(), name: z.string(), targetRatio: z.number().min(0).max(1).optional(),
  })).default([]),
  postingCadencePerWeek: z.record(z.string(), z.number().int().min(0).max(50)).default({}),
  promotionRatioLimit: z.number().min(0).max(1).nullable().optional(),
});

export const CreatePlatformVariantsInput = z.object({
  organizationId: uuid, ventureId: uuid, parentContentItemId: uuid,
  platforms: z.array(z.string()).min(1).max(12),
  contentType: z.string().default("post"),
});

export const EditVariantInput = z.object({
  organizationId: uuid, ventureId: uuid, contentItemId: uuid,
  instruction: z.string().max(1000).optional(),
  overrideApproved: z.boolean().default(false),
});

export const ApprovalRefInput = z.object({
  organizationId: uuid, ventureId: uuid, contentItemId: uuid,
  notes: z.string().max(2000).optional(),
});

export const RejectVariantInput = ApprovalRefInput.extend({
  reason: z.string().min(3).max(2000),
});

export const RequestRevisionInput = z.object({
  organizationId: uuid, ventureId: uuid, contentItemId: uuid,
  notes: z.string().min(3).max(2000),
});

export const ApproveBatchInput = z.object({
  organizationId: uuid, ventureId: uuid,
  contentItemIds: z.array(uuid).min(1).max(50),
  notes: z.string().max(2000).optional(),
  confirmationToken: z.string().min(8).max(200),
});

export const ScheduleVariantOpInput = z.object({
  organizationId: uuid, ventureId: uuid, contentItemId: uuid,
  scheduledForUtc: z.string().datetime().optional(),
  wallTime: z.object({
    year: z.number().int(), month: z.number().int().min(1).max(12), day: z.number().int().min(1).max(31),
    hour: z.number().int().min(0).max(23), minute: z.number().int().min(0).max(59),
  }).optional(),
});

export const UnscheduleOpInput = z.object({
  organizationId: uuid, ventureId: uuid, contentItemId: uuid,
  reason: z.string().max(500).optional(),
});

export const ScheduleBatchOpInput = z.object({
  organizationId: uuid, ventureId: uuid,
  items: z.array(z.object({
    contentItemId: uuid,
    scheduledForUtc: z.string().datetime().optional(),
  })).min(1).max(100),
});

export const PauseOpInput = z.object({ organizationId: uuid, ventureId: uuid, reason: z.string().min(3).max(500) });
export const ResumeOpInput = z.object({ organizationId: uuid, ventureId: uuid });

export const AttachAssetInput = z.object({
  organizationId: uuid, ventureId: uuid, contentItemId: uuid,
  contentVersionId: uuid, mediaAssetId: uuid,
  role: z.string().optional(), displayOrder: z.number().int().min(0).max(1000).optional(),
});
export const DetachAssetInput = z.object({ organizationId: uuid, ventureId: uuid, attachmentId: uuid });

export const ListDestinationsInput = z.object({ organizationId: uuid, ventureId: uuid.nullable().optional() });
export const ExplainBlockedInput = z.object({ organizationId: uuid, ventureId: uuid, contentItemId: uuid });
export const PublishOpInput = z.object({ organizationId: uuid, ventureId: uuid, contentItemId: uuid });