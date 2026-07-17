// Persistence helpers for workflow runs. RLS-safe, org-scoped.
// Failed runs retain a sanitized failure code — never a raw stack.
// Deterministic findings can be persisted even when provider synthesis fails.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { SamError } from "@/lib/errors";
import { SAM_WORKFLOW_LIMITS } from "@/lib/constants";
import type {
  WorkflowType,
  WorkflowStatus,
  WorkflowTriggerType,
  WorkflowFinding,
  WorkflowCitation,
  WorkflowFeedbackType,
} from "./types";

type Client = SupabaseClient<Database>;

export interface CreatePendingInput {
  orgId: string;
  userId: string;
  workflowType: WorkflowType;
  ventureId: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  trigger: WorkflowTriggerType;
  input_snapshot: Record<string, unknown>;
  workflow_version: string;
  prompt_version: string;
  constitution_version: string;
  pipeline_version: string;
  confidence_version: string;
  memory_version: string;
  graph_version: string;
}

export async function createPendingRun(supabase: Client, input: CreatePendingInput): Promise<string> {
  const { data, error } = await supabase
    .from("sam_workflow_runs")
    .insert({
      organization_id: input.orgId,
      initiated_by: input.userId,
      workflow_type: input.workflowType,
      venture_id: input.ventureId,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      trigger_type: input.trigger,
      status: "pending",
      input_snapshot: input.input_snapshot as never,
      workflow_version: input.workflow_version,
      prompt_version: input.prompt_version,
      constitution_version: input.constitution_version,
      pipeline_version: input.pipeline_version,
      confidence_version: input.confidence_version,
      memory_version: input.memory_version,
      graph_version: input.graph_version,
    })
    .select("id")
    .maybeSingle();
  if (error || !data) throw new SamError("workflow_persistence_failed", error?.message);
  return data.id;
}

export async function markRunning(supabase: Client, runId: string): Promise<void> {
  const { error } = await supabase
    .from("sam_workflow_runs")
    .update({ status: "running" })
    .eq("id", runId);
  if (error) throw new SamError("workflow_persistence_failed", error.message);
}

export interface CompleteRunInput {
  runId: string;
  orgId: string;
  executiveSummary: string | null;
  confidenceScore: number | null;
  confidenceBand: string | null;
  contextSummary: Record<string, unknown>;
  citationSummary: Record<string, unknown>;
  outputSnapshot: Record<string, unknown>;
  provider: string | null;
  model: string | null;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  findingCount: number;
  recommendationCount: number;
  riskCount: number;
  synthesisStatus: "not_attempted" | "ok" | "failed" | "invalid" | "fallback";
}

export async function completeRun(supabase: Client, input: CompleteRunInput): Promise<void> {
  const { error } = await supabase
    .from("sam_workflow_runs")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      executive_summary: input.executiveSummary,
      confidence_score: input.confidenceScore,
      confidence_band: input.confidenceBand,
      context_summary: input.contextSummary as never,
      citation_summary: input.citationSummary as never,
      output_snapshot: input.outputSnapshot as never,
      provider: input.provider,
      model: input.model,
      latency_ms: input.latencyMs,
      input_tokens: input.inputTokens,
      output_tokens: input.outputTokens,
      finding_count: input.findingCount,
      recommendation_count: input.recommendationCount,
      risk_count: input.riskCount,
      synthesis_status: input.synthesisStatus,
    })
    .eq("id", input.runId);
  if (error) throw new SamError("workflow_persistence_failed", error.message);
}

export async function failRun(
  supabase: Client,
  runId: string,
  failureCode: string,
  latencyMs: number,
): Promise<void> {
  const { error } = await supabase
    .from("sam_workflow_runs")
    .update({
      status: "failed",
      failed_at: new Date().toISOString(),
      failure_code: failureCode,
      latency_ms: latencyMs,
    })
    .eq("id", runId);
  if (error) throw new SamError("workflow_persistence_failed", error.message);
}

