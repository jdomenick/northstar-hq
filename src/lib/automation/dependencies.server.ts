// Deterministic dependency helpers. No runtime execution yet - these are the
// contracts the runner in 3D.2c-ii will call.

import { AUTOMATION_LIMITS } from "@/lib/constants";
import type { JobState } from "@/lib/constants";
import { AutomationError } from "./errors";
import type { JobDependencyDescriptor } from "./types";

export interface DependencySatisfaction {
  satisfied: boolean;
  blockedBy: string[];   // job ids that failed or are pending
  failed: string[];       // job ids in terminal failure states
}

// Pure evaluation given the dependency edges and the current status map.
export function evaluateDependencies(
  deps: readonly JobDependencyDescriptor[],
  statuses: ReadonlyMap<string, JobState>,
): DependencySatisfaction {
  const blockedBy: string[] = [];
  const failed: string[] = [];
  for (const dep of deps) {
    const s = statuses.get(dep.dependsOnJobId);
    if (dep.dependencyType === "optional") continue;
    if (!s) {
      blockedBy.push(dep.dependsOnJobId);
      continue;
    }
    if (dep.dependencyType === "requires_success") {
      if (s === "succeeded") continue;
      if (s === "failed" || s === "cancelled" || s === "expired" || s === "skipped") failed.push(dep.dependsOnJobId);
      else blockedBy.push(dep.dependsOnJobId);
    } else if (dep.dependencyType === "requires_completion") {
      if (s === "succeeded" || s === "failed" || s === "cancelled" || s === "expired" || s === "skipped") continue;
      blockedBy.push(dep.dependsOnJobId);
    } else if (dep.dependencyType === "runs_after") {
      if (s === "succeeded" || s === "failed" || s === "cancelled" || s === "expired" || s === "skipped") continue;
      blockedBy.push(dep.dependsOnJobId);
    }
  }
  return { satisfied: blockedBy.length === 0 && failed.length === 0, blockedBy, failed };
}

// Depth-first cycle + depth check against a pure adjacency map.
export function assertNoCycleOrDepth(
  adjacency: ReadonlyMap<string, readonly string[]>,
  startJobId: string,
  maxDepth = AUTOMATION_LIMITS.maxDependencyDepth,
): void {
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function walk(node: string, depth: number): void {
    if (depth > maxDepth) throw new AutomationError("dependency_depth_exceeded");
    if (visiting.has(node)) throw new AutomationError("dependency_cycle");
    if (visited.has(node)) return;
    visiting.add(node);
    for (const next of adjacency.get(node) ?? []) {
      walk(next, depth + 1);
    }
    visiting.delete(node);
    visited.add(node);
  }

  walk(startJobId, 0);
}

export function assertDependencyCountWithinLimit(count: number): void {
  if (count > AUTOMATION_LIMITS.maxDependenciesPerJob) {
    throw new AutomationError("too_many_dependencies");
  }
}