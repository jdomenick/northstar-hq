// Plan -> Critique -> Executive synthesis. Three bounded structured passes.
// Used for recommendation-class intents: priority_review, project_review,
// commitment_review, goal_review.
//
// Contract:
//   1. Analyst enumerates evidence, gaps, risks, and >=2 candidate actions
//      when multiple options exist.
//   2. Critic challenges the analyst's leading option, tests assumptions,
//      surfaces contrary evidence, and proposes a simpler/safer path when
//      applicable.
//   3. Executive synthesizes the final SamResponse + extension fields
//      (selected_action, principal_tradeoff, decision_changers,
//      rejected_actions). Only the executive output is user-visible.

import { SamResponseSchema, type SamResponse } from "@/lib/sam/schema";
import { selectProvider } from "@/lib/sam/providers/registry.server";
import { PROMPT_VERSION } from "@/lib/sam/constitution";
import { SamError } from "@/lib/errors";
import type { SamIntent } from "@/lib/sam/intent";
import {
  AnalystOutputSchema,
  CriticOutputSchema,
  ExecutiveExtensionSchema,
  REASONING_TRACE_VERSION,
  type ReasoningTrace,
} from "../trace";
import type { StrategyResult } from "./types";
import { z } from "zod";

export interface PlanCritiqueInput {
  orgId: string;
  intent: SamIntent;
  system: string;
  contextBlock: string;
  history: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  message: string;
}

const ANALYST_HINT = `
ANALYST PASS.
Identify the objective. Enumerate evidence FOR and AGAINST any leading
conclusion. List constraints, missing information, explicit assumptions,
risks, and opportunities. Generate at least TWO viable candidate_actions
whenever more than one legitimate option exists. Cite records from CONTEXT
by id in the citations array. Never invent records.`;

const CRITIC_HINT = `
CRITIC PASS.
You are reviewing the ANALYST output shown below. Your job is to challenge,
not to agree.
Identify unsupported_conclusions, challenged_assumptions, contrary_evidence,
and second_order_consequences. If a simpler or safer option exists, propose
it in simpler_alternative. Set preferred_action_holds=false when the leading
action fails scrutiny. Never invent records or citations.`;

const EXEC_HINT = `
EXECUTIVE SYNTHESIS PASS.
You are given the ANALYST and CRITIC outputs. Select, revise, or reject the
leading action. State the principal_tradeoff, the decision_changers (what
would flip your recommendation), and any rejected_actions with reasons.
Return only claims supported by CONTEXT or clearly marked as assumption or
inference. Populate the standard SamResponse fields plus the extension
fields. Do not include hidden reasoning.`;

// Combined executive schema: the standard SamResponse plus the extension.
const ExecutiveOutputSchema = SamResponseSchema.extend({
  executive_extension: ExecutiveExtensionSchema,
});
type ExecutiveOutput = z.infer<typeof ExecutiveOutputSchema>;

