// Workflow runner. Enforces the full sequence: validate → auth → resolve →
// registry → duplicate check → create pending → run → assemble → analyze →
// synthesize → validate citations → confidence → persist → audit.
// On failure never leaves a run in `running`; always writes sanitized
// failure code; preserves deterministic output when valid.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { SamError, toSamError } from "@/lib/errors";
import {
  WORKFLOW_CONFIDENCE_VERSION,
  WORKFLOW_ENGINE_VERSION,
  EXECUTIVE_GRAPH_VERSION,
  MEMORY_FRAMEWORK_VERSION,
} from "@/lib/constants";
import {
  CONSTITUTION_VERSION,
  PIPELINE_VERSION,
  PROMPT_VERSION,
} from "@/lib/sam/constitution";
import type {
  WorkflowContext,
  WorkflowDeterministicResult,
  WorkflowRunInput,
  WorkflowRunResult,
} from "./types";
import { getWorkflowDefinition } from "./registry.server";
import { resolveWorkflowScope } from "./auth.server";
import { assertNoDuplicateActive } from "./concurrency.server";
import { isDuplicateActiveError } from "./concurrency.server";
import { assembleWorkflowContext } from "./context.server";
import { notImplementedAnalyzer } from "./analyzers/not-implemented.server";
import { dailyBriefingAnalyzer } from "./analyzers/daily-briefing.server";
import { weeklyReviewAnalyzer } from "./analyzers/weekly-review.server";
import { decisionReviewAnalyzer } from "./analyzers/decision-review.server";
import type { WorkflowAnalyzer } from "./analyzers/types";
import { runSynthesis } from "./synthesis.server";
import { validateWorkflowCitations } from "./citations.server";
import { computeWorkflowConfidence } from "./confidence.server";
import {
  createPendingRun,
  markRunning,
  completeRun,
  failRun,
  insertFindings,
  insertCitations,
} from "./persistence.server";
import { writeWorkflowAudit } from "./audit.server";

type Client = SupabaseClient<Database>;

function analyzerFor(key: string): WorkflowAnalyzer {
  switch (key) {
    case "daily_briefing": return dailyBriefingAnalyzer;
    case "weekly_review": return weeklyReviewAnalyzer;
    case "decision_review": return decisionReviewAnalyzer;
    case "not_implemented": return notImplementedAnalyzer;
    default: throw new SamError("workflow_not_implemented");
  }
}

// Which context sources each analyzer actually needs.
function sourcesFor(key: string) {
  switch (key) {
    case "daily_briefing":
      return { ventures: true, projects: true, tasks: true, goals: true, decisions: true, commitments: true, knowledge: false, documents: false, activity: true, memory: true, graph: false, historical: true } as const;
    case "weekly_review":
      return { ventures: true, projects: true, tasks: true, goals: true, decisions: true, commitments: true, knowledge: false, documents: false, activity: true, memory: true, graph: false, historical: true } as const;
    case "decision_review":
      return { ventures: false, projects: true, tasks: false, goals: true, decisions: true, commitments: false, knowledge: true, documents: false, activity: false, memory: true, graph: true, historical: true } as const;
    default:
      return undefined;
  }
}

