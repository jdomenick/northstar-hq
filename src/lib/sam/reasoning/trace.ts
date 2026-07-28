// Reasoning trace + explainable summary contract.
// Private trace persists in the audit / message metadata but is never rendered
// verbatim in the UI. The ExplainableSummary is the public surface.
//
// See docs/sam/04-reasoning.md.

import { z } from "zod";
import { CitationSchema } from "@/lib/sam/schema";

export const REASONING_TRACE_VERSION = "sam.reasoning.trace.v1";

export type StrategyId =
  | "deterministic_only"
  | "single_pass"
  | "plan_then_critique"
  | "multi_actor";

// ----- Analyst pass -----
export const AnalystCandidateAction = z.object({
  action: z.string(),
  rationale: z.string(),
  supporting_citation_indexes: z.array(z.number().int()).default([]),
});

export const AnalystOutputSchema = z.object({
  objective: z.string(),
  evidence_for: z.array(z.string()).default([]),
  evidence_against: z.array(z.string()).default([]),
  constraints: z.array(z.string()).default([]),
  missing_information: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  opportunities: z.array(z.string()).default([]),
  candidate_actions: z.array(AnalystCandidateAction).default([]),
  citations: z.array(CitationSchema).default([]),
});
export type AnalystOutput = z.infer<typeof AnalystOutputSchema>;

// ----- Critic pass -----
export const CriticFindingSchema = z.object({
  concern: z.string(),
  severity: z.enum(["low", "moderate", "high"]).default("moderate"),
});

export const CriticOutputSchema = z.object({
  unsupported_conclusions: z.array(z.string()).default([]),
  challenged_assumptions: z.array(z.string()).default([]),
  contrary_evidence: z.array(z.string()).default([]),
  second_order_consequences: z.array(z.string()).default([]),
  simpler_alternative: z.string().nullable().default(null),
  preferred_action_holds: z.boolean().default(true),
  findings: z.array(CriticFindingSchema).default([]),
  notes: z.string().nullable().default(null),
});
export type CriticOutput = z.infer<typeof CriticOutputSchema>;

// ----- Multi-actor specialist -----
export type SpecialistRole = "operations" | "revenue" | "financial_risk" | "strategic_alignment";

export const SpecialistOutputSchema = z.object({
  role: z.enum(["operations", "revenue", "financial_risk", "strategic_alignment"]),
  key_observations: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  opportunities: z.array(z.string()).default([]),
  preferred_action: z.string().nullable().default(null),
  rationale: z.string().nullable().default(null),
});
export type SpecialistOutput = z.infer<typeof SpecialistOutputSchema>;

// ----- Executive synthesis extension -----
export const RejectedActionSchema = z.object({
  action: z.string(),
  reason: z.string(),
});

export const ExecutiveExtensionSchema = z.object({
  selected_action: z.string().nullable().default(null),
  principal_tradeoff: z.string().nullable().default(null),
  decision_changers: z.array(z.string()).default([]),
  rejected_actions: z.array(RejectedActionSchema).default([]),
});
export type ExecutiveExtension = z.infer<typeof ExecutiveExtensionSchema>;

// ----- Reasoning trace (private) -----
export const ReasoningTraceSchema = z.object({
  version: z.string(),
  strategy: z.enum([
    "deterministic_only",
    "single_pass",
    "plan_then_critique",
    "multi_actor",
  ]),
  intent: z.string(),
  prompt_version: z.string(),
  objective: z.string().nullable(),
  evidence_for: z.array(z.string()).default([]),
  evidence_against: z.array(z.string()).default([]),
  missing_information: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([]),
  constraints: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  opportunities: z.array(z.string()).default([]),
  candidate_actions: z.array(AnalystCandidateAction).default([]),
  action_tradeoffs: z.array(z.string()).default([]),
  rejected_actions: z.array(RejectedActionSchema).default([]),
  critic_findings: z.array(CriticFindingSchema).default([]),
  specialists: z.array(SpecialistOutputSchema).default([]),
  selected_action: z.string().nullable().default(null),
  decision_changers: z.array(z.string()).default([]),
  source_citations: z.array(CitationSchema).default([]),
  notes: z.array(z.string()).default([]),
});
export type ReasoningTrace = z.infer<typeof ReasoningTraceSchema>;

// ----- Explainable summary (public) -----
export interface ExplainableSummary {
  recommendation: string | null;
  why: string[];
  tradeoffs: string[];
  risks: string[];
  missing_information: string[];
  decision_changers: string[];
  next_action: string | null;
}

// Turn a trace + final SamResponse into the public explainable summary.
export function buildExplainableSummary(
  trace: ReasoningTrace,
  response: {
    recommendations: string[];
    risks: string[];
    missing_information: string[];
    next_question: string | null;
  },
): ExplainableSummary {
  return {
    recommendation: trace.selected_action ?? response.recommendations[0] ?? null,
    why: trace.evidence_for.slice(0, 4),
    tradeoffs: [
      ...(trace.action_tradeoffs ?? []),
      ...trace.rejected_actions.map((r) => `Rejected: ${r.action}  -  ${r.reason}`),
    ].slice(0, 4),
    risks: [...response.risks, ...trace.risks].slice(0, 4),
    missing_information: [...response.missing_information, ...trace.missing_information]
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .slice(0, 4),
    decision_changers: trace.decision_changers.slice(0, 4),
    next_action: trace.selected_action ?? response.next_question,
  };
}

export function emptyTrace(strategy: StrategyId, intent: string, promptVersion: string): ReasoningTrace {
  return {
    version: REASONING_TRACE_VERSION,
    strategy,
    intent,
    prompt_version: promptVersion,
    objective: null,
    evidence_for: [],
    evidence_against: [],
    missing_information: [],
    assumptions: [],
    constraints: [],
    risks: [],
    opportunities: [],
    candidate_actions: [],
    action_tradeoffs: [],
    rejected_actions: [],
    critic_findings: [],
    specialists: [],
    selected_action: null,
    decision_changers: [],
    source_citations: [],
    notes: [],
  };
}