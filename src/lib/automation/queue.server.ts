// Secure job creation helpers. All callers must present a resolved scope
// (from auth.server) so no browser can forge organization_id / actor_type.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { AUTOMATION_LIMITS, type JobPriority, type JobTriggerType, type JobActorType } from "@/lib/constants";
import { AutomationError } from "./errors";
import { getJobDefinition, assertJobImplemented } from "./registry.server";
import type { ResolvedAutomationScope } from "./auth.server";
import { writeJobEvent } from "./runtime-audit.server";

type SB = SupabaseClient<Database>;

export interface EnqueueInput {
  jobType: string;
  ventureId?: string | null;
  assetId?: string | null;
  automationDefinitionId?: string | null;
  integrationConnectionId?: string | null;
  integrationSourceId?: string | null;
  parentJobId?: string | null;
  rootJobId?: string | null;
  triggerType?: JobTriggerType;
  actorType?: JobActorType;
  priority?: JobPriority;
  scheduledFor?: string;
  availableAt?: string;
  inputPayload?: Record<string, unknown>;
  idempotencyKey?: string;
  handlerVersion?: string;
  policyVersion?: string;
}

function bytes(v: Record<string, unknown>): number {
  return new TextEncoder().encode(JSON.stringify(v)).length;
}

function buildIdempotencyKey(scope: ResolvedAutomationScope, input: EnqueueInput, def: { handlerVersion: string; idempotencyStrategy: string }): string {
  if (input.idempotencyKey) {
    if (input.idempotencyKey.length > AUTOMATION_LIMITS.maxIdempotencyKeyLength) {
      throw new AutomationError("configuration_invalid", "idempotency key too long");
    }
    return input.idempotencyKey.slice(0, AUTOMATION_LIMITS.maxIdempotencyKeyLength);
  }
  // Deterministic server-derived key. Bucket by 60s for scheduled/routine.
  const bucket = Math.floor(Date.now() / 60000);
  const parts = [
    input.jobType,
    scope.organizationId,
    input.ventureId ?? scope.ventureId ?? "-",
    input.integrationConnectionId ?? "-",
    input.integrationSourceId ?? "-",
    input.automationDefinitionId ?? "-",
    input.parentJobId ?? "-",
    def.handlerVersion,
    def.idempotencyStrategy === "one_active_per_scope" ? "singleton" : String(bucket),
  ];
  return parts.join(":").slice(0, AUTOMATION_LIMITS.maxIdempotencyKeyLength);
}

export async function enqueueJob(
  supabase: SB,
  scope: ResolvedAutomationScope,
  input: EnqueueInput,
) {
  const def = getJobDefinition(input.jobType);
  // Not all future job types are implemented; only implemented ones may enqueue
  // for immediate execution. Others fail fast.
  assertJobImplemented(input.jobType);

  const payload = input.inputPayload ?? {};
  if (bytes(payload) > AUTOMATION_LIMITS.maxJobPayloadBytes) {
    throw new AutomationError("job_payload_too_large");
  }

  // Queue depth guard
  const { count: queued } = await supabase
    .from("automation_jobs")
    .select("id", { head: true, count: "exact" })
    .eq("organization_id", scope.organizationId)
    .in("status", ["queued", "scheduled", "blocked", "running", "retrying"]);
  if ((queued ?? 0) >= AUTOMATION_LIMITS.maxQueuedJobsPerOrg) {
    throw new AutomationError("rate_limited", "queue full");
  }

  const idempotencyKey = buildIdempotencyKey(scope, input, def);
  const scheduled = input.scheduledFor ?? new Date().toISOString();
  const available = input.availableAt ?? scheduled;

  const { data, error } = await supabase
    .from("automation_jobs")
    .insert({
      organization_id: scope.organizationId,
      venture_id: input.ventureId ?? scope.ventureId ?? null,
      asset_id: input.assetId ?? null,
      automation_definition_id: input.automationDefinitionId ?? null,
      integration_connection_id: input.integrationConnectionId ?? null,
      integration_source_id: input.integrationSourceId ?? null,
      parent_job_id: input.parentJobId ?? null,
      root_job_id: input.rootJobId ?? input.parentJobId ?? null,
      job_type: def.key,
      job_family: def.family,
      priority: input.priority ?? def.defaultPriority,
      trigger_type: input.triggerType ?? "manual",
      scheduled_for: scheduled,
      available_at: available,
      timeout_seconds: def.defaultTimeoutSeconds,
      max_attempts: Math.min(def.defaultMaxAttempts, AUTOMATION_LIMITS.maxAttempts),
      idempotency_key: idempotencyKey,
      input_payload: payload as unknown as Json,
      actor_type: input.actorType ?? "user",
      handler_version: input.handlerVersion ?? def.handlerVersion,
      policy_version: input.policyVersion ?? "v0",
      created_by: scope.userId,
    })
    .select("*")
    .single();
  if (error || !data) {
    if (error?.code === "23505") throw new AutomationError("duplicate_active_job");
    throw new AutomationError("internal_automation_error", error?.message ?? "insert failed");
  }
  await writeJobEvent(supabase, {
    organizationId: scope.organizationId,
    jobId: data.id,
    event: "job_created",
    actorType: input.actorType ?? "user",
    actorId: scope.userId,
    metadata: {
      jobType: def.key,
      triggerType: input.triggerType ?? "manual",
      actorType: input.actorType ?? "user",
      handlerVersion: def.handlerVersion,
    },
  });
  return data;
}