export async function runWorkflow(
  supabase: Client,
  userId: string,
  rawInput: WorkflowRunInput,
): Promise<WorkflowRunResult> {
  const startedAt = Date.now();
  const registry = getWorkflowDefinition(rawInput.workflowType);
  if (!registry || !registry.active) throw new SamError("workflow_unavailable");

  const scope = await resolveWorkflowScope(supabase, userId, rawInput, registry);
  await assertNoDuplicateActive(supabase, {
    orgId: scope.orgId,
    userId: scope.userId,
    workflowType: registry.key,
    ventureId: scope.ventureId,
    periodStart: scope.periodStart,
    periodEnd: scope.periodEnd,
    entityId: rawInput.entityId ?? null,
  });

  let runId: string;
  try {
    runId = await createPendingRun(supabase, {
    orgId: scope.orgId,
    userId: scope.userId,
    workflowType: registry.key,
    ventureId: scope.ventureId,
    periodStart: scope.periodStart,
    periodEnd: scope.periodEnd,
    trigger: rawInput.trigger,
    input_snapshot: {
      scope: rawInput.scope,
      ventureId: scope.ventureId,
      periodStart: scope.periodStart,
      periodEnd: scope.periodEnd,
      entityId: rawInput.entityId ?? null,
      retryOfRunId: (rawInput.extras?.retryOfRunId as string | undefined) ?? null,
    },
    workflow_version: registry.version,
    prompt_version: PROMPT_VERSION,
    constitution_version: CONSTITUTION_VERSION,
    pipeline_version: PIPELINE_VERSION,
    confidence_version: WORKFLOW_CONFIDENCE_VERSION,
    memory_version: MEMORY_FRAMEWORK_VERSION,
    graph_version: EXECUTIVE_GRAPH_VERSION,
    });
  } catch (err) {
    if (isDuplicateActiveError(err)) throw new SamError("workflow_already_running");
    throw err;
  }

  let ctx: WorkflowContext | null = null;
  let deterministic: WorkflowDeterministicResult | null = null;

  try {
    await markRunning(supabase, runId);

    ctx = await assembleWorkflowContext(supabase, {
      orgId: scope.orgId,
      userId: scope.userId,
      workflowType: registry.key,
      scope: rawInput.scope,
      ventureId: scope.ventureId,
      periodStart: scope.periodStart,
      periodEnd: scope.periodEnd,
      entityId: rawInput.entityId ?? null,
      sources: sourcesFor(registry.deterministicAnalyzer),
    });

    const analyzer = analyzerFor(registry.deterministicAnalyzer);
    try {
      deterministic = await analyzer.analyze(ctx);
    } catch (err) {
      throw toSamError(err);
    }

    // Preliminary confidence + synthesis
    const preliminary = computeWorkflowConfidence(ctx, deterministic, 0, 0);
    void preliminary;

    const synth = await runSynthesis(registry, ctx, deterministic, runId);

    // Citation validation
    const { accepted, rejected } = validateWorkflowCitations(
      ctx,
      deterministic.citationCandidates,
    );

    const finalConfidence = computeWorkflowConfidence(
      ctx,
      deterministic,
      accepted.length,
      rejected.length,
    );

    const findingKeyToId = await insertFindings(supabase, scope.orgId, runId, deterministic.findings);
    await insertCitations(supabase, scope.orgId, runId, accepted, findingKeyToId);

    const latency = Date.now() - startedAt;
    const findings = deterministic.findings;
    const recommendationCount = findings.filter((f) => f.finding_type === "recommendation").length;
    const riskCount = findings.filter((f) => f.finding_type === "risk").length;

    await completeRun(supabase, {
      runId,
      orgId: scope.orgId,
      executiveSummary: synth.synthesis?.executiveSummary ?? null,
      confidenceScore: finalConfidence.score,
      confidenceBand: finalConfidence.band,
      contextSummary: {
        counts: ctx.counts,
        countsBeforeTruncation: ctx.countsBeforeTruncation,
        truncations: ctx.truncations,
        omittedCategories: ctx.omittedCategories,
        graph: ctx.graph,
      },
      citationSummary: { accepted: accepted.length, rejected: rejected.length },
      outputSnapshot: {
        synthesis: synth.synthesis,
        deterministic: {
          scores: deterministic.scores,
          missingInformation: deterministic.missingInformation,
          counts: deterministic.counts,
          rulesTriggered: deterministic.rulesTriggered,
          analyzerVersion: analyzer.version,
        },
        confidence: finalConfidence,
      },
      provider: synth.provider,
      model: synth.model,
      latencyMs: latency,
      inputTokens: synth.inputTokens,
      outputTokens: synth.outputTokens,
      findingCount: findings.length,
      recommendationCount,
      riskCount,
      synthesisStatus: synth.status,
    });

    await writeWorkflowAudit({
      workflowType: registry.key,
      workflowVersion: registry.version,
      registryVersion: registry.registryVersion,
      trigger: rawInput.trigger,
      userId: scope.userId,
      orgId: scope.orgId,
      ventureId: scope.ventureId,
      periodStart: scope.periodStart,
      periodEnd: scope.periodEnd,
      countsBeforeTruncation: ctx.countsBeforeTruncation,
      selectedCounts: ctx.counts,
      truncations: ctx.truncations,
      memoryConsideredIds: ctx.memory.considered_ids,
      memorySelectedIds: ctx.memory.selected_ids,
      memoryReliability: ctx.memory.reliability_summary,
      graphNodes: ctx.graph.nodes,
      graphEdges: ctx.graph.edges,
      graphDepth: ctx.graph.depthReached,
      rulesTriggered: deterministic.rulesTriggered,
      provider: synth.provider,
      model: synth.model,
      promptVersion: PROMPT_VERSION,
      constitutionVersion: CONSTITUTION_VERSION,
      contextVersion: ctx.version,
      confidenceVersion: WORKFLOW_CONFIDENCE_VERSION,
      citationCount: accepted.length,
      rejectedCitationCount: rejected.length,
      findingCount: findings.length,
      recommendationCount,
      riskCount,
      latencyMs: latency,
      inputTokens: synth.inputTokens,
      outputTokens: synth.outputTokens,
      success: true,
      failureCode: null,
    });

    // Completion learning event  -  persisted so future runs can learn.
    try {
      await supabase.from("sam_learning_events").insert({
        organization_id: scope.orgId,
        user_id: scope.userId,
        event_type: "workflow_run_completed",
        original_payload: {
          workflow_run_id: runId,
          workflow_type: registry.key,
          finding_count: findings.length,
          confidence: finalConfidence.score,
        } as never,
      });
    } catch { /* non-fatal */ }

    return {
      runId,
      workflowType: registry.key,
      status: "completed",
      executiveSummary: synth.synthesis?.executiveSummary ?? null,
      confidence: finalConfidence,
      findings,
      citations: accepted,
      counts: {
        finding: findings.length,
        recommendation: recommendationCount,
        risk: riskCount,
        citation: accepted.length,
        citation_rejected: rejected.length,
      },
    };
  } catch (rawErr) {
    const err = toSamError(rawErr);
    const latency = Date.now() - startedAt;
    try {
      await failRun(supabase, runId, err.code, latency);
    } catch {
      /* swallow  -  we're already in the failure path */
    }
    // Failure learning event.
    try {
      await supabase.from("sam_learning_events").insert({
        organization_id: scope.orgId,
        user_id: scope.userId,
        event_type: "workflow_run_failed",
        original_payload: {
          workflow_run_id: runId,
          workflow_type: registry.key,
          failure_code: err.code,
        } as never,
      });
    } catch { /* swallow */ }
    try {
      await writeWorkflowAudit({
        workflowType: registry.key,
        workflowVersion: registry.version,
        registryVersion: registry.registryVersion,
        trigger: rawInput.trigger,
        userId: scope.userId,
        orgId: scope.orgId,
        ventureId: scope.ventureId,
        periodStart: scope.periodStart,
        periodEnd: scope.periodEnd,
        countsBeforeTruncation: ctx?.countsBeforeTruncation ?? {},
        selectedCounts: ctx?.counts ?? {},
        truncations: ctx?.truncations ?? [],
        memoryConsideredIds: ctx?.memory.considered_ids ?? [],
        memorySelectedIds: ctx?.memory.selected_ids ?? [],
        memoryReliability: ctx?.memory.reliability_summary ?? { count: 0, avg: null },
        graphNodes: ctx?.graph.nodes ?? 0,
        graphEdges: ctx?.graph.edges ?? 0,
        graphDepth: ctx?.graph.depthReached ?? 0,
        rulesTriggered: deterministic?.rulesTriggered ?? [],
        provider: null,
        model: null,
        promptVersion: PROMPT_VERSION,
        constitutionVersion: CONSTITUTION_VERSION,
        contextVersion: ctx?.version ?? WORKFLOW_ENGINE_VERSION,
        confidenceVersion: WORKFLOW_CONFIDENCE_VERSION,
        citationCount: 0,
        rejectedCitationCount: 0,
        findingCount: deterministic?.findings.length ?? 0,
        recommendationCount: 0,
        riskCount: 0,
        latencyMs: latency,
        inputTokens: null,
        outputTokens: null,
        success: false,
        failureCode: err.code,
      });
    } catch {
      /* swallow */
    }
    throw err;
  }
}