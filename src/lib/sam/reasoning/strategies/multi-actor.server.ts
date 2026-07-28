// Multi-actor strategy. Bounded specialist perspectives feeding a
// deterministic synthesis contract. Specialists never call each other and
// never initiate new loops. Only the roles the router selected run.
//
// Used for decision_review and high-consequence phrasing (hire, fire, pivot,
// fundraise, etc.).

import { SamResponseSchema, type SamResponse } from "@/lib/sam/schema";
import { selectProvider } from "@/lib/sam/providers/registry.server";
import { PROMPT_VERSION } from "@/lib/sam/constitution";
import { SamError } from "@/lib/errors";
import type { SamIntent } from "@/lib/sam/intent";
import {
  ExecutiveExtensionSchema,
  SpecialistOutputSchema,
  REASONING_TRACE_VERSION,
  type ReasoningTrace,
  type SpecialistOutput,
  type SpecialistRole,
} from "../trace";
import type { StrategyResult } from "./types";
import { z } from "zod";

const ROLE_INSTRUCTIONS: Record<SpecialistRole, string> = {
  operations:
    "You are the OPERATIONS specialist. Focus on execution feasibility, team capacity, dependencies, and delivery risk. Ignore financial and strategic angles.",
  revenue:
    "You are the REVENUE specialist. Focus on pipeline impact, retention, pricing exposure, and customer commitments. Ignore ops and strategy angles.",
  financial_risk:
    "You are the FINANCIAL RISK specialist. Focus on cash impact, burn, runway, obligations, and downside scenarios. Ignore ops and strategy angles.",
  strategic_alignment:
    "You are the STRATEGIC ALIGNMENT specialist. Focus on org and venture goals, stated commitments, and long-horizon positioning. Ignore operational tactics.",
};

const SYNTH_HINT = `
MULTI-ACTOR SYNTHESIS PASS.
You are given specialist perspectives from bounded roles. They cannot talk
to each other. Your job is to select, revise, or reject the leading action
deterministically.
Rules:
  - Where specialists agree, treat as high-weight evidence.
  - Where they disagree, state the principal_tradeoff explicitly.
  - Where evidence is thin, reduce recommendation strength.
  - Populate rejected_actions with reasons whenever a specialist's preferred
    action is not selected.
  - State decision_changers: the observable signals that would flip the
    recommendation.
  - Never invent records. Cite only from CONTEXT.`;

const ExecutiveOutputSchema = SamResponseSchema.extend({
  executive_extension: ExecutiveExtensionSchema,
});
type ExecutiveOutput = z.infer<typeof ExecutiveOutputSchema>;

export interface MultiActorInput {
  orgId: string;
  intent: SamIntent;
  system: string;
  contextBlock: string;
  history: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  message: string;
  specialists: SpecialistRole[];
}

export async function runMultiActor(input: MultiActorInput): Promise<StrategyResult> {
  if (!input.specialists.length) {
    throw new SamError("invalid_structured_response", "multi_actor requires at least one specialist");
  }

  const provider = selectProvider(input.intent);
  const meta = provider.getModelMetadata();

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

  // Sequential (not parallel) to keep provider fan-out and quota predictable.
  const specialistOutputs: SpecialistOutput[] = [];
  for (const role of input.specialists) {
    const res = await provider.generateStructuredResponse<unknown>({
      promptVersion: PROMPT_VERSION,
      system: `${input.system}\n\n${ROLE_INSTRUCTIONS[role]}`,
      messages: [...input.history, contextTurn],
      responseSchema: SpecialistOutputSchema,
      metadata: { orgId: input.orgId, intent: `${input.intent}:${role}` },
      maxOutputTokens: 900,
      temperature: 0.2,
    });
    const parsed = SpecialistOutputSchema.safeParse(res.content);
    if (!parsed.success) throw new SamError("invalid_structured_response");
    // Force role to the requested role so a model can't cross wires.
    specialistOutputs.push({ ...parsed.data, role });
    totalLatency += res.usage.latencyMs;
    totalIn += res.usage.inputTokens ?? 0;
    totalOut += res.usage.outputTokens ?? 0;
  }

  const execRes = await provider.generateStructuredResponse<unknown>({
    promptVersion: PROMPT_VERSION,
    system: `${input.system}\n\n${SYNTH_HINT}`,
    messages: [
      ...input.history,
      contextTurn,
      {
        role: "user" as const,
        content: `SPECIALISTS:\n${JSON.stringify(specialistOutputs)}`,
      },
    ],
    responseSchema: ExecutiveOutputSchema,
    metadata: { orgId: input.orgId, intent: `${input.intent}:synthesis` },
    maxOutputTokens: 2048,
    temperature: 0.2,
  });
  const execParsed = ExecutiveOutputSchema.safeParse(execRes.content);
  if (!execParsed.success) throw new SamError("invalid_structured_response");
  const exec: ExecutiveOutput = execParsed.data;
  totalLatency += execRes.usage.latencyMs;
  totalIn += execRes.usage.inputTokens ?? 0;
  totalOut += execRes.usage.outputTokens ?? 0;

  const { executive_extension, ...responseOnly } = exec;
  const response: SamResponse = SamResponseSchema.parse(responseOnly);

  const trace: ReasoningTrace = {
    version: REASONING_TRACE_VERSION,
    strategy: "multi_actor",
    intent: input.intent,
    prompt_version: PROMPT_VERSION,
    objective: response.executive_summary ?? response.answer.slice(0, 200),
    evidence_for: specialistOutputs.flatMap((s) => s.key_observations).slice(0, 12),
    evidence_against: [],
    missing_information: response.missing_information,
    assumptions: response.assumptions,
    constraints: [],
    risks: dedupeStrings([...specialistOutputs.flatMap((s) => s.risks), ...response.risks]),
    opportunities: dedupeStrings([
      ...specialistOutputs.flatMap((s) => s.opportunities),
      ...response.opportunities,
    ]),
    candidate_actions: specialistOutputs
      .filter((s) => s.preferred_action)
      .map((s) => ({
        action: s.preferred_action as string,
        rationale: s.rationale ?? s.role,
        supporting_citation_indexes: [],
      })),
    action_tradeoffs: executive_extension.principal_tradeoff
      ? [executive_extension.principal_tradeoff]
      : [],
    rejected_actions: executive_extension.rejected_actions,
    critic_findings: [],
    specialists: specialistOutputs,
    selected_action: executive_extension.selected_action ?? response.recommendations[0] ?? null,
    decision_changers: executive_extension.decision_changers,
    source_citations: response.citations,
    notes: [],
  };

  return {
    response,
    trace,
    usage: { inputTokens: totalIn, outputTokens: totalOut, latencyMs: totalLatency },
    provider: { id: meta.providerId, modelId: meta.modelId },
  };
}

function dedupeStrings(items: string[]): string[] {
  return items.filter((v, i, arr) => arr.indexOf(v) === i);
}