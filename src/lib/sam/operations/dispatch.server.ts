// Free-text SAM command dispatch.
//
// Parses a natural-language message into a typed SAM operation proposal.
// This module does NOT execute the operation - it returns a validated
// proposal that the caller (SAM chat) can present for confirmation. Every
// operation must still land on the same typed dispatcher (`runSamOperation`)
// so the same auth, RLS, validation, and audit paths run.
//
// Safety rules:
// 1. The operation name must appear in SAM_OPERATION_NAMES; anything else is
//    rejected up front.
// 2. The proposed payload must parse against the corresponding Zod schema.
//    If it fails, we surface `missingFields` and never execute.
// 3. Destructive operations (publish, approve batch, pause, reject) always
//    require explicit user confirmation - `requiresConfirmation: true`.
// 4. The AI provider only proposes; it cannot fabricate authorization.

import { z } from "zod";
import { selectProvider } from "@/lib/sam/providers/registry.server";
import {
  SAM_OPERATION_NAMES,
  SamOperationNameSchema,
  type SamOperationName,
} from "./types";
import * as schemas from "./schemas";

/** Ops whose execution can mutate live venture state; always confirm. */
export const DESTRUCTIVE_OPERATIONS = new Set<SamOperationName>([
  "publishApprovedVariant",
  "retryPublication",
  "approveVariant",
  "approveBatch",
  "rejectVariant",
  "requestRevision",
  "scheduleVariant",
  "rescheduleVariant",
  "unscheduleVariant",
  "cancelPublication",
  "scheduleBatch",
  "pauseSocialPublishing",
  "resumeSocialPublishing",
  "createSocialPlan",
  "createCampaign",
  "createPlatformVariants",
  "attachExistingAsset",
  "detachAsset",
]);

const SCHEMA_LOOKUP: Partial<Record<SamOperationName, z.ZodTypeAny>> = {
  createSocialPlan: schemas.CreateSocialPlanInput,
  createPlatformVariants: schemas.CreatePlatformVariantsInput,
  shortenVariant: schemas.EditVariantInput,
  expandVariant: schemas.EditVariantInput,
  changeTone: schemas.EditVariantInput,
  strengthenHook: schemas.EditVariantInput,
  reducePromotion: schemas.EditVariantInput,
  changeCTA: schemas.EditVariantInput,
  suggestHashtags: schemas.EditVariantInput,
  regenerateVariant: schemas.EditVariantInput,
  rewriteVariant: schemas.EditVariantInput,
  updateVariant: schemas.EditVariantInput,
  submitForApproval: schemas.ApprovalRefInput,
  approveVariant: schemas.ApprovalRefInput,
  rejectVariant: schemas.RejectVariantInput,
  requestRevision: schemas.RequestRevisionInput,
  approveBatch: schemas.ApproveBatchInput,
  scheduleVariant: schemas.ScheduleVariantOpInput,
  rescheduleVariant: schemas.ScheduleVariantOpInput,
  unscheduleVariant: schemas.UnscheduleOpInput,
  cancelPublication: schemas.UnscheduleOpInput,
  scheduleBatch: schemas.ScheduleBatchOpInput,
  pauseSocialPublishing: schemas.PauseOpInput,
  resumeSocialPublishing: schemas.ResumeOpInput,
  attachExistingAsset: schemas.AttachAssetInput,
  detachAsset: schemas.DetachAssetInput,
  listPublishingDestinations: schemas.ListDestinationsInput,
  explainBlockedPublication: schemas.ExplainBlockedInput,
  publishApprovedVariant: schemas.PublishOpInput,
  retryPublication: schemas.PublishOpInput,
  retrieveApprovalQueue: schemas.RetrieveApprovalQueueInput,
  retrieveScheduledContent: schemas.RetrieveScheduledContentInput,
  retrievePublicationStatus: schemas.RetrievePublicationStatusInput,
  retrievePerformance: schemas.RetrievePerformanceInput,
  retrieveLearnings: schemas.RetrieveLearningsInput,
  recommendNextPlan: schemas.RecommendNextPlanInput,
  validateSocialConnection: schemas.ValidateSocialConnectionInput,
  suggestCreativeBrief: schemas.SuggestCreativeBriefInput,
};

export type ProposalStatus = "ready" | "needs_fields" | "unsupported" | "invalid";

export interface OperationProposal {
  status: ProposalStatus;
  operation: SamOperationName | null;
  payload: Record<string, unknown> | null;
  confidence: number;
  requiresConfirmation: boolean;
  missingFields: string[];
  reason: string;
}

