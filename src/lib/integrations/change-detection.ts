// Deterministic hash-based change detection + significance classification.
// Pure functions - no I/O, no provider synthesis. Provider output MUST NOT
// influence any significance decision. Used by the sync engine to decide
// whether a fresh fetch of an Asset's content is a new version and how
// meaningful that change is.

import { CONTENT_CHANGE_THRESHOLDS } from "@/lib/constants";

export type ChangeSignificance = "none" | "minor" | "moderate" | "major";

export interface ChangeDetectionInput {
  previousHash: string | null;
  previousText: string | null;
  previousTitle: string | null;
  nextHash: string;
  nextText: string | null;
  nextTitle: string | null;
}

export interface ChangeDetectionResult {
  changed: boolean;
  significance: ChangeSignificance;
  changeRatio: number;              // 0..1 fraction of characters changed
  titleChanged: boolean;
  lengthDeltaChars: number;
  signals: string[];                // deterministic reasons, e.g. "title_changed"
}

// Character-diff ratio approximated by a length-normalized Levenshtein-like
// comparison at coarse granularity. For long documents we bucket by 32-char
// windows so the cost stays bounded (O(n/32) instead of O(n^2)).
function coarseChangeRatio(a: string, b: string): number {
  if (a === b) return 0;
  if (!a && !b) return 0;
  if (!a || !b) return 1;
  const bucket = 64;
  const bucketsA: string[] = [];
  const bucketsB: string[] = [];
  for (let i = 0; i < a.length; i += bucket) bucketsA.push(a.slice(i, i + bucket));
  for (let i = 0; i < b.length; i += bucket) bucketsB.push(b.slice(i, i + bucket));
  const setA = new Set(bucketsA);
  const setB = new Set(bucketsB);
  let shared = 0;
  for (const x of setA) if (setB.has(x)) shared += 1;
  const union = setA.size + setB.size - shared;
  if (union === 0) return 0;
  return 1 - shared / union;
}

export function detectChange(input: ChangeDetectionInput): ChangeDetectionResult {
  const signals: string[] = [];
  const hashChanged = input.previousHash !== null && input.previousHash !== input.nextHash;
  const isFirstVersion = input.previousHash === null;

  if (!hashChanged && !isFirstVersion) {
    return {
      changed: false,
      significance: "none",
      changeRatio: 0,
      titleChanged: false,
      lengthDeltaChars: 0,
      signals: ["hash_match"],
    };
  }

  const prevText = input.previousText ?? "";
  const nextText = input.nextText ?? "";
  const ratio = coarseChangeRatio(prevText, nextText);
  const lengthDelta = nextText.length - prevText.length;
  const titleChanged =
    (input.previousTitle ?? "").trim() !== (input.nextTitle ?? "").trim();

  if (isFirstVersion) signals.push("first_version");
  if (hashChanged) signals.push("hash_changed");
  if (titleChanged) signals.push("title_changed");
  if (Math.abs(lengthDelta) > 2000) signals.push("large_length_delta");

  let significance: ChangeSignificance;
  if (isFirstVersion) {
    significance = "major";
  } else if (ratio >= CONTENT_CHANGE_THRESHOLDS.majorRatio || titleChanged) {
    significance = "major";
  } else if (ratio >= CONTENT_CHANGE_THRESHOLDS.moderateRatio) {
    significance = "moderate";
  } else if (ratio >= CONTENT_CHANGE_THRESHOLDS.minorRatio) {
    significance = "minor";
  } else {
    // Hash differed but text is essentially the same (e.g. whitespace or
    // metadata). Treat as minor - still worth a new version row so we have
    // an audit trail, but not worth a signal to a human.
    significance = "minor";
  }

  return {
    changed: true,
    significance,
    changeRatio: Number(ratio.toFixed(4)),
    titleChanged,
    lengthDeltaChars: lengthDelta,
    signals,
  };
}

export interface DiffSummary {
  ratio: number;
  titleChanged: boolean;
  lengthDelta: number;
  significance: ChangeSignificance;
  signals: string[];
}

export function summarizeDiff(result: ChangeDetectionResult): DiffSummary {
  return {
    ratio: result.changeRatio,
    titleChanged: result.titleChanged,
    lengthDelta: result.lengthDeltaChars,
    significance: result.significance,
    signals: result.signals,
  };
}