export async function insertFindings(
  supabase: Client,
  orgId: string,
  runId: string,
  findings: WorkflowFinding[],
): Promise<Record<string, string>> {
  if (findings.length === 0) return {};
  const capped = findings.slice(0, SAM_WORKFLOW_LIMITS.maxFindingsPerRun);
  const rows = capped.map((f) => ({
    organization_id: orgId,
    workflow_run_id: runId,
    finding_type: f.finding_type,
    title: f.title,
    summary: f.summary,
    severity: f.severity,
    priority: f.priority,
    confidence_score: f.confidence_score,
    confidence_band: f.confidence_band,
    status: f.status,
    structured_data: f.structured_data as never,
    sort_order: f.sort_order,
  }));
  const { data, error } = await supabase.from("sam_workflow_findings").insert(rows).select("id");
  if (error) throw new SamError("workflow_persistence_failed", error.message);
  const map: Record<string, string> = {};
  (data ?? []).forEach((row, i) => {
    map[capped[i].key] = row.id;
  });
  return map;
}

export async function insertCitations(
  supabase: Client,
  orgId: string,
  runId: string,
  citations: WorkflowCitation[],
  findingKeyToId: Record<string, string>,
): Promise<void> {
  if (citations.length === 0) return;
  const capped = citations.slice(0, SAM_WORKFLOW_LIMITS.maxCitationsPerRun);
  const rows = capped.map((c) => ({
    organization_id: orgId,
    workflow_run_id: runId,
    finding_id: c.findingKey ? findingKeyToId[c.findingKey] ?? null : c.finding_id,
    citation_type: c.citation_type,
    entity_type: c.entity_type,
    entity_id: c.entity_id,
    title: c.title,
    href: c.href,
    relevance: c.relevance,
    lineage: c.lineage as never,
  }));
  const { error } = await supabase.from("sam_workflow_citations").insert(rows);
  if (error) throw new SamError("workflow_persistence_failed", error.message);
}

export async function archiveRun(supabase: Client, runId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("sam_workflow_runs")
    .update({
      status: "archived",
      archived_at: new Date().toISOString(),
      archived_by: userId,
    })
    .eq("id", runId);
  if (error) throw new SamError("workflow_persistence_failed", error.message);
}

export async function loadRun(supabase: Client, runId: string) {
  const { data, error } = await supabase
    .from("sam_workflow_runs")
    .select("*")
    .eq("id", runId)
    .maybeSingle();
  if (error) throw new SamError("workflow_persistence_failed", error.message);
  if (!data) throw new SamError("workflow_not_found");
  return data;
}

export async function listRuns(
  supabase: Client,
  orgId: string,
  opts: { workflowType?: WorkflowType; limit?: number } = {},
) {
  const limit = Math.min(opts.limit ?? 25, SAM_WORKFLOW_LIMITS.maxHistoryPage);
  let q = supabase
    .from("sam_workflow_runs")
    .select(
      "id, workflow_type, status, venture_id, started_at, completed_at, failed_at, confidence_score, confidence_band, finding_count, failure_code",
    )
    .eq("organization_id", orgId)
    .order("started_at", { ascending: false })
    .limit(limit);
  if (opts.workflowType) q = q.eq("workflow_type", opts.workflowType);
  const { data, error } = await q;
  if (error) throw new SamError("workflow_persistence_failed", error.message);
  return data ?? [];
}

export async function upsertFeedback(
  supabase: Client,
  input: {
    orgId: string;
    userId: string;
    runId: string;
    feedback_type: WorkflowFeedbackType;
    feedback_text?: string | null;
  },
): Promise<void> {
  const { error } = await supabase
    .from("sam_workflow_feedback")
    .upsert(
      {
        organization_id: input.orgId,
        workflow_run_id: input.runId,
        user_id: input.userId,
        feedback_type: input.feedback_type,
        feedback_text: input.feedback_text ?? null,
      },
      { onConflict: "workflow_run_id,user_id" },
    );
  if (error) throw new SamError("workflow_persistence_failed", error.message);
}

export async function loadFindings(supabase: Client, runId: string) {
  const { data, error } = await supabase
    .from("sam_workflow_findings")
    .select("*")
    .eq("workflow_run_id", runId)
    .order("sort_order", { ascending: true });
  if (error) throw new SamError("workflow_persistence_failed", error.message);
  return data ?? [];
}

export async function loadCitations(supabase: Client, runId: string) {
  const { data, error } = await supabase
    .from("sam_workflow_citations")
    .select("*")
    .eq("workflow_run_id", runId);
  if (error) throw new SamError("workflow_persistence_failed", error.message);
  return data ?? [];
}