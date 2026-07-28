// Single-pass strategy. One structured provider call. Used for summaries,
// lookups, and low-consequence questions. Persists a minimal ReasoningTrace so
// the audit contract stays uniform across strategies.

import { SamResponseSchema, type SamResponse } from "@/lib/sam/schema";
import { selectProvider } from "@/lib/sam/providers/registry.server";
import { PROMPT_VERSION } from "@/lib/sam/constitution";
import { SamError } from "@/lib/errors";
import type { SamIntent } from "@/lib/sam/intent";
import { emptyTrace, type ReasoningTrace } from "../trace";
import type { StrategyResult } from "./types";

export interface SinglePassInput {
  orgId: string;
  intent: SamIntent;
  system: string;
  contextBlock: string;
  history: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  message: string;
  maxOutputTokens?: number;
}

export async function runSinglePass(input: SinglePassInput): Promise<StrategyResult> {
  const provider = selectProvider(input.intent);
  const meta = provider.getModelMetadata();

  const messages = [
    ...input.history,
    {
      role: "user" as const,
      content: [
        `INTENT: ${input.intent}`,
        input.contextBlock,
        "",
        "USER QUESTION:",
        input.message,
      ].join("\n"),
    },
  ];

  const providerResult = await provider.generateStructuredResponse<unknown>({
    promptVersion: PROMPT_VERSION,
    system: input.system,
    messages,
    responseSchema: SamResponseSchema,
    metadata: { orgId: input.orgId, intent: input.intent },
    maxOutputTokens: input.maxOutputTokens ?? 2048,
  });

  const parsed = SamResponseSchema.safeParse(providerResult.content);
  if (!parsed.success) throw new SamError("invalid_structured_response");
  const response: SamResponse = parsed.data;

  const trace: ReasoningTrace = {
    ...emptyTrace("single_pass", input.intent, PROMPT_VERSION),
    objective: response.executive_summary ?? response.answer.slice(0, 200),
    evidence_for: response.observations,
    risks: response.risks,
    opportunities: response.opportunities,
    missing_information: response.missing_information,
    assumptions: response.assumptions,
    candidate_actions: response.recommendations.map((r) => ({
      action: r,
      rationale: "",
      supporting_citation_indexes: [],
    })),
    source_citations: response.citations,
    selected_action: response.recommendations[0] ?? null,
  };

  return {
    response,
    trace,
    usage: {
      inputTokens: providerResult.usage.inputTokens ?? 0,
      outputTokens: providerResult.usage.outputTokens ?? 0,
      latencyMs: providerResult.usage.latencyMs,
    },
    provider: { id: meta.providerId, modelId: meta.modelId },
  };
}