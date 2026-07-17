// Persistence helpers. Read/list/insert-of-metadata operations only. No
// worker/claim/run logic (that lands in 3D.2c-ii). Every helper requires a
// pre-resolved scope so client-supplied organization_id cannot be trusted.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import {
  AUTOMATION_LIMITS,
  type AutomationHealthBand,
  type JobFamily,
  type JobPriority,
  type JobTriggerType,
} from "@/lib/constants";
import { AutomationError } from "./errors";
import { getJobDefinition } from "./registry.server";
import type { ResolvedAutomationScope } from "./auth.server";
import { requireRole } from "./auth.server";

type SB = SupabaseClient<Database>;

function toJson(v: Record<string, unknown> | undefined): Json {
  return (v ?? {}) as unknown as Json;
}

function assertByteSize(value: Record<string, unknown>, cap: number, code: "job_payload_too_large" | "job_output_too_large" | "health_snapshot_invalid") {
  const size = new TextEncoder().encode(JSON.stringify(value)).length;
  if (size > cap) throw new AutomationError(code);
}

// ─────────────────────────────────────────────
// Automation definitions
// ─────────────────────────────────────────────

export interface CreateAutomationDefinitionInput {
  name: string;
  automationKey: string;
  automationFamily: JobFamily;
  ventureId?: string | null;
  assetId?: string | null;
  integrationConnectionId?: string | null;
  triggerType?: JobTriggerType;
  scheduleExpression?: string | null;
  timezone?: string;
  priority?: JobPriority;
  configuration?: Record<string, unknown>;
  policy?: Record<string, unknown>;
  ownerId?: string | null;
  enabled?: boolean;
}

export async function createAutomationDefinition(
  supabase: SB,
  scope: ResolvedAutomationScope,
  input: CreateAutomationDefinitionInput,
) {
  requireRole(scope, "admin");
  if (!/^[a-z0-9_.:-]{2,120}$/i.test(input.automationKey)) {
    throw new AutomationError("configuration_invalid", "invalid automation_key");
  }
  const { data, error } = await supabase
    .from("automation_definitions")
    .insert({
      organization_id: scope.organizationId,
      venture_id: input.ventureId ?? null,
      asset_id: input.assetId ?? null,
      integration_connection_id: input.integrationConnectionId ?? null,
      name: input.name,
      automation_key: input.automationKey,
      automation_family: input.automationFamily,
      trigger_type: input.triggerType ?? "manual",
      schedule_expression: input.scheduleExpression ?? null,
      timezone: input.timezone ?? "UTC",
      priority: input.priority ?? "normal",
      configuration: toJson(input.configuration),
      policy: toJson(input.policy),
      owner_id: input.ownerId ?? scope.userId,
      enabled: input.enabled ?? true,
      created_by: scope.userId,
    })
    .select("*")
    .single();
  if (error || !data) {
    if (error?.code === "23505") throw new AutomationError("configuration_invalid", "automation_key already used");
    throw new AutomationError("internal_automation_error", error?.message ?? "insert failed");
  }
  return data;
}

export async function updateAutomationDefinition(
  supabase: SB,
  scope: ResolvedAutomationScope,
  id: string,
  patch: Partial<Omit<CreateAutomationDefinitionInput, "automationKey" | "automationFamily">>
    & { status?: "active" | "paused" | "disabled" | "archived" },
) {
  requireRole(scope, "admin");
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.enabled !== undefined) update.enabled = patch.enabled;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.triggerType !== undefined) update.trigger_type = patch.triggerType;
  if (patch.scheduleExpression !== undefined) update.schedule_expression = patch.scheduleExpression;
  if (patch.timezone !== undefined) update.timezone = patch.timezone;
  if (patch.priority !== undefined) update.priority = patch.priority;
  if (patch.configuration !== undefined) update.configuration = toJson(patch.configuration);
  if (patch.policy !== undefined) update.policy = toJson(patch.policy);
  if (patch.ownerId !== undefined) update.owner_id = patch.ownerId;

  const { data, error } = await supabase
    .from("automation_definitions")
    .update(update)
    .eq("id", id)
    .eq("organization_id", scope.organizationId)
    .is("deleted_at", null)
    .select("*")
    .maybeSingle();
  if (error) throw new AutomationError("internal_automation_error", error.message);
  if (!data) throw new AutomationError("automation_not_found");
  return data;
}

