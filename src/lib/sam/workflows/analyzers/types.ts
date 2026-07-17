// Deterministic analyzer contract. Every workflow ships an analyzer that
// returns structured findings; the provider's role is synthesis only.

import type { WorkflowContext, WorkflowDeterministicResult } from "../types";

export interface WorkflowAnalyzer {
  key: string;
  version: string;
  analyze(ctx: WorkflowContext): Promise<WorkflowDeterministicResult> | WorkflowDeterministicResult;
}