// Authenticated server functions for the Job Engine surface:
// - manual enqueue of website_sync
// - get sanitized job status
// - cancel + retry
// All calls resolve org from membership (never from client-supplied ids).

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { AutomationError, toAutomationErrorCode, isAutomationError } from "./errors";

const OrgInput = z.object({ organizationId: z.string().uuid() });

// ── enqueueWebsiteSync ───────────────────────────────────────
const EnqueueWebsiteSyncInput = OrgInput.extend({
  connectionId: z.string().uuid(),
  sourceId: z.string().uuid(),
});

export const enqueueWebsiteSyncJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => EnqueueWebsiteSyncInput.parse(input))
  .handler(async ({ data, context }) => {
    try {
      const { resolveAutomationScope, requireRole } = await import("./auth.server");
      const scope = await resolveAutomationScope(
        context.supabase,
        context.userId,
        data.organizationId,
        { integrationConnectionId: data.connectionId, integrationSourceId: data.sourceId },
      );
      requireRole(scope, "member");
      const { enqueueJob } = await import("./queue.server");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const job = await enqueueJob(supabaseAdmin, scope, {
        jobType: "website_sync",
        integrationConnectionId: data.connectionId,
        integrationSourceId: data.sourceId,
        triggerType: "manual",
        actorType: "user",
        inputPayload: { sourceId: data.sourceId, connectionId: data.connectionId },
      });
      return {
        jobId: job.id,
        status: job.status as string,
        scheduledFor: job.scheduled_for as string,
      };
    } catch (err) {
      if (isAutomationError(err)) throw err;
      throw new AutomationError(toAutomationErrorCode(err));
    }
  });

// ── getJobStatus ─────────────────────────────────────────────
const GetJobInput = OrgInput.extend({ jobId: z.string().uuid() });
export const getAutomationJobStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => GetJobInput.parse(input))
  .handler(async ({ data, context }) => {
    const { resolveAutomationScope } = await import("./auth.server");
    const scope = await resolveAutomationScope(context.supabase, context.userId, data.organizationId);
    const { data: job, error } = await context.supabase
      .from("automation_jobs")
      .select("id, job_type, status, priority, attempt_number, max_attempts, scheduled_for, available_at, started_at, completed_at, error_code, retry_after, integration_source_id, integration_connection_id, output_summary")
      .eq("id", data.jobId)
      .eq("organization_id", scope.organizationId)
      .maybeSingle();
    if (error) throw new AutomationError("internal_automation_error");
    if (!job) throw new AutomationError("job_not_found");
    return job;
  });

// ── listRecentJobs (for connection/source) ───────────────────
const ListInput = OrgInput.extend({
  connectionId: z.string().uuid().optional(),
  sourceId: z.string().uuid().optional(),
  jobType: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional(),
});
export const listAutomationJobs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ListInput.parse(input))
  .handler(async ({ data, context }) => {
    const { resolveAutomationScope } = await import("./auth.server");
    const scope = await resolveAutomationScope(context.supabase, context.userId, data.organizationId);
    let q = context.supabase
      .from("automation_jobs")
      .select("id, job_type, status, priority, attempt_number, max_attempts, scheduled_for, started_at, completed_at, error_code, trigger_type, integration_connection_id, integration_source_id")
      .eq("organization_id", scope.organizationId)
      .order("created_at", { ascending: false })
      .limit(Math.min(data.limit ?? 20, 50));
    if (data.connectionId) q = q.eq("integration_connection_id", data.connectionId);
    if (data.sourceId) q = q.eq("integration_source_id", data.sourceId);
    if (data.jobType) q = q.eq("job_type", data.jobType);
    const { data: rows, error } = await q;
    if (error) throw new AutomationError("internal_automation_error");
    return rows ?? [];
  });

// ── cancelJob ────────────────────────────────────────────────
const CancelInput = OrgInput.extend({ jobId: z.string().uuid() });
export const cancelAutomationJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CancelInput.parse(input))
  .handler(async ({ data, context }) => {
    const { resolveAutomationScope, requireRole } = await import("./auth.server");
    const scope = await resolveAutomationScope(context.supabase, context.userId, data.organizationId);
    requireRole(scope, "admin");
    // Load first to give an honest error for running.
    const { data: job } = await context.supabase
      .from("automation_jobs")
      .select("id, status")
      .eq("id", data.jobId)
      .eq("organization_id", scope.organizationId)
      .maybeSingle();
    if (!job) throw new AutomationError("job_not_found");
    if (job.status === "running") throw new AutomationError("configuration_invalid", "job already running");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cancelled } = await supabaseAdmin.rpc("automation_cancel_job", {
      _job_id: data.jobId,
      _organization_id: scope.organizationId,
      _reason: "cancelled_by_user",
    });
    const row = Array.isArray(cancelled) ? cancelled[0] : null;
    if (!row) throw new AutomationError("invalid_job_transition");
    return { ok: true, status: (row as { status: string }).status };
  });

// ── retryJob (creates a new job linked to the prior) ─────────
const RetryInput = OrgInput.extend({ jobId: z.string().uuid() });
export const retryAutomationJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RetryInput.parse(input))
  .handler(async ({ data, context }) => {
    try {
      const { resolveAutomationScope, requireRole } = await import("./auth.server");
      const scope = await resolveAutomationScope(context.supabase, context.userId, data.organizationId);
      requireRole(scope, "admin");
      const { data: prior } = await context.supabase
        .from("automation_jobs")
        .select("*")
        .eq("id", data.jobId)
        .eq("organization_id", scope.organizationId)
        .maybeSingle();
      if (!prior) throw new AutomationError("job_not_found");
      if (!["failed", "expired", "cancelled"].includes(prior.status as string)) {
        throw new AutomationError("invalid_job_transition", "job is not in a retryable terminal state");
      }
      const { enqueueJob } = await import("./queue.server");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const job = await enqueueJob(supabaseAdmin, scope, {
        jobType: prior.job_type as string,
        integrationConnectionId: prior.integration_connection_id ?? undefined,
        integrationSourceId: prior.integration_source_id ?? undefined,
        assetId: prior.asset_id ?? undefined,
        automationDefinitionId: prior.automation_definition_id ?? undefined,
        parentJobId: prior.id,
        rootJobId: (prior.root_job_id as string | null) ?? prior.id,
        triggerType: "retry",
        actorType: "user",
        inputPayload: (prior.input_payload as Record<string, unknown>) ?? {},
      });
      return { jobId: job.id, status: job.status as string };
    } catch (err) {
      if (isAutomationError(err)) throw err;
      throw new AutomationError(toAutomationErrorCode(err));
    }
  });