export async function getAutomationDefinition(supabase: SB, scope: ResolvedAutomationScope, id: string) {
  const { data, error } = await supabase
    .from("automation_definitions")
    .select("*")
    .eq("id", id)
    .eq("organization_id", scope.organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new AutomationError("internal_automation_error", error.message);
  if (!data) throw new AutomationError("automation_not_found");
  return data;
}

export async function listAutomationDefinitions(
  supabase: SB,
  scope: ResolvedAutomationScope,
  opts: { ventureId?: string | null; family?: JobFamily; limit?: number } = {},
) {
  const limit = Math.min(opts.limit ?? 50, AUTOMATION_LIMITS.maxJobListPageSize);
  let q = supabase
    .from("automation_definitions")
    .select("*")
    .eq("organization_id", scope.organizationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (opts.ventureId !== undefined) {
    q = opts.ventureId === null ? q.is("venture_id", null) : q.eq("venture_id", opts.ventureId);
  }
  if (opts.family) q = q.eq("automation_family", opts.family);
  const { data, error } = await q;
  if (error) throw new AutomationError("internal_automation_error", error.message);
  return data ?? [];
}

// ─────────────────────────────────────────────
// Jobs (metadata-only helpers; no worker execution)
// ─────────────────────────────────────────────

export interface CreateJobInput {
  jobType: string;
  triggerType?: JobTriggerType;
  ventureId?: string | null;
  assetId?: string | null;
  automationDefinitionId?: string | null;
  integrationConnectionId?: string | null;
  integrationSourceId?: string | null;
  parentJobId?: string | null;
  rootJobId?: string | null;
  scheduledFor?: string;
  availableAt?: string;
  priority?: JobPriority;
  timeoutSeconds?: number;
  maxAttempts?: number;
  idempotencyKey: string;
  inputPayload?: Record<string, unknown>;
  actorType?: "user" | "system" | "scheduler" | "worker" | "sam" | "integration";
  handlerVersion?: string;
  policyVersion?: string;
}

export async function createJob(supabase: SB, scope: ResolvedAutomationScope, input: CreateJobInput) {
  const def = getJobDefinition(input.jobType);
  const payload = input.inputPayload ?? {};
  assertByteSize(payload, AUTOMATION_LIMITS.maxJobPayloadBytes, "job_payload_too_large");
  if (input.idempotencyKey.length > AUTOMATION_LIMITS.maxIdempotencyKeyLength) {
    throw new AutomationError("invalid_job_payload", "idempotency_key too long");
  }
  const timeout = Math.min(
    Math.max(input.timeoutSeconds ?? def.defaultTimeoutSeconds, AUTOMATION_LIMITS.minTimeoutSeconds),
    AUTOMATION_LIMITS.maxTimeoutSeconds,
  );
  const maxAttempts = Math.min(
    Math.max(input.maxAttempts ?? def.defaultMaxAttempts, 1),
    AUTOMATION_LIMITS.maxAttempts,
  );
  const { data, error } = await supabase
    .from("automation_jobs")
    .insert({
      organization_id: scope.organizationId,
      venture_id: input.ventureId ?? null,
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
      scheduled_for: input.scheduledFor ?? new Date().toISOString(),
      available_at: input.availableAt ?? new Date().toISOString(),
      timeout_seconds: timeout,
      max_attempts: maxAttempts,
      idempotency_key: input.idempotencyKey,
      input_payload: toJson(payload),
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
  return data;
}

export async function getJob(supabase: SB, scope: ResolvedAutomationScope, id: string) {
  const { data, error } = await supabase
    .from("automation_jobs")
    .select("*")
    .eq("id", id)
    .eq("organization_id", scope.organizationId)
    .maybeSingle();
  if (error) throw new AutomationError("internal_automation_error", error.message);
  if (!data) throw new AutomationError("job_not_found");
  return data;
}

export async function listJobs(
  supabase: SB,
  scope: ResolvedAutomationScope,
  opts: {
    ventureId?: string | null;
    jobType?: string;
    status?: string;
    limit?: number;
  } = {},
) {
  const limit = Math.min(opts.limit ?? 50, AUTOMATION_LIMITS.maxJobListPageSize);
  let q = supabase
    .from("automation_jobs")
    .select("*")
    .eq("organization_id", scope.organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (opts.ventureId !== undefined) {
    q = opts.ventureId === null ? q.is("venture_id", null) : q.eq("venture_id", opts.ventureId);
  }
  if (opts.jobType) q = q.eq("job_type", opts.jobType);
  if (opts.status) q = q.eq("status", opts.status);
  const { data, error } = await q;
  if (error) throw new AutomationError("internal_automation_error", error.message);
  return data ?? [];
}

// ─────────────────────────────────────────────
// Attempts / events / dependencies / health
// ─────────────────────────────────────────────

export interface CreateAttemptInput {
  jobId: string;
  attemptNumber: number;
  workerId?: string | null;
  inputSummary?: Record<string, unknown>;
}

export async function createJobAttempt(supabase: SB, scope: ResolvedAutomationScope, input: CreateAttemptInput) {
  const { data, error } = await supabase
    .from("automation_job_attempts")
    .insert({
      organization_id: scope.organizationId,
      job_id: input.jobId,
      attempt_number: input.attemptNumber,
      worker_id: input.workerId ?? null,
      input_summary: toJson(input.inputSummary),
    })
    .select("*")
    .single();
  if (error || !data) {
    if (error?.code === "23505") throw new AutomationError("duplicate_attempt");
    throw new AutomationError("internal_automation_error", error?.message ?? "attempt insert failed");
  }
  return data;
}

export async function createJobEvent(
  supabase: SB,
  scope: ResolvedAutomationScope,
  input: {
    jobId: string;
    eventType: string;
    eventKey?: string | null;
    actorType?: "user" | "system" | "scheduler" | "worker" | "sam" | "integration";
    actorId?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  const meta = input.metadata ?? {};
  assertByteSize(meta, AUTOMATION_LIMITS.maxEventMetadataBytes, "job_output_too_large");
  const { data, error } = await supabase
    .from("automation_job_events")
    .insert({
      organization_id: scope.organizationId,
      job_id: input.jobId,
      event_type: input.eventType,
      event_key: input.eventKey ?? null,
      actor_type: input.actorType ?? "system",
      actor_id: input.actorId ?? null,
      metadata: toJson(meta),
    })
    .select("*")
    .maybeSingle();
  if (error) {
    // Unique-key collisions on (job_id, event_type, event_key) are treated
    // as idempotent no-ops by the runner in 3D.2c-ii.
    if (error.code === "23505") return null;
    throw new AutomationError("internal_automation_error", error.message);
  }
  return data;
}

export async function addJobDependency(
  supabase: SB,
  scope: ResolvedAutomationScope,
  input: {
    jobId: string;
    dependsOnJobId: string;
    dependencyType?: "requires_success" | "requires_completion" | "runs_after" | "optional";
  },
) {
  if (input.jobId === input.dependsOnJobId) throw new AutomationError("self_dependency");
  const { data, error } = await supabase
    .from("automation_job_dependencies")
    .insert({
      organization_id: scope.organizationId,
      job_id: input.jobId,
      depends_on_job_id: input.dependsOnJobId,
      dependency_type: input.dependencyType ?? "requires_success",
    })
    .select("*")
    .single();
  if (error || !data) {
    if (error?.code === "23505") throw new AutomationError("invalid_dependency_type", "dependency already exists");
    if (error?.message?.includes("single organization")) throw new AutomationError("cross_org_dependency");
    throw new AutomationError("internal_automation_error", error?.message ?? "dependency insert failed");
  }
  return data;
}

export async function listJobDependencies(supabase: SB, scope: ResolvedAutomationScope, jobId: string) {
  const { data, error } = await supabase
    .from("automation_job_dependencies")
    .select("*")
    .eq("organization_id", scope.organizationId)
    .eq("job_id", jobId);
  if (error) throw new AutomationError("internal_automation_error", error.message);
  return data ?? [];
}

export async function createHealthSnapshot(
  supabase: SB,
  scope: ResolvedAutomationScope,
  input: {
    automationDefinitionId?: string | null;
    ventureId?: string | null;
    healthScore: number;
    healthBand: AutomationHealthBand;
    signalBreakdown?: Record<string, unknown>;
    version?: string;
  },
) {
  if (input.healthScore < 0 || input.healthScore > 100 || !Number.isFinite(input.healthScore)) {
    throw new AutomationError("health_snapshot_invalid");
  }
  const breakdown = input.signalBreakdown ?? {};
  assertByteSize(breakdown, AUTOMATION_LIMITS.maxHealthPayloadBytes, "health_snapshot_invalid");
  const { data, error } = await supabase
    .from("automation_health_snapshots")
    .insert({
      organization_id: scope.organizationId,
      venture_id: input.ventureId ?? null,
      automation_definition_id: input.automationDefinitionId ?? null,
      health_score: Math.round(input.healthScore),
      health_band: input.healthBand,
      signal_breakdown: toJson(breakdown),
      version: input.version ?? "v0",
    })
    .select("*")
    .single();
  if (error || !data) throw new AutomationError("internal_automation_error", error?.message ?? "health insert failed");
  return data;
}

export async function listHealthSnapshots(
  supabase: SB,
  scope: ResolvedAutomationScope,
  opts: { automationDefinitionId?: string; limit?: number } = {},
) {
  const limit = Math.min(opts.limit ?? 50, AUTOMATION_LIMITS.maxJobListPageSize);
  let q = supabase
    .from("automation_health_snapshots")
    .select("*")
    .eq("organization_id", scope.organizationId)
    .order("calculated_at", { ascending: false })
    .limit(limit);
  if (opts.automationDefinitionId) q = q.eq("automation_definition_id", opts.automationDefinitionId);
  const { data, error } = await q;
  if (error) throw new AutomationError("internal_automation_error", error.message);
  return data ?? [];
}