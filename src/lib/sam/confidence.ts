// Deterministic confidence engine  -  see docs/sam/05-confidence.md.
// Northstar owns the score; the model's self-reported hint is metadata only.

import { WEIGHTS_VERSION } from "./constitution";
import { CONFIDENCE_FRAMEWORK_VERSION } from "@/lib/constants";
import type { SamResponse } from "./schema";
import type { AssembledContext } from "./context-builder.server";

// v2 method bump  -  see docs/sam/05-confidence.md and Phase 3B report.
export const CONFIDENCE_METHOD = "v2.deterministic";

export type ConfidenceBand = "low" | "moderate" | "high" | "very_high";

export interface ConfidenceObject {
  score: number;
  band: ConfidenceBand;
  signals: {
    dataCompleteness: number;
    dataRecency: number;
    verificationCoverage: number;
    corroboration: number;
    contradictionPenalty: number;
    missingContextPenalty: number;
    historicalReliability: number;
    memorySupport: number;
    memoryConflictPenalty: number;
  };
  reasons: string[];
  method: string;
  weightsVersion: string;
  frameworkVersion: string;
  computedAt: string;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function computeConfidence(
  response: SamResponse,
  context: AssembledContext,
): ConfidenceObject {
  const reasons: string[] = [];

  // dataCompleteness: proportion of context slots with rows / total slots requested
  const slotFillRatios = [
    context.projects.length ? 1 : 0,
    context.tasks.length ? 1 : 0,
    context.goals.length ? 1 : 0,
    context.commitments.length ? 1 : 0,
    context.decisions.length ? 1 : 0,
    context.knowledge.length ? 1 : 0,
    context.activity.length ? 1 : 0,
  ];
  const dataCompleteness = clamp01(
    slotFillRatios.reduce((a, b) => a + b, 0) / slotFillRatios.length,
  );
  if (dataCompleteness < 0.5) reasons.push("Only partial operational context was available.");

  // dataRecency: proxy via activity timestamps
  const now = Date.now();
  const latestActivity = context.activity[0]?.created_at
    ? new Date(context.activity[0].created_at).getTime()
    : 0;
  const ageDays = latestActivity ? (now - latestActivity) / (1000 * 60 * 60 * 24) : 30;
  const dataRecency = clamp01(1 - Math.min(ageDays, 30) / 30);
  if (dataRecency < 0.5) reasons.push("Underlying data is older than two weeks.");

  // verificationCoverage: verified knowledge cited / knowledge cited
  const knowledgeCitations = response.citations.filter((c) => c.entity_type === "knowledge_record");
  const verifiedIds = new Set(
    context.knowledge.filter((k) => k.verification_status === "verified").map((k) => k.id),
  );
  const verificationCoverage = knowledgeCitations.length
    ? knowledgeCitations.filter((c) => verifiedIds.has(c.entity_id)).length /
      knowledgeCitations.length
    : 0.5; // neutral when no knowledge cited
  if (knowledgeCitations.length && verificationCoverage < 0.5) {
    reasons.push("Some cited knowledge records are not verified.");
  }

  // corroboration: number of distinct citation entity types
  const distinctTypes = new Set(response.citations.map((c) => c.entity_type)).size;
  const corroboration = distinctTypes >= 3 ? 1 : distinctTypes === 2 ? 0.6 : distinctTypes === 1 ? 0.3 : 0;

  // contradictionPenalty: any risks + evidence_against explicit? proxy via risks length
  const contradictionPenalty = clamp01(response.risks.length / 5);

  // missingContextPenalty
  const missingContextPenalty = clamp01(response.missing_information.length / 5);
  if (response.missing_information.length) {
    reasons.push("SAM flagged information gaps that limit certainty.");
  }

  // historicalReliability: neutral until learning framework is wired
  const historicalReliability = 0.5;

  // memorySupport  -  confirmed memory available and recent
  const trusted = context.memory?.trusted ?? [];
  const memorySupport = trusted.length
    ? Math.min(1, trusted.reduce((acc, m) => acc + m.confidence, 0) / trusted.length)
    : 0.5;
  if (trusted.length && memorySupport < 0.5) {
    reasons.push("Supporting memory is stale or weakly confirmed.");
  }

  // memoryConflictPenalty
  const memoryConflictPenalty = context.memory?.conflict_count
    ? Math.min(0.3, context.memory.conflict_count * 0.1)
    : 0;
  if (memoryConflictPenalty) reasons.push("Conflicting memory items detected in this scope.");

  const score = clamp01(
    0.18 * dataCompleteness +
      0.12 * dataRecency +
      0.12 * verificationCoverage +
      0.12 * corroboration +
      0.12 * historicalReliability +
      0.14 * memorySupport -
      0.08 * contradictionPenalty -
      0.08 * missingContextPenalty -
      memoryConflictPenalty,
  );

  let band: ConfidenceBand = "low";
  if (score >= 0.85) band = "very_high";
  else if (score >= 0.65) band = "high";
  else if (score >= 0.4) band = "moderate";

  if (!reasons.length) reasons.push("Confidence derived from current operational context.");

  return {
    score: Number(score.toFixed(3)),
    band,
    signals: {
      dataCompleteness: Number(dataCompleteness.toFixed(3)),
      dataRecency: Number(dataRecency.toFixed(3)),
      verificationCoverage: Number(verificationCoverage.toFixed(3)),
      corroboration: Number(corroboration.toFixed(3)),
      contradictionPenalty: Number(contradictionPenalty.toFixed(3)),
      missingContextPenalty: Number(missingContextPenalty.toFixed(3)),
      historicalReliability: Number(historicalReliability.toFixed(3)),
      memorySupport: Number(memorySupport.toFixed(3)),
      memoryConflictPenalty: Number(memoryConflictPenalty.toFixed(3)),
    },
    reasons,
    method: CONFIDENCE_METHOD,
    weightsVersion: WEIGHTS_VERSION,
    frameworkVersion: CONFIDENCE_FRAMEWORK_VERSION,
    computedAt: new Date().toISOString(),
  };
}