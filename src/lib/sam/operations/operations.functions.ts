// Public server function surface for SAM Content Operations.
//
// A single `runSamOperation` server function dispatches by operation name.
// The dispatcher owns:
//   1. requireSupabaseAuth (bearer verification)
//   2. per-op Zod input validation
//   3. handing off to the pure op implementation in `ops.server`
//   4. returning the OperationResult unchanged - the caller (SAM chat, UI,
//      test harness) receives a fully typed, structured outcome
//
// Every result carries `status`, `summary`, `affectedRecords`, and a version
// stamp so downstream Brief and audit surfaces can trust its shape.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

import { SAM_OPERATION_NAMES, SAM_OPERATIONS_VERSION, type OperationResult, type SamOperationName } from "./types";
import * as ops from "./ops.server";

const RunInput = z.object({
  operation: z.enum(SAM_OPERATION_NAMES),
  payload: z.record(z.string(), z.unknown()),
});

function ctx(supabase: unknown, userId: string) {
  return { supabase: supabase as never, userId };
}

async function dispatch(operation: SamOperationName, payload: unknown, c: { supabase: never; userId: string }): Promise<OperationResult> {
  switch (operation) {
    case "createSocialPlan":
      return ops.createSocialPlan(c, ops.CreateSocialPlanInput.parse(payload));
    case "createPlatformVariants":
      return ops.createPlatformVariants(c, ops.CreatePlatformVariantsInput.parse(payload));
    case "shortenVariant":
      return ops.shortenVariant(c, ops.EditVariantInput.parse(payload));
    case "expandVariant":
      return ops.expandVariant(c, ops.EditVariantInput.parse(payload));
    case "changeTone":
      return ops.changeTone(c, ops.EditVariantInput.parse(payload));
    case "strengthenHook":
      return ops.strengthenHook(c, ops.EditVariantInput.parse(payload));
    case "reducePromotion":
      return ops.reducePromotion(c, ops.EditVariantInput.parse(payload));
    case "changeCTA":
      return ops.changeCTA(c, ops.EditVariantInput.parse(payload));
    case "suggestHashtags":
      return ops.suggestHashtags(c, ops.EditVariantInput.parse(payload));
    case "regenerateVariant":
      return ops.regenerateVariant(c, ops.EditVariantInput.parse(payload));
    case "rewriteVariant":
      return ops.rewriteVariant(c, ops.EditVariantInput.parse(payload));
    case "submitForApproval":
      return ops.submitVariantForApproval(c, z.object({ organizationId: z.string().uuid(), ventureId: z.string().uuid(), contentItemId: z.string().uuid(), notes: z.string().max(2000).optional() }).parse(payload));
    case "approveVariant":
      return ops.approveVariant(c, z.object({ organizationId: z.string().uuid(), ventureId: z.string().uuid(), contentItemId: z.string().uuid(), notes: z.string().max(2000).optional() }).parse(payload));
    case "rejectVariant": {
      const parsed = z.object({ organizationId: z.string().uuid(), ventureId: z.string().uuid(), contentItemId: z.string().uuid(), reason: z.string().min(3).max(2000), notes: z.string().max(2000).optional() }).parse(payload);
      return ops.rejectVariant(c, parsed);
    }
    case "requestRevision": {
      const parsed = z.object({ organizationId: z.string().uuid(), ventureId: z.string().uuid(), contentItemId: z.string().uuid(), notes: z.string().min(3).max(2000) }).parse(payload);
      return ops.requestVariantRevision(c, parsed);
    }
    case "approveBatch":
      return ops.approveBatch(c, ops.ApproveBatchInput.parse(payload));
    case "scheduleVariant":
      return ops.scheduleVariantOp(c, ops.ScheduleVariantOpInput.parse(payload));
    case "rescheduleVariant":
      return ops.rescheduleVariantOp(c, ops.ScheduleVariantOpInput.parse(payload));
    case "unscheduleVariant":
      return ops.unscheduleVariantOp(c, ops.UnscheduleOpInput.parse(payload));
    case "cancelPublication":
      return ops.cancelPublicationOp(c, ops.UnscheduleOpInput.parse(payload));
    case "scheduleBatch":
      return ops.scheduleBatchOp(c, ops.ScheduleBatchOpInput.parse(payload));
    case "pauseSocialPublishing":
      return ops.pauseSocialPublishing(c, ops.PauseOpInput.parse(payload));
    case "resumeSocialPublishing":
      return ops.resumeSocialPublishing(c, ops.ResumeOpInput.parse(payload));
    case "attachExistingAsset":
      return ops.attachExistingAsset(c, ops.AttachAssetInput.parse(payload));
    case "detachAsset":
      return ops.detachAsset(c, ops.DetachAssetInput.parse(payload));
    case "listPublishingDestinations":
      return ops.listPublishingDestinations(c, ops.ListDestinationsInput.parse(payload));
    case "explainBlockedPublication":
      return ops.explainBlockedPublication(c, ops.ExplainBlockedInput.parse(payload));
    case "publishApprovedVariant":
    case "retryPublication":
      return ops.publishApprovedVariant(c, ops.PublishOpInput.parse(payload));
    // Not-yet-implemented ops return a truthful failed result rather than a
    // fake success. They become real handlers as later stages ship.
    case "reviseSocialPlan":
    case "createCampaign":
    case "updateVariant":
    case "suggestCreativeBrief":
      return {
        operation,
        version: SAM_OPERATIONS_VERSION,
        organizationId: (payload as { organizationId?: string }).organizationId ?? "",
        ventureId: (payload as { ventureId?: string | null }).ventureId ?? null,
        actorUserId: c.userId,
        status: "failed",
        summary: `The '${operation}' operation is defined but not yet implemented.`,
        reasonCode: "server_error",
        message: `Operation '${operation}' has no handler in the current build. Use its underlying editor primitives directly.`,
        affectedRecords: [],
        durationMs: 0,
      };
  }
}

export const runSamOperation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RunInput.parse(input))
  .handler(async ({ data, context }) => {
    const result = await dispatch(data.operation, data.payload, ctx(context.supabase, context.userId));
    // Result is already JSON-safe (see result-builders + types). Cast avoids
    // TSS's Serializable inference recursing into `Record<string, unknown>`.
    return result as unknown as { status: string; operation: string; summary: string };
  });