export async function runPlanThenCritique(
  input: PlanCritiqueInput,
): Promise<StrategyResult> {
  const provider = selectProvider(input.intent);
  const meta = provider.getModelMetadata();

  const baseHistory = input.history;
  const contextTurn = {
    role: "user" as const,
    content: [
      `INTENT: ${input.intent}`,
      input.contextBlock,
      "",
      "USER QUESTION:",
      input.message,
    ].join("\n"),
  };

  let totalLatency = 0;
  let totalIn = 0;
  let totalOut = 0;

  // Pass 1 — Analyst
  const analystRes = await provider.generateStructuredResponse<unknown>({
    promptVersion: PROMPT_VERSION,
    system: `${input.system}\n\n${ANALYST_HINT}`,
    messages: [...baseHistory, contextTurn],
    responseSchema: AnalystOutputSchema,
    metadata: { orgId: input.orgId, intent: `${input.intent}:analyst` },
    maxOutputTokens: 1500,
    temperature: 0.2,
  });
  const analystParsed = AnalystOutputSchema.safeParse(analystRes.content);
  if (!analystParsed.success) throw new SamError("invalid_structured_response");
  const analyst = analystParsed.data;
  totalLatency += analystRes.usage.latencyMs;
  totalIn += analystRes.usage.inputTokens ?? 0;
  totalOut += analystRes.usage.outputTokens ?? 0;

  // Pass 2 — Critic
  const criticRes = await provider.generateStructuredResponse<unknown>({
    promptVersion: PROMPT_VERSION,
    system: `${input.system}\n\n${CRITIC_HINT}`,
    messages: [
      ...baseHistory,
      contextTurn,
      {
        role: "user" as const,
        content: `ANALYST OUTPUT:\n${JSON.stringify(analyst)}`,
      },
    ],
    responseSchema: CriticOutputSchema,
    metadata: { orgId: input.orgId, intent: `${input.intent}:critic` },
    maxOutputTokens: 1200,
    temperature: 0.2,
  });
  const criticParsed = CriticOutputSchema.safeParse(criticRes.content);
  if (!criticParsed.success) throw new SamError("invalid_structured_response");
  const critic = criticParsed.data;
  totalLatency += criticRes.usage.latencyMs;
  totalIn += criticRes.usage.inputTokens ?? 0;
  totalOut += criticRes.usage.outputTokens ?? 0;

  // Pass 3 — Executive synthesis
  const execRes = await provider.generateStructuredResponse<unknown>({
    promptVersion: PROMPT_VERSION,
    system: `${input.system}\n\n${EXEC_HINT}`,
    messages: [
      ...baseHistory,
      contextTurn,
      { role: "user" as const, content: `ANALYST:\n${JSON.stringify(analyst)}` },
      { role: "user" as const, content: `CRITIC:\n${JSON.stringify(critic)}` },
    ],
    responseSchema: ExecutiveOutputSchema,
    metadata: { orgId: input.orgId, intent: `${input.intent}:executive` },
    maxOutputTokens: 2048,
    temperature: 0.2,
  });
  const execParsed = ExecutiveOutputSchema.safeParse(execRes.content);
  if (!execParsed.success) throw new SamError("invalid_structured_response");
  const exec: ExecutiveOutput = execParsed.data;
  totalLatency += execRes.usage.latencyMs;
  totalIn += execRes.usage.inputTokens ?? 0;
  totalOut += execRes.usage.outputTokens ?? 0;

  // Strip the extension before returning the public SamResponse.
  const { executive_extension, ...responseOnly } = exec;
  const response: SamResponse = SamResponseSchema.parse(responseOnly);

  const trace: ReasoningTrace = {
    version: REASONING_TRACE_VERSION,
    strategy: "plan_then_critique",
    intent: input.intent,
    prompt_version: PROMPT_VERSION,
    objective: analyst.objective,
    evidence_for: analyst.evidence_for,
    evidence_against: [...analyst.evidence_against, ...critic.contrary_evidence],
    missing_information: analyst.missing_information,
    assumptions: analyst.assumptions,
    constraints: analyst.constraints,
    risks: [...analyst.risks, ...response.risks].filter(dedupe),
    opportunities: [...analyst.opportunities, ...response.opportunities].filter(dedupe),
    candidate_actions: analyst.candidate_actions,
    action_tradeoffs: executive_extension.principal_tradeoff
      ? [executive_extension.principal_tradeoff]
      : [],
    rejected_actions: executive_extension.rejected_actions,
    critic_findings: critic.findings,
    specialists: [],
    selected_action: executive_extension.selected_action ?? response.recommendations[0] ?? null,
    decision_changers: executive_extension.decision_changers,
    source_citations: response.citations,
    notes: critic.notes ? [critic.notes] : [],
  };

  return {
    response,
    trace,
    usage: { inputTokens: totalIn, outputTokens: totalOut, latencyMs: totalLatency },
    provider: { id: meta.providerId, modelId: meta.modelId },
  };
}

function dedupe<T>(v: T, i: number, arr: T[]) {
  return arr.indexOf(v) === i;
}