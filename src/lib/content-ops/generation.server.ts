// Structured generation guardrails. The provider returns JSON; this module
// validates + trims. No provider call is made here; the caller invokes the
// LLM and passes the raw output to `validateGenerationOutput`.

import { CONTENT_OPS_GENERATION_VERSION, CONTENT_OPS_LIMITS } from "./constants";
import { GenerationOutputSchema, type GenerationOutput } from "./schemas";

export interface GenerationValidationResult {
  ok: boolean;
  engineVersion: string;
  parsed: GenerationOutput | null;
  issues: string[];
}

export function validateGenerationOutput(raw: unknown): GenerationValidationResult {
  const issues: string[] = [];
  const parsed = GenerationOutputSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      engineVersion: CONTENT_OPS_GENERATION_VERSION,
      parsed: null,
      issues: parsed.error.issues.map((i) => `${i.path.join(".") || "root"}: ${i.message}`),
    };
  }
  const out = parsed.data;
  if (out.ideas.length > CONTENT_OPS_LIMITS.maxPlannedItemsPerRun) {
    issues.push("ideas_count_exceeds_planning_limit");
  }
  for (const idea of out.ideas) {
    if (idea.variants.length > CONTENT_OPS_LIMITS.maxVariantsPerCoreIdea) {
      issues.push(`variants_exceed_limit:${idea.ideaKey}`);
    }
  }
  return {
    ok: issues.length === 0,
    engineVersion: CONTENT_OPS_GENERATION_VERSION,
    parsed: out,
    issues,
  };
}