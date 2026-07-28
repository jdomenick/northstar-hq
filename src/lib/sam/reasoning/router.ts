// Deterministic strategy router. Selects a ReasoningStrategy based on intent,
// message signals, and available context. Pure function, no I/O.
//
// Contract: intent + consequence -> strategy. Never returns null.

import type { SamIntent } from "@/lib/sam/intent";
import type { StrategyId } from "./trace";

export interface RouterInput {
  intent: SamIntent;
  message: string;
  // Signals from AssembledContext.counts and rules  -  keep optional to keep the
  // router pure and testable without pulling the full context type.
  hasAnyContext?: boolean;
  deterministicRuleAnswer?: boolean;
  highConsequenceSignal?: boolean;
  financialSignal?: boolean;
}

// Message-level signals that mark a request as high-consequence regardless of
// its intent bucket. Deliberately narrow to avoid over-escalating everyday
// questions into expensive multi-actor runs.
const HIGH_CONSEQUENCE_TERMS = [
  /\bhire\b/i,
  /\bfire\b/i,
  /\blay ?off/i,
  /\bshut ?down\b/i,
  /\bwind[- ]down\b/i,
  /\bpivot\b/i,
  /\bacqui(re|sition)\b/i,
  /\bfundrais(e|ing)\b/i,
  /\braise (a )?(round|seed|series)\b/i,
  /\bmajor (spend|investment|risk)\b/i,
  /\brestructure\b/i,
];

const FINANCIAL_TERMS = [
  /\bbudget\b/i,
  /\brevenue\b/i,
  /\bcash\b/i,
  /\bburn\b/i,
  /\bruna?way\b/i,
  /\bmargin\b/i,
  /\bpric(e|ing)\b/i,
  /\bcost\b/i,
  /\bpayroll\b/i,
  /\binvoice\b/i,
  /\bcollections?\b/i,
];

const PLAN_INTENTS: SamIntent[] = [
  "priority_review",
  "commitment_review",
  "project_review",
  "goal_review",
];

const MULTI_ACTOR_INTENTS: SamIntent[] = ["decision_review"];

const SUMMARY_INTENTS: SamIntent[] = [
  "organization_overview",
  "venture_overview",
  "knowledge_lookup",
  "activity_summary",
  "general_executive_question",
];

export interface RouterDecision {
  strategy: StrategyId;
  reason: string;
  specialists: Array<"operations" | "revenue" | "financial_risk" | "strategic_alignment">;
}

export function detectHighConsequence(message: string): boolean {
  return HIGH_CONSEQUENCE_TERMS.some((r) => r.test(message));
}

export function detectFinancial(message: string): boolean {
  return FINANCIAL_TERMS.some((r) => r.test(message));
}

export function selectStrategy(input: RouterInput): RouterDecision {
  const {
    intent,
    message,
    hasAnyContext = true,
    deterministicRuleAnswer = false,
    highConsequenceSignal = detectHighConsequence(message),
    financialSignal = detectFinancial(message),
  } = input;

  // Unsupported action requests are refused deterministically.
  if (intent === "unsupported_action_request") {
    return {
      strategy: "single_pass",
      reason: "unsupported action refusal is deterministic and single-pass safe",
      specialists: [],
    };
  }

  // Fully rules-answered questions bypass the model entirely.
  if (deterministicRuleAnswer) {
    return {
      strategy: "deterministic_only",
      reason: "rules engine fully resolved the request",
      specialists: [],
    };
  }

  // No usable context => insufficient-data deterministic response.
  if (!hasAnyContext) {
    return {
      strategy: "deterministic_only",
      reason: "no operational context available; refuse to speculate",
      specialists: [],
    };
  }

  // Escalation: high-consequence phrasing always earns multi-actor.
  if (highConsequenceSignal) {
    const specialists: RouterDecision["specialists"] = ["strategic_alignment", "operations"];
    if (financialSignal) specialists.unshift("financial_risk", "revenue");
    else specialists.unshift("financial_risk");
    return {
      strategy: "multi_actor",
      reason: "high-consequence phrasing detected; run bounded specialist panel",
      specialists: dedupe(specialists),
    };
  }

  if (MULTI_ACTOR_INTENTS.includes(intent)) {
    const specialists: RouterDecision["specialists"] = ["strategic_alignment"];
    if (financialSignal) specialists.push("financial_risk", "revenue");
    specialists.push("operations");
    return {
      strategy: "multi_actor",
      reason: "decision review requires bounded specialist perspectives",
      specialists: dedupe(specialists),
    };
  }

  if (PLAN_INTENTS.includes(intent)) {
    return {
      strategy: "plan_then_critique",
      reason: "recommendation-class intent requires analyst -> critic -> executive",
      specialists: [],
    };
  }

  if (SUMMARY_INTENTS.includes(intent)) {
    return {
      strategy: "single_pass",
      reason: "summary or lookup-class intent; single-pass sufficient",
      specialists: [],
    };
  }

  return { strategy: "single_pass", reason: "default fallback", specialists: [] };
}

function dedupe<T>(items: T[]): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const it of items) {
    if (!seen.has(it)) {
      seen.add(it);
      out.push(it);
    }
  }
  return out;
}