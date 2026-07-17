// Shared severity/priority ordering and score normalization.

import type { WorkflowSeverity, WorkflowFinding } from "../types";

export const SEVERITY_ORDER: Record<WorkflowSeverity, number> = {
  critical: 4, high: 3, medium: 2, low: 1, informational: 0,
};

export function severityAtLeast(a: WorkflowSeverity, b: WorkflowSeverity): boolean {
  return SEVERITY_ORDER[a] >= SEVERITY_ORDER[b];
}

// Deterministic stable sort by (severity desc, priority desc, title asc).
export function sortFindings(findings: WorkflowFinding[]): WorkflowFinding[] {
  return [...findings].sort((a, b) => {
    const s = SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity];
    if (s !== 0) return s;
    const p = b.priority - a.priority;
    if (p !== 0) return p;
    return a.title.localeCompare(b.title);
  });
}

export function normalize(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(1, value / max));
}

// Map a priority_level enum value to a numeric weight.
export function priorityWeight(p: string | null | undefined): number {
  switch (p) {
    case "critical": return 4;
    case "high": return 3;
    case "normal": return 2;
    case "low": return 1;
    default: return 2;
  }
}

export function assignSortOrders(findings: WorkflowFinding[]): WorkflowFinding[] {
  return sortFindings(findings).map((f, i) => ({ ...f, sort_order: i }));
}