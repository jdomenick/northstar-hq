// Job runner. Given a claimed job, executes the handler with timeout and
// applies retry / signal / audit / health decisions. Uses service_role.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { AUTOMATION_LIMITS } from "@/lib/constants";
import { AutomationError, isAutomationError, isPermanentErrorCode, type AutomationErrorCode } from "./errors";
import { decideRetry, computeRetryAfterIso } from "./retry.server";
import { getJobDefinition, assertJobImplemented } from "./registry.server";
import { getHandler, runWithTimeout } from "./executor.server";
import { writeJobEvent } from "./runtime-audit.server";
import { recordJobOutcome, recalculateHealth } from "./health.server";
import { automationSignalDedupKey, automationSignalSeverity, shouldEmitSignal } from "./signals.server";

type SB = SupabaseClient<Database>;
type JobRow = Database["public"]["Tables"]["automation_jobs"]["Row"];

function bytes(v: unknown): number {
  return new TextEncoder().encode(JSON.stringify(v ?? {})).length;
}

async function emitAutomationSignal(
  supabase: SB,
  job: JobRow,
  payload: { signalType: string; assetId?: string | null; title: string; description?: string; significance?: string; metadata?: Record<string, unknown> },
): Promise<void> {
  const severity = automationSignalSeverity(payload.signalType as never);
  const dedup = automationSignalDedupKey(job.organization_id, {
    signalType: payload.signalType as never,
    jobId: job.id,
    automationDefinitionId: job.automation_definition_id,
    assetId: payload.assetId ?? job.asset_id,
    title: payload.title,
  });
  await supabase.from("signals").insert({
    organization_id: job.organization_id,
    venture_id: job.venture_id,
    asset_id: payload.assetId ?? job.asset_id,
    connection_id: job.integration_connection_id,
    source_id: job.integration_source_id,
    signal_type: payload.signalType,
    severity,
    title: payload.title,
    description: payload.description ?? null,
    significance: (payload.significance as never) ?? null,
    status: "new",
    dedup_key: dedup,
    metadata: (payload.metadata ?? {}) as unknown as Json,
  });
}

export async function executeClaimedJob(
  supabase: SB,
  job: JobRow,
  workerId: string,
): Promise<{ status: "succeeded" | "failed" | "retrying"; errorCode?: string }> {
  const startMs = Date.now();
  const startedAt = new Date(startMs).toISOString();

  // Attempt record
  const { data: attempt, error: attemptErr } = await supabase
    .from("automation_job_attempts")
    .insert({
      organization_id: job.organization_id,
      job_id: job.id,
      attempt_number: job.attempt_number,
      status: "running",
      worker_id: workerId,
      input_summary: { job_type: job.job_type } as unknown as Json,
    })
    .select("id")
    .single();
  if (attemptErr) {
    // Duplicate attempt is fine; recover from prior claim.
    if (attemptErr.code !== "23505") throw new AutomationError("internal_automation_error", attemptErr.message);
  }
  const attemptId = attempt?.id ?? null;

  await writeJobEvent(supabase, {
    organizationId: job.organization_id,
    jobId: job.id,
    event: "attempt_started",
    attemptNumber: job.attempt_number,
    actorType: "worker",
    metadata: { jobType: job.job_type, attemptNumber: job.attempt_number },
  });

  let def;
  try {
    def = assertJobImplemented(job.job_type);
  } catch (err) {
    return finalizeFailure(supabase, job, attemptId, startMs, err, workerId);
  }

  try {
    const handler = getHandler(job.job_type);
    const result = await runWithTimeout(
      handler({ supabase, job, workerId }),
      Math.min(job.timeout_seconds, AUTOMATION_LIMITS.maxTimeoutSeconds),
    );

    const outputSize = bytes(result.outputSummary);
    if (outputSize > AUTOMATION_LIMITS.maxOutputSummaryBytes) {
      throw new AutomationError("job_output_too_large");
    }

    const completedAt = new Date().toISOString();
    const durationMs = Date.now() - startMs;

    if (attemptId) {
      await supabase
        .from("automation_job_attempts")
        .update({
          status: "succeeded",
          completed_at: completedAt,
          duration_ms: durationMs,
          output_summary: result.outputSummary as unknown as Json,
        })
        .eq("id", attemptId);
    }

    await supabase
      .from("automation_jobs")
      .update({
        status: "succeeded",
        completed_at: completedAt,
        output_summary: result.outputSummary as unknown as Json,
        error_code: null,
        retry_after: null,
        lease_expires_at: null,
        claimed_by: null,
      })
      .eq("id", job.id);

    await writeJobEvent(supabase, {
      organizationId: job.organization_id,
      jobId: job.id,
      event: "job_succeeded",
      attemptNumber: job.attempt_number,
      actorType: "worker",
      metadata: { jobType: job.job_type, durationMs, attemptNumber: job.attempt_number },
    });

    // Emit signals from handler
    if (result.signals) {
      for (const s of result.signals.slice(0, AUTOMATION_LIMITS.maxSignalsPerJob)) {
        if (!shouldEmitSignal(s.signalType as never)) continue;
        await emitAutomationSignal(supabase, job, s);
      }
    }

    await recordJobOutcome(supabase, {
      organizationId: job.organization_id,
      automationDefinitionId: job.automation_definition_id,
      ventureId: job.venture_id,
      completedAtIso: completedAt,
      outcome: "succeeded",
    });
    if (job.automation_definition_id) {
      await recalculateHealth(supabase, {
        organizationId: job.organization_id,
        automationDefinitionId: job.automation_definition_id,
        ventureId: job.venture_id,
      });
    }
    void def;
    return { status: "succeeded" };
  } catch (err) {
    return finalizeFailure(supabase, job, attemptId, startMs, err, workerId);
  }
}

