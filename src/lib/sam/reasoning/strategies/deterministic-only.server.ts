// Deterministic-only strategy. No provider call. Used when:
//   - context is empty (nothing to reason over), or
//   - the rules engine has already produced the answer.
//
// Returns an insufficient-data SamResponse with a fully populated trace so
// downstream confidence, citations, and audit still work.

import type { SamResponse } from "@/lib/sam/schema";
import type { AssembledContext } from "@/lib/sam/context-builder.server";
import type { SamIntent } from "@/lib/sam/intent";
import { PROMPT_VERSION } from "@/lib/sam/constitution";
import { emptyTrace, type ReasoningTrace } from "../trace";
import type { StrategyResult } from "./types";

export function runDeterministicOnly(args: {
  intent: SamIntent;
  context: AssembledContext;
  reason: string;
}): StrategyResult {
  const { intent, context, reason } = args;

  const missing: string[] = [];
  if (!context.projects.length) missing.push("No projects in scope.");
  if (!context.goals.length) missing.push("No goals in scope.");
  if (!context.commitments.length) missing.push("No commitments in scope.");
  if (!context.decisions.length) missing.push("No decisions in scope.");
  if (!context.knowledge.length) missing.push("No verified knowledge in scope.");

  const response: SamResponse = {
    answer:
      "I do not have enough grounded context to answer this responsibly. " +
      "Add or connect the operational records this question depends on and ask again.",
    executive_summary: null,
    observations: [],
    risks: [],
    opportunities: [],
    recommendations: [],
    missing_information: missing.length
      ? missing
      : ["Operational context is empty for this intent."],
    assumptions: [],
    next_question:
      "Would you like to load or review the underlying records before I attempt a recommendation?",
    model_confidence_hint: "low",
    citations: [],
    unsupported_action: null,
  };

  const trace: ReasoningTrace = {
    ...emptyTrace("deterministic_only", intent, PROMPT_VERSION),
    objective: "Refuse to speculate without grounded context.",
    missing_information: response.missing_information,
    notes: [reason],
  };

  return {
    response,
    trace,
    usage: { latencyMs: 0, inputTokens: 0, outputTokens: 0 },
    provider: null,
  };
}