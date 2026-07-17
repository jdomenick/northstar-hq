// Pure-function ambiguity detection helpers. The SAM command layer uses these
// to decide whether a request can be routed unambiguously to a single record
// or whether the operator needs to disambiguate before we mutate anything.

import type { OperationAmbiguous, SamOperationName } from "./types";
import { SAM_OPERATIONS_VERSION } from "./types";

export interface AmbiguityCandidate {
  id: string;
  label: string;
  hint?: string;
}

export interface AmbiguityInput<T extends AmbiguityCandidate> {
  candidates: T[];
  /** Free-text hint from the user's message (platform, date, keyword). */
  hint?: string | null;
}

export function resolveSingleCandidate<T extends AmbiguityCandidate>(
  input: AmbiguityInput<T>,
): { kind: "single"; candidate: T } | { kind: "none" } | { kind: "many"; candidates: T[] } {
  if (input.candidates.length === 0) return { kind: "none" };
  if (input.candidates.length === 1) return { kind: "single", candidate: input.candidates[0] };
  const h = (input.hint ?? "").trim().toLowerCase();
  if (h.length >= 2) {
    const matches = input.candidates.filter(
      (c) => c.label.toLowerCase().includes(h) || (c.hint ?? "").toLowerCase().includes(h),
    );
    if (matches.length === 1) return { kind: "single", candidate: matches[0] };
    if (matches.length > 1) return { kind: "many", candidates: matches };
  }
  return { kind: "many", candidates: input.candidates };
}

export function buildAmbiguousResult(args: {
  operation: SamOperationName;
  organizationId: string;
  ventureId?: string | null;
  actorUserId: string;
  question: string;
  candidates: AmbiguityCandidate[];
  durationMs?: number;
}): OperationAmbiguous {
  return {
    operation: args.operation,
    version: SAM_OPERATIONS_VERSION,
    organizationId: args.organizationId,
    ventureId: args.ventureId ?? null,
    actorUserId: args.actorUserId,
    status: "ambiguous",
    summary: args.question,
    question: args.question,
    candidates: args.candidates.slice(0, 8),
    affectedRecords: [],
    durationMs: args.durationMs ?? 0,
  };
}