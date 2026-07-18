// intelligence.sweep handler. Runs deterministic executive pattern
// detectors + recommendation + health + digest engines for the job's
// organization. Idempotent by (org, pattern_key, entity_ref) at the
// database layer; safe to schedule hourly.

import { z } from "zod";
import { registerHandler, type HandlerFn } from "../executor.server";
import { AutomationError } from "../errors";
import { runIntelligenceSweepFor } from "@/lib/sam/intelligence/sweep.server";

export const IntelligenceSweepInputSchema = z
  .object({})
  .catchall(z.unknown())
  .default({});

const handler: HandlerFn = async ({ supabase, job }) => {
  if (!job.organization_id) throw new AutomationError("malformed_input", "missing org");
  IntelligenceSweepInputSchema.parse(job.input_payload ?? {});
  const result = await runIntelligenceSweepFor(supabase, job.organization_id, null);
  return {
    outputSummary: {
      version: result.version,
      insightsPersisted: result.insightsPersisted,
      recommendationsPersisted: result.recommendationsPersisted,
      overallHealth: result.overallHealth,
      digestId: result.digestId,
      healthSnapshotId: result.healthSnapshotId,
    },
    signals: [],
  };
};

registerHandler("intelligence.sweep", handler);