// Deterministic workflow confidence. Northstar owns the score; provider
// self-hints are ignored. Weights are centralized here.

import { WORKFLOW_CONFIDENCE_VERSION } from "@/lib/constants";
import type {
  WorkflowConfidence,
  WorkflowContext,
  WorkflowDeterministicResult,
} from "./types";

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

const WEIGHTS = {
  dataCompleteness: 0.18,
  recency: 0.10,
  verification: 0.10,
  memorySupport: 0.10,
  memoryConflictPenalty: -0.10,
  graphSupport: 0.06,
  ruleCoverage: 0.12,
  citationCoverage: 0.12,
  historicalReliability: 0.08,
  missingContextPenalty: -0.10,
  contradictionPenalty: -0.12,
} as const;

function bandForScore(score: number): WorkflowConfidence["band"] {
  if (score >= 0.85) return "very_high";
  if (score >= 0.7) return "high";
  if (score >= 0.45) return "moderate";
  return "low";
}

export function computeWorkflowConfidence(
  ctx: WorkflowContext,
  det: WorkflowDeterministicResult,
  citationCount: number,
  citationRejectedCount: number,
): WorkflowConfidence {
  const totalCategories = 7;
  const populated = [
    ctx.ventures.length,
    ctx.projects.length,
    ctx.decisions.length,
    ctx.commitments.length,
    ctx.goals.length,
    ctx.knowledge.length,
    ctx.activity.length,
  ].filter((n) => n > 0).length;

  const dataCompleteness = clamp01(populated / totalCategories);

  const now = Date.now();
  const latest = ctx.activity[0]?.created_at ?? ctx.projects[0]?.updated_at ?? null;
  const recency = latest
    ? clamp01(1 - Math.min(30, (now - new Date(latest).getTime()) / (24 * 60 * 60 * 1000)) / 30)
    : 0;

  const verifiedRatio = ctx.knowledge.length
    ? ctx.knowledge.filter((k) => k.verification_status === "verified").length / ctx.knowledge.length
    : 0;
  const verification = clamp01(verifiedRatio);

  const memorySupport = clamp01(ctx.memory.trusted.length / 8);
  const memoryConflictPenalty = clamp01(ctx.memory.excluded_ids.length / 8);
  const graphSupport = ctx.graph.nodes > 0 ? clamp01(ctx.graph.nodes / 20) : 0;

  const ruleCoverage = clamp01(det.rulesTriggered.length / 5);
  const findingsCount = det.findings.length || 1;
  const citationCoverage = clamp01(citationCount / (findingsCount * 2));

  const histWithScore = ctx.historicalRuns.filter((h) => typeof h.confidence_score === "number");
  const historicalReliability = histWithScore.length
    ? clamp01(
        histWithScore.reduce((a, b) => a + (b.confidence_score ?? 0), 0) / histWithScore.length,
      )
    : 0.5;

  const missingContextPenalty = clamp01(det.missingInformation.length / 5);
  const contradictionPenalty = clamp01(
    det.findings.filter((f) => f.finding_type === "contradiction").length / 3,
  );

  const signals = {
    dataCompleteness,
    recency,
    verification,
    memorySupport,
    memoryConflictPenalty,
    graphSupport,
    ruleCoverage,
    citationCoverage,
    historicalReliability,
    missingContextPenalty,
    contradictionPenalty,
  };

  let score = 0;
  (Object.keys(WEIGHTS) as Array<keyof typeof WEIGHTS>).forEach((k) => {
    score += WEIGHTS[k] * (signals as Record<string, number>)[k];
  });
  score -= 0.05 * Math.min(1, citationRejectedCount / Math.max(1, citationCount || 1));
  score = clamp01(0.5 + score);

  const explanation = [
    `Data completeness ${(dataCompleteness * 100).toFixed(0)}%`,
    `Recency ${(recency * 100).toFixed(0)}%`,
    `Citations ${citationCount} (${citationRejectedCount} rejected)`,
    det.missingInformation.length ? `Missing: ${det.missingInformation.length}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    score,
    band: bandForScore(score),
    explanation,
    signals,
    version: WORKFLOW_CONFIDENCE_VERSION,
  };
}