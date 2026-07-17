// Finding & citation-candidate helpers. Every material finding must carry
// a stable rule identifier and at least one citation candidate — except
// findings explicitly classified as missing_information / assumption.

import type {
  WorkflowFinding,
  WorkflowFindingType,
  WorkflowSeverity,
  WorkflowCitationCandidate,
} from "../types";
import type { Json } from "@/integrations/supabase/types";

export interface FindingBuilder {
  key: string; // stable rule-id + optional record-suffix
  ruleId: string; // stable across runs
  finding_type: WorkflowFindingType;
  title: string;
  summary?: string | null;
  severity: WorkflowSeverity;
  priority?: number;
  confidence_score?: number | null;
  structured_data?: Json;
}

export function buildFinding(b: FindingBuilder): WorkflowFinding {
  return {
    key: b.key,
    finding_type: b.finding_type,
    title: b.title.slice(0, 240),
    summary: (b.summary ?? null),
    severity: b.severity,
    priority: b.priority ?? 0,
    confidence_score: b.confidence_score ?? null,
    confidence_band: null,
    status: "open",
    structured_data: {
      ...(typeof b.structured_data === "object" && b.structured_data !== null && !Array.isArray(b.structured_data)
        ? (b.structured_data as Record<string, unknown>)
        : {}),
      ruleId: b.ruleId,
    } as Json,
    sort_order: 0,
  };
}

// Deduplicate by finding key (later wins are dropped — first is stable).
export function dedupeFindings(findings: WorkflowFinding[]): WorkflowFinding[] {
  const seen = new Set<string>();
  const out: WorkflowFinding[] = [];
  for (const f of findings) {
    if (seen.has(f.key)) continue;
    seen.add(f.key);
    out.push(f);
  }
  return out;
}

// Drop material findings that no longer carry a valid citation.
// Missing-information findings and system-derived findings (marked in
// structured_data.derived === true) are exempt.
export interface CitationValidationSummary {
  findings: WorkflowFinding[];
  dropped: WorkflowFinding[];
  downgraded: WorkflowFinding[];
}

export function enforceCitationSupport(
  findings: WorkflowFinding[],
  citations: WorkflowCitationCandidate[],
): CitationValidationSummary {
  const byKey = new Map<string, WorkflowCitationCandidate[]>();
  citations.forEach((c) => {
    if (!c.findingKey) return;
    if (!byKey.has(c.findingKey)) byKey.set(c.findingKey, []);
    byKey.get(c.findingKey)!.push(c);
  });

  const kept: WorkflowFinding[] = [];
  const dropped: WorkflowFinding[] = [];
  const downgraded: WorkflowFinding[] = [];
  for (const f of findings) {
    const sd = (f.structured_data ?? {}) as Record<string, unknown>;
    const isExempt =
      f.finding_type === "missing_information" ||
      sd.derived === true ||
      sd.assumption === true;
    const has = (byKey.get(f.key) ?? []).length > 0;
    if (has || isExempt) {
      kept.push(f);
    } else {
      // Downgrade to missing_information rather than silently keeping.
      downgraded.push({
        ...f,
        finding_type: "missing_information",
        severity: "informational",
        structured_data: {
          ...sd,
          downgraded_from: f.finding_type,
          reason: "no_valid_citation",
        } as Json,
      });
    }
    void dropped;
  }
  return { findings: [...kept, ...downgraded], dropped, downgraded };
}