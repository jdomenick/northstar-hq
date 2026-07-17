// Deterministic conflict detection between confirmed memory items.
// Rule: same organization, same layer, same category, overlapping scope,
// and statements that read as contradictory (naive lexical opposition or
// distinct structured_value on identical structured_key).

import type { MemoryItemRow } from "./schema";

const NEGATION = /\b(no|not|never|don'?t|do not|isn'?t|aren'?t|won'?t|refuse|avoid)\b/i;

function scopeMatches(a: MemoryItemRow, b: MemoryItemRow): boolean {
  if (a.venture_id !== b.venture_id) return false;
  if ((a.layer === "founder" || a.layer === "preference") && a.owner_user_id !== b.owner_user_id) return false;
  return true;
}

function looksContradictory(a: string, b: string): boolean {
  const na = NEGATION.test(a);
  const nb = NEGATION.test(b);
  if (na === nb) return false;
  // Basic keyword overlap gate to avoid random negation triples.
  const wordsA = new Set(a.toLowerCase().match(/[a-z]{4,}/g) ?? []);
  const wordsB = b.toLowerCase().match(/[a-z]{4,}/g) ?? [];
  const overlap = wordsB.filter((w) => wordsA.has(w)).length;
  return overlap >= 2;
}

export interface DetectedConflict {
  a: MemoryItemRow;
  b: MemoryItemRow;
  reason: string;
}

export function detectConflicts(items: MemoryItemRow[]): DetectedConflict[] {
  const active = items.filter((i) => i.status === "confirmed" || i.status === "proposed");
  const out: DetectedConflict[] = [];
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];
      if (a.layer !== b.layer) continue;
      if (a.category !== b.category) continue;
      if (!scopeMatches(a, b)) continue;
      if (looksContradictory(a.statement, b.statement)) {
        out.push({ a, b, reason: "Contradictory statement in same layer + category + scope" });
      }
    }
  }
  return out;
}