async function finalizeFailure(
  supabase: SB,
  job: JobRow,
  attemptId: string | null,
  startMs: number,
  err: unknown,
  _workerId: string,
): Promise<{ status: "failed" | "retrying"; errorCode: string }> {
  const code: AutomationErrorCode = isAutomationError(err) ? err.code : "internal_automation_error";
  const completedAt = new Date().toISOString();
  const durationMs = Date.now() - startMs;

  if (attemptId) {
    await supabase
      .from("automation_job_attempts")
      .update({
        status: code === "timeout" ? "timed_out" : "failed",
        completed_at: completedAt,
        duration_ms: durationMs,
        error_code: code,
      })
      .eq("id", attemptId);
  }

  const def = getJobDefinition(job.job_type);
  const decision = decideRetry(def.retryPolicy, job.attempt_number, code);

  if (decision.shouldRetry && !isPermanentErrorCode(code)) {
    const retryAfter = computeRetryAfterIso(Date.now(), decision.delaySeconds);
    await supabase
      .from("automation_jobs")
      .update({
        status: "retrying",
        available_at: retryAfter,
        retry_after: retryAfter,
        error_code: code,
        lease_expires_at: null,
        claimed_by: null,
      })
      .eq("id", job.id);
    await writeJobEvent(supabase, {
      organizationId: job.organization_id,
      jobId: job.id,
      event: "retry_scheduled",
      attemptNumber: job.attempt_number,
      actorType: "worker",
      metadata: { jobType: job.job_type, errorCode: code, extra: { delaySeconds: decision.delaySeconds } },
    });
    await recordJobOutcome(supabase, {
      organizationId: job.organization_id,
      automationDefinitionId: job.automation_definition_id,
      ventureId: job.venture_id,
      completedAtIso: completedAt,
      outcome: "retryable_failure",
    });
    return { status: "retrying", errorCode: code };
  }

  await supabase
    .from("automation_jobs")
    .update({
      status: "failed",
      completed_at: completedAt,
      error_code: code,
      lease_expires_at: null,
      claimed_by: null,
    })
    .eq("id", job.id);

  await writeJobEvent(supabase, {
    organizationId: job.organization_id,
    jobId: job.id,
    event: "job_failed",
    attemptNumber: job.attempt_number,
    actorType: "worker",
    metadata: { jobType: job.job_type, errorCode: code, durationMs },
  });

  await recordJobOutcome(supabase, {
    organizationId: job.organization_id,
    automationDefinitionId: job.automation_definition_id,
    ventureId: job.venture_id,
    completedAtIso: completedAt,
    outcome: "failed",
  });

  await emitAutomationSignal(supabase, job, {
    signalType: "job_failed",
    title: `Job failed: ${job.job_type}`,
    description: code,
    metadata: { jobId: job.id, errorCode: code },
  });

  if (job.automation_definition_id) {
    await recalculateHealth(supabase, {
      organizationId: job.organization_id,
      automationDefinitionId: job.automation_definition_id,
      ventureId: job.venture_id,
    });
  }

  return { status: "failed", errorCode: code };
}