/** Pure classifier for tests. Never calls the AI provider. */
export function parseOperationProposal(
  raw: unknown,
  organizationId: string,
  ventureId?: string | null,
): OperationProposal {
  if (!raw || typeof raw !== "object") {
    return {
      status: "invalid", operation: null, payload: null, confidence: 0,
      requiresConfirmation: false, missingFields: [], reason: "no proposal returned",
    };
  }
  const r = raw as { operation?: unknown; payload?: unknown; confidence?: unknown };
  const opName = SamOperationNameSchema.safeParse(r.operation);
  if (!opName.success) {
    return {
      status: "unsupported", operation: null, payload: null, confidence: 0,
      requiresConfirmation: false, missingFields: [],
      reason: `unknown operation: ${String(r.operation).slice(0, 60)}`,
    };
  }
  const schema = SCHEMA_LOOKUP[opName.data];
  if (!schema) {
    return {
      status: "unsupported", operation: opName.data, payload: null, confidence: 0,
      requiresConfirmation: false, missingFields: [],
      reason: `no schema registered for ${opName.data}`,
    };
  }
  const rawPayload = (r.payload && typeof r.payload === "object")
    ? { ...(r.payload as Record<string, unknown>) } : {};
  // Inject caller-provided scoping: never trust the model for these.
  rawPayload.organizationId = organizationId;
  if (ventureId != null && rawPayload.ventureId === undefined) rawPayload.ventureId = ventureId;

  const parsed = schema.safeParse(rawPayload);
  const confidence = typeof r.confidence === "number"
    ? Math.max(0, Math.min(1, r.confidence)) : 0.5;
  const requiresConfirmation = DESTRUCTIVE_OPERATIONS.has(opName.data);
  if (!parsed.success) {
    const missing = parsed.error.issues
      .slice(0, 10)
      .map((i) => i.path.join(".") || "(root)");
    return {
      status: "needs_fields", operation: opName.data, payload: rawPayload,
      confidence, requiresConfirmation, missingFields: missing,
      reason: "payload does not satisfy the operation schema",
    };
  }
  return {
    status: "ready", operation: opName.data, payload: parsed.data as Record<string, unknown>,
    confidence, requiresConfirmation, missingFields: [], reason: "ok",
  };
}

const ProposalResponseSchema = z.object({
  operation: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).default({}),
  confidence: z.number().min(0).max(1).default(0.5),
  rationale: z.string().max(500).optional(),
});

export interface ProposeInput {
  orgId: string;
  ventureId?: string | null;
  message: string;
  /** Optional context refs the user is currently viewing (variant id, plan id, etc.). */
  context?: { contentItemId?: string; planId?: string; platform?: string };
}

/** Ask the SAM completion provider to classify the message into a typed
 *  operation proposal. Never executes it; caller decides. */
export async function proposeOperationFromText(input: ProposeInput): Promise<OperationProposal> {
  const provider = selectProvider("content_edit");
  const system = [
    "You are SAM's command router. Read the user's message and produce a",
    "single JSON object proposing ONE typed operation. Do NOT execute it.",
    "",
    "Rules:",
    "1. `operation` MUST be one of the allowed names below. If nothing fits,",
    "   return `\"operation\": \"__unsupported\"`.",
    "2. `payload` MUST use the exact field names of the operation's schema.",
    "3. Never invent UUIDs. If an id is required and not provided in context,",
    "   leave it out - the caller will flag `needs_fields`.",
    "4. Never propose destructive publish/approve unless the user explicitly",
    "   asked for it.",
    "",
    `Allowed operations: ${SAM_OPERATION_NAMES.join(", ")}`,
  ].join("\n");

  const contextLine = input.context
    ? `Current context: ${JSON.stringify(input.context)}`
    : "Current context: (none)";

  let response;
  try {
    response = await provider.generateStructuredResponse<z.infer<typeof ProposalResponseSchema>>({
      promptVersion: "sam.operations.dispatch.v1",
      system,
      messages: [{
        role: "user",
        content: [contextLine, "", "User message:", input.message].join("\n"),
      }],
      responseSchema: ProposalResponseSchema,
      metadata: { orgId: input.orgId, intent: "sam_dispatch" },
      maxOutputTokens: 600,
    });
  } catch (err) {
    return {
      status: "invalid", operation: null, payload: null, confidence: 0,
      requiresConfirmation: false, missingFields: [],
      reason: err instanceof Error ? err.message.slice(0, 200) : "provider unavailable",
    };
  }
  return parseOperationProposal(response.content, input.orgId, input.ventureId);
}