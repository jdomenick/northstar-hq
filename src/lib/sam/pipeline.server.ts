// SAM pipeline orchestrator. Runs the deterministic stages defined in
// docs/sam/01-pipeline.md around a single provider call.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { buildContext, serializeContext, type AssembledContext } from "./context-builder.server";
import { classifyIntent, type SamIntent } from "./intent";
import { buildSystemPrompt, PROMPT_VERSION } from "./constitution";
import { getCompanyConstitution } from "./company-constitution.server";
import { type SamResponse } from "./schema";
import { computeConfidence, type ConfidenceObject } from "./confidence";
import { verifyCitations, citationHref } from "./citations";
import { writeAudit } from "./audit.server";
import { SamError, toSamError } from "@/lib/errors";
import { LIMITS } from "@/lib/constants";
import { runStrategy } from "./reasoning/strategies/dispatch.server";
import { buildExplainableSummary, type ReasoningTrace, type ExplainableSummary } from "./reasoning/trace";
import type { StrategyId } from "./reasoning/trace";

export interface RunPipelineInput {
  orgId: string;
  userId: string;
  conversationId: string;
  message: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  ventureId?: string | null;
  settings: {
    response_style: "concise" | "balanced" | "detailed";
    challenge_level: "supportive" | "balanced" | "direct";
    include_founder_memory?: boolean;
    include_org_memory?: boolean;
    include_venture_memory?: boolean;
  };
}

export interface PipelineResult {
  response: SamResponse;
  confidence: ConfidenceObject;
  intent: SamIntent;
  context: AssembledContext;
  provider: { id: string; modelId: string };
  usage: { inputTokens?: number; outputTokens?: number; latencyMs: number };
  hrefs: Record<string, string | null>;
  strategy: StrategyId;
  strategyReason: string;
  trace: ReasoningTrace;
  summary: ExplainableSummary;
}

export async function runPipeline(
  supabase: SupabaseClient<Database>,
  input: RunPipelineInput,
): Promise<PipelineResult> {
  // 1. Intent
  const intent = classifyIntent(input.message);

  // 2-6. Context assembly (bounded, RLS-scoped)
  let context: AssembledContext;
  try {
    context = await buildContext(supabase, input.orgId, {
      intent,
      ventureId: input.ventureId ?? null,
      userId: input.userId,
      memoryToggles: {
        founder: input.settings.include_founder_memory ?? true,
        org: input.settings.include_org_memory ?? true,
        venture: input.settings.include_venture_memory ?? true,
      },
    });
  } catch (e) {
    throw new SamError("context_assembly_failed", (e as Error).message);
  }

  // 7. Reasoning  -  strategy dispatcher (deterministic router selects
  //    single_pass, plan_then_critique, multi_actor, or deterministic_only).
  const companyConstitution = await getCompanyConstitution(input.orgId);
  const system = buildSystemPrompt({
    orgName: context.org?.name ?? "your organization",
    founderName: context.founder?.preferred_name ?? context.founder?.full_name ?? null,
    responseStyle: input.settings.response_style,
    challengeLevel: input.settings.challenge_level,
    companyConstitution,
  });

  const contextBlock = serializeContext(context);
  const trimmedHistory = input.history.slice(-LIMITS.sam.maxHistoryMessages);
  const history = trimmedHistory.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  let dispatch;
  try {
    dispatch = await runStrategy({
      orgId: input.orgId,
      intent,
      message: input.message,
      system,
      contextBlock,
      context,
      history,
    });
  } catch (e) {
    throw toSamError(e);
  }

  const response = dispatch.response;
  const trace = dispatch.trace;

  // 9-10. Citation verification (RLS-backed) + href resolution
  const verifiedCitations = verifyCitations(response, context);
  response.citations = verifiedCitations;
  trace.source_citations = verifiedCitations;
  const hrefs: Record<string, string | null> = {};
  for (const c of verifiedCitations) {
    hrefs[`${c.entity_type}:${c.entity_id}`] = citationHref(c.entity_type, c.entity_id);
  }

  // 11. Deterministic confidence  -  NorthStar Labs owns the score
  const confidence = computeConfidence(response, context);

  const summary = buildExplainableSummary(trace, {
    recommendations: response.recommendations,
    risks: response.risks,
    missing_information: response.missing_information,
    next_question: response.next_question,
  });

  const providerMeta = dispatch.provider ?? { id: "deterministic", modelId: "n/a" };

  return {
    response,
    confidence,
    intent,
    context,
    provider: { id: providerMeta.id, modelId: providerMeta.modelId },
    usage: dispatch.usage,
    hrefs,
    strategy: dispatch.decision.strategy,
    strategyReason: dispatch.decision.reason,
    trace,
    summary,
  };
}

// Silence unused-import warning when PROMPT_VERSION is not directly referenced
// in this file after refactor  -  keep the constant exported through this module
// for downstream consumers that still import it via pipeline.server.
export { PROMPT_VERSION };

// Convenience audit wrapper  -  pipeline callers hand us the message id after
// persistence so the invocation row can link back.
export { writeAudit };